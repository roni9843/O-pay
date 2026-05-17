const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const OpayBusiness = require('../models/OpayBusiness');
const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');
const Device = require('../models/Device');
const WalletAgentPaymentTemplate = require('../models/WalletAgentPaymentTemplate');
const opayBusinessAuth = require('../middleware/opayBusinessAuth');
const MerchantWithdrawal = require('../models/MerchantWithdrawal');
const Setting = require('../models/Setting');
const { default: mongoose } = require('mongoose');

const WITHDRAW_MIN_KEY = 'merchant_withdraw_min_amount';
const WITHDRAW_COMMISSION_KEY = 'merchant_withdraw_commission_percent';

async function getWithdrawalConfig() {
  const [minSetting, commissionSetting] = await Promise.all([
    Setting.findOne({ key: WITHDRAW_MIN_KEY }).lean(),
    Setting.findOne({ key: WITHDRAW_COMMISSION_KEY }).lean(),
  ]);

  const minAmount = Number(minSetting?.value);
  const commissionPercent = Number(commissionSetting?.value);

  return {
    minAmount: Number.isFinite(minAmount) && minAmount >= 0 ? minAmount : 10000,
    commissionPercent: Number.isFinite(commissionPercent) && commissionPercent >= 0 ? commissionPercent : 0,
  };
}

// Lightweight IP geo lookup helper (best-effort; failures are ignored)
async function lookupIpLocation(ip) {
  if (!ip) return null;
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}`;
    const res = await axios.get(url, { timeout: 1500 });
    const d = res.data || {};
    if (d.status !== 'success') return null;
    return {
      country: d.country || null,
      countryCode: d.countryCode || null,
      regionName: d.regionName || null,
      city: d.city || null,
      isp: d.isp || null,
      org: d.org || null,
      as: d.as || null,
      lat: d.lat || null,
      lon: d.lon || null,
    };
  } catch (e) {
    console.error('IP geo lookup failed:', e.message);
    return null;
  }
}

// POST /api/opay-business/generate-payment-page
// Header: X-Opay-Business-Token: <business apiToken>
// Body:
//   payment_amount           (integer, required, minimum 5)
//   user_identity_address    (string, required)
//   callback_url             (string, required, valid http/https URL)
//   success_redirect_url     (string, required, valid http/https URL)
//   checkout_items           (object, optional, free-form JSON)
//   invoice_number           (string, optional)
router.post('/generate-payment-page', async (req, res) => {
  try {
    const headerToken = req.header('X-Opay-Business-Token')
      || req.header('x-opay-business-token')
      || req.header('opay-business-token');

    if (!headerToken || typeof headerToken !== 'string' || !headerToken.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid X-Opay-Business-Token header',
      });
    }

    const apiToken = headerToken.trim();
    const business = await OpayBusiness.findOne({ apiToken });

    if (!business) {
      return res.status(401).json({
        success: false,
        message: 'Invalid business token',
      });
    }

    if (!business.enabled) {
      return res.status(403).json({
        success: false,
        message: 'Business is disabled',
      });
    }

    const {
      payment_amount,
      user_identity_address,
      callback_url,
      success_redirect_url,
      checkout_items,
      invoice_number,
    } = req.body || {};

    const amountNumber = Number(payment_amount);
    if (!Number.isInteger(amountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'payment_amount must be an integer',
      });
    }

    if (amountNumber < 5) {
      return res.status(400).json({
        success: false,
        message: 'payment_amount must be at least 5',
      });
    }

    if (!user_identity_address || typeof user_identity_address !== 'string' || !user_identity_address.trim()) {
      return res.status(400).json({
        success: false,
        message: 'user_identity_address is required',
      });
    }

    if (!callback_url || typeof callback_url !== 'string' || !/^https?:\/\//i.test(callback_url)) {
      return res.status(400).json({
        success: false,
        message: 'callback_url is required and must be a valid http/https URL',
      });
    }

    if (!success_redirect_url || typeof success_redirect_url !== 'string' || !/^https?:\/\//i.test(success_redirect_url)) {
      return res.status(400).json({
        success: false,
        message: 'success_redirect_url is required and must be a valid http/https URL',
      });
    }

    // --- Caller / source metadata collection ---
    const requestIp = (req.headers['x-real-ip']
      || (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : '')
      || req.ip
      || req.connection?.remoteAddress
      || null);

    const forwardedFor = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']) : null;
    const userAgent = req.get('user-agent') || null;
    const origin = req.get('origin') || null;
    const referer = req.get('referer') || null;
    const requestHost = req.get('host') || null;

    // Remove sensitive headers (like Authorization, cookies) before persisting
    const { authorization, cookie, cookies, 'set-cookie': setCookie, ...restHeaders } = req.headers || {};
    const requestHeaders = restHeaders;

    // Simple per-IP rate indicator (last 1 hour for this business)
    let ipRequestCountLastHour = 0;
    if (requestIp) {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      ipRequestCountLastHour = await OpayBusinessPaymentSession.countDocuments({
        business: business._id,
        requestIp,
        createdAt: { $gte: since },
      });
    }

    // Approximate geo location (best effort, non-blocking if fails)
    const approxLocation = await lookupIpLocation(requestIp);

    // Generate a short random code for the URL path
    const shortCode = crypto.randomBytes(5).toString('hex'); // 10 char hex

    // Optional: set an expiry (e.g., 30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Persist session for this payment so frontend can load it by code
    await OpayBusinessPaymentSession.create({
      code: shortCode,
      business: business._id,
      amount: amountNumber,
      userIdentityAddress: user_identity_address,
      callbackUrl: callback_url,
      successRedirectUrl: success_redirect_url,
      invoiceNumber: invoice_number || null,
      checkoutItems: checkout_items || null,
       requestIp,
       forwardedFor,
       userAgent,
       origin,
       referer,
       requestHost,
       requestHeaders,
       approxLocation,
       ipRequestCountLastHour,
      expiresAt,
    });

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');
    const paymentPageUrl = `${baseUrl}/payment/${shortCode}`;

    return res.json({
      success: true,
      payment_page_url: paymentPageUrl,
      short_code: shortCode,
      amount: amountNumber,
      user_identity_address,
      callback_url,
      success_redirect_url,
      invoice_number: invoice_number || null,
      checkout_items: checkout_items || null,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('opay-business external error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating payment page URL',
    });
  }
});

// GET /api/opay-business/wallet-status
// Returns which providers (bkash, nagad, rocket, upay) are currently active
// based on wallet_agent-owned, active payment methods whose devices are online.
// Enforces:
// 1. Agent Subscription is active and not expired
// 2. Agent has sufficient credit (Credit - MinCredit >= Amount)
router.get('/wallet-status', async (req, res) => {
  try {
    const { code } = req.query;
    let requiredAmount = 0;

    // If code is provided, look up the session amount
    if (code) {
       const session = await OpayBusinessPaymentSession.findOne({ code });
       if (session) {
          requiredAmount = session.amount || 0;
       }
    }

    // Load active payment methods with owner and device
    const methods = await PaymentMethod.find({ status: 'active' })
      .populate('owner')
      .populate('device', 'state deviceCode')
      .lean();

    // Load all active subscriptions for wallet agents (optimization: load all active and filter later or query better)
    // For simplicity and correctness with small scale:
    const UserSubscription = require('../models/UserSubscription');
    const now = new Date();
    
    // Get list of users with active subscriptions
    const activeSubs = await UserSubscription.find({
       active: true,
       endDate: { $gt: now }
    }).select('user').lean();
    
    const activeUserIds = new Set(activeSubs.map(s => s.user.toString()));

    const providers = { bkash: false, nagad: false, rocket: false, upay: false };

    for (const pm of methods) {
      if (!pm.owner || pm.owner.role !== 'wallet_agent') continue;
      if (!pm.device || !pm.device.state) continue; // require device online
      
      // Check Subscription
      if (!activeUserIds.has(pm.owner._id.toString())) continue;

      // Check Credit
      const availCredit = (pm.owner.credit || 0) - (pm.owner.minimumCredit || 0);
      if (availCredit < requiredAmount) continue;

      // Online status check (Production only)
      if (req.query.env === 'production') {
         const presenceMap = req.app.get('onlineDevices') || new Map();
         const deviceCode = pm.device.deviceCode;
         const deviceId = pm.device._id.toString();

         const isOnlineByCode = deviceCode && presenceMap.has(String(deviceCode)) && presenceMap.get(String(deviceCode))?.active;
         const isOnlineById = presenceMap.has(deviceId) && presenceMap.get(deviceId)?.active;

         if (!isOnlineByCode && !isOnlineById) {
           continue;
         }
      }

      const prov = (pm.provider || '').toLowerCase();
      if (providers.hasOwnProperty(prov)) providers[prov] = true;
    }

    return res.json({ success: true, providers });
  } catch (err) {
    console.error('opay-business wallet-status error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading wallet status' });
  }
});

// GET /api/opay-business/wallet-templates
// Public read-only: returns global wallet-agent templates per provider+gateway.
router.get('/wallet-templates', async (_req, res) => {
  try {
    const templates = await WalletAgentPaymentTemplate.find({}).lean();
    return res.json({ success: true, data: templates });
  } catch (err) {
    console.error('opay-business wallet-templates error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading wallet templates' });
  }
});

// GET /api/opay-business/random-payment-method?provider=bkash&code=...
// Returns one random active wallet_agent payment method for the given provider,
// whose device is currently online.
// Enforces Credit & Subscription.
router.get('/random-payment-method', async (req, res) => {
  try {
    const providerRaw = (req.query.provider || '').toString().toLowerCase();
    const { code } = req.query;
    const allowedProviders = ['bkash', 'nagad', 'rocket', 'upay'];

    if (!allowedProviders.includes(providerRaw)) {
      return res.status(400).json({ success: false, message: 'Invalid provider' });
    }

    let requiredAmount = 0;
    if (code) {
       const session = await OpayBusinessPaymentSession.findOne({ code });
       if (session) requiredAmount = session.amount || 0;
    }

    // Load active methods for this provider, with owner + device
    const methods = await PaymentMethod.find({ provider: providerRaw, status: 'active' })
      // Need full owner object for credit Check
      .populate('owner') 
      .populate('device', 'state deviceCode')
      .lean();

    // Subs Check
    const UserSubscription = require('../models/UserSubscription');
    const now = new Date();
    const activeSubs = await UserSubscription.find({
       active: true,
       endDate: { $gt: now }
    }).select('user').lean();
    const activeUserIds = new Set(activeSubs.map(s => s.user.toString()));

    // Filter to wallet_agent-owned methods whose device is online AND have credit/subs
    const eligible = methods.filter((pm) => {
      if (!pm.owner || pm.owner.role !== 'wallet_agent') return false;
      if (!pm.device || !pm.device.state) return false;

      // Subscription check
      if (!activeUserIds.has(pm.owner._id.toString())) return false;

      // Credit check
      const availCredit = (pm.owner.credit || 0) - (pm.owner.minimumCredit || 0);
      if (availCredit < requiredAmount) return false;

      // Online status check (Production only)
      if (req.query.env === 'production') {
        const presenceMap = req.app.get('onlineDevices') || new Map();
        const deviceCode = pm.device.deviceCode; 
        const deviceId = pm.device._id.toString();

        // Check if map has either the code OR the mongo ID
        const isOnlineByCode = deviceCode && presenceMap.has(String(deviceCode)) && presenceMap.get(String(deviceCode))?.active;
        const isOnlineById = presenceMap.has(deviceId) && presenceMap.get(deviceId)?.active;
        
        console.log(`[DEBUG] Checking Device Code: ${deviceCode}, ID: ${deviceId}`);
        // console.log(`[DEBUG] Map Keys:`, Array.from(presenceMap.keys())); // Commenting out to reduce log noise if map is huge

        if (!isOnlineByCode && !isOnlineById) {
            // console.log(`[DEBUG] Device failed online check.`);
            return false;
        }
      }

      return true;
    });

    if (!eligible.length) {
      return res.status(404).json({ success: false, message: 'No active wallet agent account available for this provider' });
    }

    const randomIndex = Math.floor(Math.random() * eligible.length);
    const chosen = eligible[randomIndex];

    // Try to load matching global template for this provider+gateway
    const tpl = await WalletAgentPaymentTemplate.findOne({
      provider: providerRaw,
      gateway: chosen.gateway || 'personal',
    }).lean();

    return res.json({
      success: true,
      method: {
        provider: chosen.provider,
        accountNumber: chosen.accountNumber,
        gateway: chosen.gateway,
        simIndex: chosen.simIndex,
        ownerName: chosen.owner?.name || null,
      },
      template: tpl
        ? {
            provider: tpl.provider,
            gateway: tpl.gateway,
            methodName: tpl.methodName || '',
            note: tpl.note || '',
            importantNote: tpl.importantNote || '',
            details: Array.isArray(tpl.details) ? tpl.details : [],
            image: tpl.image || '',
            color: tpl.color || '',
            bgColor: tpl.bgColor || '',
            buttonText: tpl.buttonText || '',
            buttonTextColor: tpl.buttonTextColor || '',
            buttonTextBgColor: tpl.buttonTextBgColor || '',
          }
        : null,
    });
  } catch (err) {
    console.error('opay-business random-payment-method error:', err);
    return res.status(500).json({ success: false, message: 'Server error while choosing payment method' });
  }
});

// GET /api/opay-business/payment-page/:code
// Used by payment-client to load amount & meta without exposing it in URL
router.get('/payment-page/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing code parameter' });
    }

    const session = await OpayBusinessPaymentSession.findOne({ code }).populate('business', 'name domain enabled');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    if (!session.business || !session.business.enabled) {
      return res.status(403).json({ success: false, message: 'Business disabled for this payment session' });
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'Payment session expired' });
    }

    // If opened before, allow access only within a short grace period (e.g. 30 seconds)
    // This handles React Strict Mode (double-render) and accidental refreshes immediately after loading.
    if (session.firstOpenedAt) {
      const timeSinceFirstOpen = new Date() - new Date(session.firstOpenedAt);
      if (timeSinceFirstOpen > 30 * 1000) {
        return res.status(410).json({ success: false, message: 'This payment link has already been used and is no longer valid.' });
      }
    } else {
      // First time opening
      session.firstOpenedAt = new Date();
      await session.save();
    }

    return res.json({
      success: true,
      code: session.code,
      amount: session.amount,
      user_identity_address: session.userIdentityAddress,
      callback_url: session.callbackUrl,
      success_redirect_url: session.successRedirectUrl,
      invoiceNumber: session.invoiceNumber || null,
      checkout_items: session.checkoutItems || null,
      business: {
        name: session.business.name,
        domain: session.business.domain,
      },
      expires_at: session.expiresAt || null,
      status: session.status,
    });
  } catch (err) {
    console.error('opay-business payment-page fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading payment page data' });
  }
});

// POST /api/opay-business/session-events/:code
// Called from the payment client to store detailed user footprint/events
router.post('/session-events/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing code parameter' });
    }

    const { type, meta } = req.body || {};
    if (!type || typeof type !== 'string' || type.length > 100) {
      return res.status(400).json({ success: false, message: 'Invalid event type' });
    }

    const now = new Date();
    const session = await OpayBusinessPaymentSession.findOne({ code });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    // Push event into timeline
    session.events.push({
      type,
      at: now,
      meta: meta || {},
    });

    // Track first open and last activity
    if (!session.firstOpenedAt && type === 'page_open') {
      session.firstOpenedAt = now;
    }
    session.lastActivityAt = now;

    await session.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('opay-business session-events error:', err);
    return res.status(500).json({ success: false, message: 'Server error while recording session event' });
  }
});

// GET /api/opay-business/payment-page-history
// Auth: Bearer token for OpayBusiness (merchant dashboard)
// Returns paginated list of generated payment page sessions
router.get('/payment-page-history', opayBusinessAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;



    const businessId = new mongoose.Types.ObjectId(String(req.user._id).trim());
    const query = { business: businessId };
    const trimmedStatus = status ? String(status).trim() : null;
    
    if (trimmedStatus && trimmedStatus !== 'all') {
      // Use case-insensitive regex for status matching to be robust
      query.status = { $regex: new RegExp(`^${trimmedStatus}$`, 'i') };
    }

    const [items, total, stats] = await Promise.all([
      OpayBusinessPaymentSession.find(query)
        .populate('paymentMessage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(query),
      OpayBusinessPaymentSession.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            successAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
            },
            unsuccessfulAmount: {
              $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$amount', 0] }
            },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
            },
            unsuccessfulCount: {
              $sum: { $cond: [{ $ne: ['$status', 'paid'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const summary = stats[0] || {
      totalAmount: 0,
      successAmount: 0,
      unsuccessfulAmount: 0,
      successCount: 0,
      unsuccessfulCount: 0
    };

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');

    const getAttemptedTrxId = (session) => {
      if (session?.lastVerificationFailure?.trxid) return String(session.lastVerificationFailure.trxid).trim();
      const attempts = Array.isArray(session?.verificationAttempts) ? session.verificationAttempts : [];
      for (let i = attempts.length - 1; i >= 0; i -= 1) {
        if (attempts[i]?.trxid) return String(attempts[i].trxid).trim();
      }
      const events = Array.isArray(session?.events) ? session.events : [];
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const type = String(events[i]?.type || '').toLowerCase();
        if (!type.includes('verify')) continue;
        const id = events[i]?.meta?.txid || events[i]?.meta?.trxid;
        if (id) return String(id).trim();
      }
      return null;
    };

    const attemptedTrxIds = [...new Set(items.map(getAttemptedTrxId).filter(Boolean))];
    const attemptedMessages = attemptedTrxIds.length
      ? await require('../models/PaymentMessage').find({ trxID: { $in: attemptedTrxIds } })
          .select('trxID amount fullMessage createdAt from masking deviceId deviceName type title')
          .lean()
      : [];
    const attemptedMessageMap = new Map(attemptedMessages.map((m) => [String(m.trxID || '').toLowerCase(), m]));

    const getLastVerifyResult = (session) => {
      const events = Array.isArray(session?.events) ? session.events : [];
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const type = String(events[i]?.type || '').toLowerCase();
        if (type === 'trx_verify_result') return events[i];
      }
      return null;
    };

    const data = items.map((s) => ({
      code: s.code,
      amount: s.amount,
      user_identity_address: s.userIdentityAddress,
      invoice_number: s.invoiceNumber || null,
      status: s.status || null,
      createdAt: s.createdAt,
      expires_at: s.expiresAt || null,
      payment_page_url: `${baseUrl}/payment/${s.code}`,
      callbackUrl: s.callbackUrl || null,
      successRedirectUrl: s.successRedirectUrl || null,
      checkoutItems: s.checkoutItems || null,
      footprintUrl: s.footprintUrl || `${baseUrl}/payment/${s.code}/mask/footprint`,
      footprintUrlNonMask: s.footprintUrlNonMask || `${baseUrl}/payment/${s.code}/footprint`,
      requestIp: s.requestIp || null,
      forwardedFor: s.forwardedFor || null,
      userAgent: s.userAgent || null,
      origin: s.origin || null,
      referer: s.referer || null,
      requestHost: s.requestHost || null,
      approxLocation: s.approxLocation || null,
      ipRequestCountLastHour: s.ipRequestCountLastHour || 0,
      events: Array.isArray(s.events) ? s.events : [],
      firstOpenedAt: s.firstOpenedAt || null,
      lastActivityAt: s.lastActivityAt || null,
      verificationAttempts: Array.isArray(s.verificationAttempts) ? s.verificationAttempts : [],
      lastVerificationFailure: s.lastVerificationFailure || null,
      lastVerificationSuccessAt: s.lastVerificationSuccessAt || null,
      paymentMessage: s.paymentMessage || null,
      attemptedTrxId: getAttemptedTrxId(s),
      attemptedPaymentMessage: (() => {
        const attemptedTrxId = getAttemptedTrxId(s);
        if (!attemptedTrxId) return null;
        return attemptedMessageMap.get(String(attemptedTrxId).toLowerCase()) || null;
      })(),
      lastVerifyResult: getLastVerifyResult(s),
    }));

    return res.json({ success: true, data, page: pageNum, total, summary, debugQuery: query });
  } catch (err) {
    console.error('opay-business payment-page-history error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading payment page history' });
  }
});

// GET /api/opay-business/session-events/:code
// Returns full session + ordered events timeline for visualization
router.get('/session-events/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing code parameter' });
    }

    const session = await OpayBusinessPaymentSession.findOne({ code }).populate('business', 'name domain').lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    const events = Array.isArray(session.events) ? [...session.events] : [];
    events.sort((a, b) => new Date(a.at) - new Date(b.at));

    return res.json({
      success: true,
      code: session.code,
      amount: session.amount,
      invoice_number: session.invoiceNumber || null,
      user_identity_address: session.userIdentityAddress,
      status: session.status,
      expires_at: session.expiresAt || null,
      requestIp: session.requestIp || null,
      approxLocation: session.approxLocation || null,
      ipRequestCountLastHour: session.ipRequestCountLastHour || 0,
      business: session.business || null,
      firstOpenedAt: session.firstOpenedAt || null,
      lastActivityAt: session.lastActivityAt || null,
      events,
    });
  } catch (err) {
    console.error('opay-business session-events GET error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading session events' });
  }
});
// ====================== AI FORENSIC VERIFICATION SERVICE ======================

function extractJson(text) {
  if (!text) return null;

  const source = String(text).trim();

  // Fast path: pure JSON
  try {
    return JSON.parse(source);
  } catch (e) {}

  // Recover from markdown code block
  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (e) {}
  }

  // Brace balancing - last resort
  const start = source.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        const candidate = source.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (e) {
          return null;
        }
      }
    }
  }
  return null;
}

// Gemini Client (Singleton)
let geminiClient = null;

async function getGeminiClient(apiKey) {
  if (geminiClient) return geminiClient;
  const { GoogleGenAI } = await import('@google/genai');
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

async function verifyWithGeminiAI(checkingDetails, smsHistory) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;   // ← .env থেকে নেওয়া হচ্ছে

  if (!GEMINI_API_KEY) {
    console.error('[AI VERIFICATION ERROR] GEMINI_API_KEY not found in .env');
    return null;
  }

  const data = {
    target_transaction: checkingDetails,
    sms_history: smsHistory
  };

  const prompt = `You are an Elite Payment Security AI. Your only job is to verify transaction authenticity using the supplied SMS history.

CRITICAL INSTRUCTIONS:
- Respond with **valid JSON only**. No explanations, no "Here is", no markdown.
- Never add any text outside the JSON object.

DECISION RULES:
1. TrxID not found → status: false, risk_flag: "none"
2. TrxID found but amount mismatch → status: false, risk_flag: "suspicious"
3. Balance progression invalid → status: false, risk_flag: "high_forgery_detected"
4. All checks pass → status: true, risk_flag: "none"

DATA TO ANALYZE:
${JSON.stringify(data, null, 2)}

OUTPUT (STRICT JSON ONLY):
{
  "status": true/false,
  "confidence": "high" | "medium" | "low",
  "reason": "Short technical explanation",
  "risk_flag": "none" | "suspicious" | "high_forgery_detected"
}`;

  // Model priority - Stable models first
  const modelCandidates = [
    process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
  ];

  for (const modelName of modelCandidates) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const ai = await getGeminiClient(GEMINI_API_KEY);

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.0,
            maxOutputTokens: 100,
            responseMimeType: 'application/json'
          }
        });

        const rawResponse = 
          response?.text || 
          response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log(`[AI] ${modelName} attempt ${attempt} | Raw: ${rawResponse.substring(0, 180)}...`);

        const parsed = extractJson(rawResponse);

        if (parsed && typeof parsed.status === 'boolean') {
          console.log(`[AI SUCCESS] Model=${modelName}, attempt=${attempt}`);
          parsed.modelUsed = modelName;
          return parsed;
        }

      } catch (error) {
        const statusCode = error?.status || error?.response?.status;
        console.error(`[AI ERROR] ${modelName} attempt ${attempt}:`, error.message);

        if (statusCode === 404) {
          console.log(`[AI] Model ${modelName} not available, trying next...`);
          break;
        }

        if ((statusCode === 429 || statusCode === 503) && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2200));
          continue;
        }
      }
    }
  }

  console.error('[AI VERIFICATION] All models and attempts failed');
  return null;
}

// Print function (তোমার আগেরটা রাখা হয়েছে)
function printAiResponse(aiResult, startedAtMs) {
  const tookMs = Date.now() - startedAtMs;
  const tookSec = (tookMs / 1000).toFixed(2);

  if (!aiResult) {
    console.log('\n================= AI FORENSIC RESPONSE =================');
    console.log('Status      : FAILED / EMPTY RESPONSE');
    console.log(`Duration    : ${tookSec}s`);
    console.log('========================================================\n');
    return;
  }

  console.log('\n================= AI FORENSIC RESPONSE =================');
  console.log(`Status      : ${aiResult.status ? 'VERIFIED' : 'REJECTED'}`);
  console.log(`Risk        : ${(aiResult.risk_flag || 'unknown').toUpperCase()}`);
  console.log(`Confidence  : ${(aiResult.confidence || 'unknown').toUpperCase()}`);
  console.log(`Reason      : ${aiResult.reason || 'N/A'}`);
  console.log(`Duration    : ${tookSec}s`);
  console.log('Raw JSON    :', JSON.stringify(aiResult, null, 2));
  console.log('========================================================\n');
}

// Webhook function (যেমন ছিল তেমনই রাখলাম)
function postAiResponseToWebhook(aiResult, checkingDetails, smsHistory) {
  if (!aiResult) return;
  
  const webhookUrl = process.env.AI_WEBHOOK_URL || 'https://api.oraclegames.live/api/webhooks/28da6b12708d9c975fea873c';
  
  const payload = {
    event: 'AI_FORENSIC_VERIFICATION_RESULT',
    timestamp: new Date().toISOString(),
    checking_details: checkingDetails,
    sms_count: Array.isArray(smsHistory) ? smsHistory.length : 0,
    ai_result: {
      status: aiResult.status,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
      risk_flag: aiResult.risk_flag
    }
  };

  axios.post(webhookUrl, payload)
    .then(() => console.log('[AI WEBHOOK] Posted to:', webhookUrl))
    .catch(err => console.error('[AI WEBHOOK ERROR]:', err.message));
}

// Main handler (যেমন ছিল)
async function runAiVerificationWithLoading(checkingDetails, smsHistory) {
  const startedAtMs = Date.now();

  console.log('\n================= AI FORENSIC READING ==================');
  console.log('Target      :', JSON.stringify(checkingDetails, null, 2));
  console.log(`SMS Count   : ${Array.isArray(smsHistory) ? smsHistory.length : 0}`);
  console.log('========================================================\n');

  let tick = 0;
  const loadingTimer = setInterval(() => {
    tick += 1;
    console.log(`[AI LOADING] Analyzing SMS${'.'.repeat((tick % 3) + 1)}`);
  }, 1200);

  try {
    const aiResult = await verifyWithGeminiAI(checkingDetails, smsHistory);
    printAiResponse(aiResult, startedAtMs);

    // Webhook posting disabled - not needed
    // if (aiResult) {
    //   postAiResponseToWebhook(aiResult, checkingDetails, smsHistory);
    // }
    return aiResult;
  } finally {
    clearInterval(loadingTimer);
  }
}

// POST /api/opay-business/verify-payment
// Verifies a transaction by checking PaymentMessage records with AI + manual checks
router.post('/verify-payment', async (req, res) => {
  try {
    const { code, trxid, agentAccountNumber, provider: providerParam } = req.body;

    if (!code || !trxid || !agentAccountNumber) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const session = await OpayBusinessPaymentSession.findOne({ code }).populate('business');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    if (session.status === 'paid') {
      return res.json({ success: true, message: 'Payment already verified', redirect_url: session.successRedirectUrl });
    }

    const trimmedTrxid = String(trxid || '').trim();
    const provider = providerParam ? String(providerParam).toLowerCase() : null;

    // Find PaymentMethod for device context
    const methodQuery = { accountNumber: agentAccountNumber, status: 'active' };
    if (provider) methodQuery.provider = provider;

    const method = await PaymentMethod.findOne(methodQuery).populate('device');
    if (!method || !method.device) {
      return res.status(400).json({ success: false, message: 'Invalid agent account' });
    }

    const deviceIdentifier = method.device.deviceCode || method.device.deviceName;

    // Get last 10 SMS for AI analysis
    const last10Sms = await require('../models/PaymentMessage').find({
      $or: [{ deviceId: deviceIdentifier }, { deviceName: deviceIdentifier }],
      type: 'sms'
    }).sort({ createdAt: -1 }).limit(10).lean();

    const smsList = last10Sms.map((sms, idx) => ({
      index: idx + 1,
      time: sms.deviceTime || sms.bdDateAndTimeZone || new Date(sms.createdAt).toLocaleString(),
      trxID: sms.trxID || 'N/A',
      amount: sms.amount || 'N/A',
      message: (sms.fullMessage || '').replace(/[\r\n]+/g, ' ')
    }));

    const checkingDetails = {
      trxid: trimmedTrxid || 'N/A',
      amount: session.amount || 'N/A',
      provider: provider ? provider.toUpperCase() : 'UNKNOWN',
      agent_account: agentAccountNumber || 'N/A',
      device_id: deviceIdentifier || 'N/A'
    };

    // Run AI verification
    const aiResult = await runAiVerificationWithLoading(checkingDetails, smsList);

    session.aiVerification = {
      aiChecked: !!aiResult,
      status: aiResult ? aiResult.status : null,
      reason: aiResult ? aiResult.reason : null,
      risk_flag: aiResult ? aiResult.risk_flag : null,
      confidence: aiResult ? aiResult.confidence : null,
      model: aiResult ? aiResult.modelUsed : null,
      methodUsed: (aiResult && aiResult.status === true) ? 'ai_and_manual' : 'manual_fallback',
      promptData: {
        target_transaction: checkingDetails,
        sms_history: smsList
      }
    };
    await session.save();

    if (aiResult && aiResult.status === false) {
      console.log(`[CRITICAL ALERT] Transaction ${trimmedTrxid} BLOCKED by AI: ${aiResult.reason}`);
      return res.status(400).json({
        success: false,
        message: aiResult.reason || 'Transaction rejected by AI',
        reasonCode: 'AI_REJECTED',
        aiRisk: aiResult.risk_flag
      });
    }

    if (aiResult && aiResult.status === true) {
      console.log(`[AI APPROVED] Transaction ${trimmedTrxid} passed AI verification`);
    } else {
      console.log('[AI FALLBACK] AI failed, proceeding with manual checks');
    }

    // Manual verification checks (TrxID, Amount, Provider, Device, Time)
    const trxRegex = new RegExp(`^${trimmedTrxid}$`, 'i');
    const matchedMessage = await require('../models/PaymentMessage').findOne({ trxID: trxRegex });

    if (!matchedMessage) {
      return res.status(400).json({ success: false, message: 'Transaction ID not found', reasonCode: 'TRX_NOT_FOUND' });
    }

    if (matchedMessage.verify) {
      return res.status(400).json({ success: false, message: 'Transaction ID already used', reasonCode: 'TRX_USED' });
    }

    // Amount check
    if (Math.abs(Number(matchedMessage.amount) - Number(session.amount)) > 0.5) {
      return res.status(400).json({ success: false, message: 'Amount mismatch', reasonCode: 'AMOUNT_MISMATCH' });
    }

    // Time check (10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (matchedMessage.createdAt < tenMinutesAgo) {
      return res.status(400).json({ success: false, message: 'Transaction too old', reasonCode: 'TRX_TOO_OLD' });
    }

    // Device check
    const msgDeviceId = matchedMessage.deviceId;
    const agentDeviceCode = method.device.deviceCode;
    if (agentDeviceCode && msgDeviceId && agentDeviceCode !== msgDeviceId) {
      return res.status(400).json({ success: false, message: 'Device mismatch', reasonCode: 'DEVICE_MISMATCH' });
    }

    // Mark verified
    matchedMessage.verify = true;
    await matchedMessage.save();

    session.status = 'paid';
    session.paymentMessage = matchedMessage._id;

    // ── Wallet Agent Credit Deduction ──
    const paymentAmount = Number(session.amount) || 0;
    let walletAgentSnapshot = null;
    let merchantSnapshot = null;

    try {
      // Load wallet agent from payment method owner
      const agentUser = await User.findById(method.owner).select('name credit minimumCredit');
      if (agentUser) {
        const creditBefore = agentUser.credit || 0;
        const creditAfter = Math.max(0, creditBefore - paymentAmount);
        agentUser.credit = creditAfter;
        await agentUser.save();

        walletAgentSnapshot = {
          agentId: agentUser._id,
          agentName: agentUser.name || 'Unknown Agent',
          creditBefore,
          creditAfter,
          creditDeducted: paymentAmount,
        };

        session.walletAgentSnapshot = walletAgentSnapshot;
        console.log(`[CREDIT DEDUCTED] Agent: ${agentUser.name}, Before: ৳${creditBefore}, After: ৳${creditAfter}, Deducted: ৳${paymentAmount}`);
      }
    } catch (creditErr) {
      console.error('[CREDIT DEDUCTION ERROR]', creditErr.message);
    }

    // ── Merchant Balance Snapshot (Read-only, no double-count) ──
    // NOTE: availableBalance is auto-calculated as sum(paid sessions) - withdrawals + balanceAdjustment
    // We do NOT touch balanceAdjustment here to avoid double-counting.
    // We just record a snapshot for the admin dashboard display.
    try {
      const business = await require('../models/OpayBusiness').findById(session.business._id || session.business).select('name balanceAdjustment');
      if (business) {
        // Calculate current balance before this payment (sum of all OTHER paid sessions)
        const previousPaidTotal = await OpayBusinessPaymentSession.aggregate([
          { $match: { business: business._id, status: 'paid', _id: { $ne: session._id } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const balanceBefore = (previousPaidTotal[0]?.total || 0) + (business.balanceAdjustment || 0);
        const balanceAfter = balanceBefore + paymentAmount;

        merchantSnapshot = {
          businessId: business._id,
          businessName: business.name || 'Unknown Merchant',
          balanceBefore,
          balanceAfter,
          balanceAdded: paymentAmount,
        };

        session.merchantSnapshot = merchantSnapshot;
        console.log(`[MERCHANT SNAPSHOT] ${business.name}: Before ৳${balanceBefore} → After ৳${balanceAfter} (+৳${paymentAmount})`);
      }
    } catch (balErr) {
      console.error('[MERCHANT SNAPSHOT ERROR]', balErr.message);
    }

    await session.save();
    console.log(`[VERIFY SUCCESS] Transaction ${trimmedTrxid} verified and marked as paid`);

    // Fire callback to client webhook with verification details (non-blocking)
    try {
      const callbackUrl = session.callbackUrl;
      if (callbackUrl && /^https?:\/\//i.test(callbackUrl)) {
        const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');
        const footprintUrlMasked = session.footprintUrl || `${baseUrl}/payment/${session.code}/mask/footprint`;

          const payload = {
          status: 'COMPLETED',
          amount: Number(matchedMessage.amount),
          transaction_id: matchedMessage.trxID,
          invoice_number: session.invoiceNumber || null,
          session_code: session.code,
          user_identity: session.userIdentityAddress || null,
          checkout_items: session.checkoutItems || null,
          bank: providerParam ? String(providerParam).toLowerCase() : null,
          footprint: footprintUrlMasked
        };
        axios.post(callbackUrl, payload, { timeout: 5000 })
          .then(async (res) => {
            session.callbackResult = {
              success: true,
              statusCode: res.status,
              payloadSent: payload,
              responseReceived: res.data
            };
            await session.save();
          })
          .catch(async (err) => {
            session.callbackResult = {
              success: false,
              error: err?.message || 'Unknown error',
              payloadSent: payload,
              responseReceived: err?.response?.data || null
            };
            await session.save();
            console.warn('OpayBusiness Callback POST failed:', err?.message || err);
          });
      }
    } catch (cbErr) {
      console.warn('OpayBusiness Callback handling error:', cbErr?.message || cbErr);
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      redirect_url: session.successRedirectUrl
    });

  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ success: false, message: 'Server error during verification' });
  }
});

module.exports = router;


function maskIp(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 3).join(':')}:*`;
  }
  return 'masked';
}

function buildFallbackFootprint(session) {
  const headers = session.requestHeaders || {};
  return {
    code: session.code,
    status: session.status,
    createdAt: session.createdAt || null,
    firstOpenedAt: session.firstOpenedAt || null,
    lastActivityAt: session.lastActivityAt || null,
    requestIp: session.requestIp || null,
    forwardedFor: session.forwardedFor || null,
    userAgent: session.userAgent || null,
    origin: session.origin || null,
    referer: session.referer || null,
    requestHost: session.requestHost || null,
    approxLocation: session.approxLocation || null,
    ipRequestCountLastHour: session.ipRequestCountLastHour || 0,
    requestHeaders: headers,
    note: 'Verification footprint not captured yet. Showing request-level footprint.',
  };
}

function buildMaskedFallbackFootprint(session) {
  const raw = buildFallbackFootprint(session);
  const headers = { ...(raw.requestHeaders || {}) };
  if (headers['x-opay-business-token']) {
    headers['x-opay-business-token'] = '********';
  }
  if (headers['x_opay_business_token']) {
    headers['x_opay_business_token'] = '********';
  }
  return {
    ...raw,
    requestIp: maskIp(raw.requestIp),
    forwardedFor: raw.forwardedFor ? 'masked' : null,
    userAgent: raw.userAgent ? raw.userAgent.slice(0, 40) + '...' : null,
    requestHeaders: headers,
  };
}

// Removed redundant dashboard-overview route

// GET /api/opay-business/footprint/:code
// Returns the MASKED footprint for a session (Publicly accessible via the footprint URL)
router.get('/footprint/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const session = await OpayBusinessPaymentSession.findOne({ code }).select(
      'code status createdAt firstOpenedAt lastActivityAt requestIp forwardedFor userAgent origin referer requestHost requestHeaders approxLocation ipRequestCountLastHour verificationFootprintMasked'
    );
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    return res.json({
      success: true,
      footprint: session.verificationFootprintMasked || buildMaskedFallbackFootprint(session)
    });
  } catch (err) {
    console.error('footprint fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/opay-business/footprint-raw/:code
// Returns NON-MASKED footprint for admin/security analysis
router.get('/footprint-raw/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const session = await OpayBusinessPaymentSession.findOne({ code }).select(
      'code status createdAt firstOpenedAt lastActivityAt requestIp forwardedFor userAgent origin referer requestHost requestHeaders approxLocation ipRequestCountLastHour verificationFootprint'
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    return res.json({
      success: true,
      footprint: session.verificationFootprint || buildFallbackFootprint(session)
    });
  } catch (err) {
    console.error('footprint fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/opay-business/dashboard-overview
// Auth: Bearer token for OpayBusiness (merchant dashboard)
// Returns totals + per-day breakdown for the last N days
router.get('/dashboard-overview', opayBusinessAuth, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const businessId = req.user._id;

    // All sessions for this merchant in the date range
    const sessions = await OpayBusinessPaymentSession.find({
      business: businessId,
      createdAt: { $gte: since },
    }).lean();

    // Totals
    const totalGenerated = sessions.length;
    const successSessions = sessions.filter(s => s.status === 'paid');
    const totalSuccess = successSessions.length;
    const totalSuccessAmount = successSessions.reduce((sum, s) => sum + (s.amount || 0), 0);

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const generatedToday = sessions.filter(s => new Date(s.createdAt) >= todayStart).length;
    const successToday = sessions.filter(s => s.status === 'paid' && new Date(s.createdAt) >= todayStart).length;
    const successAmountToday = sessions
      .filter(s => s.status === 'paid' && new Date(s.createdAt) >= todayStart)
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    const dailyMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, successAmount: 0, successCount: 0, generatedCount: 0 };
    }
    for (const s of sessions) {
      const key = new Date(s.createdAt).toISOString().slice(0, 10);
      if (!dailyMap[key]) continue;
      dailyMap[key].generatedCount += 1;
      if (s.status === 'paid') {
        dailyMap[key].successCount += 1;
        dailyMap[key].successAmount += s.amount || 0;
      }
    }
    const daily = Object.values(dailyMap);

    // --- ABSOLUTE TOTALS for Available Balance (Unfiltered by date range) ---
    const allPaidSessions = await OpayBusinessPaymentSession.find({
      business: businessId,
      status: 'paid'
    }).select('amount').lean();
    
    const absoluteTotalSuccessAmount = allPaidSessions.reduce((sum, s) => sum + (s.amount || 0), 0);

    const withdrawals = await MerchantWithdrawal.find({
      merchantId: businessId,
      status: { $in: ['approved', 'pending'] }
    }).lean();
    
    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const business = await OpayBusiness.findById(businessId).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;

    const availableBalance = absoluteTotalSuccessAmount - totalWithdrawalAmount + balanceAdjustment;
    const withdrawalConfig = await getWithdrawalConfig();

    return res.json({
      success: true,
      data: {
        totals: { 
          totalGenerated, 
          totalSuccess, 
          totalSuccessAmount, 
          totalWithdrawalAmount, 
          availableBalance,
          absoluteTotalSuccessAmount 
        },
        withdrawalConfig,
        today: { generatedToday, successToday, successAmountToday },
        daily,
      },
    });
  } catch (err) {
    console.error('opay-business dashboard-overview error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading dashboard overview' });
  }
});

// POST /api/opay-business/withdraw
// Auth: Bearer token for OpayBusiness (merchant dashboard)
// Submit a withdrawal request
router.post('/withdraw', opayBusinessAuth, async (req, res) => {
  try {
    const { amount, method } = req.body;
    const businessId = req.user._id;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!method) {
      return res.status(400).json({ success: false, message: 'Please select a withdrawal method' });
    }

    const { minAmount, commissionPercent } = await getWithdrawalConfig();

    if (Number(amount) < minAmount) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal amount is ${minAmount}` });
    }

    // Calculate available balance to prevent over-withdrawal
    const sessions = await OpayBusinessPaymentSession.find({
        business: businessId,
        status: 'paid'
    }).select('amount').lean();
    const totalSuccessAmount = sessions.reduce((sum, s) => sum + (s.amount || 0), 0);

    const withdrawals = await MerchantWithdrawal.find({
        merchantId: businessId,
        status: { $in: ['approved', 'pending'] }
    }).select('amount').lean();
    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const business = await OpayBusiness.findById(businessId).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;

    const availableBalance = totalSuccessAmount - totalWithdrawalAmount + balanceAdjustment;

    if (amount > availableBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const requestedAmount = Number(amount);
    const commissionAmount = (requestedAmount * commissionPercent) / 100;
    const receiveAmount = requestedAmount - commissionAmount;

    // Create the withdrawal request
    const withdrawal = new MerchantWithdrawal({
      merchantId: businessId,
      amount: requestedAmount,
      commissionPercent,
      commissionAmount,
      receiveAmount,
      method,
      status: 'pending'
    });

    await withdrawal.save();

    return res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal,
      summary: {
        requestedAmount,
        commissionPercent,
        commissionAmount,
        receiveAmount,
      }
    });
  } catch (err) {
    console.error('opay-business withdraw error:', err);
    return res.status(500).json({ success: false, message: 'Server error during withdrawal request' });
  }
});

// GET /api/opay-business/withdrawal-config
// Auth: Bearer token for OpayBusiness
// Returns admin-controlled minimum withdrawal and commission percent
router.get('/withdrawal-config', opayBusinessAuth, async (_req, res) => {
  try {
    const config = await getWithdrawalConfig();
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('opay-business withdrawal-config error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading withdrawal config' });
  }
});

// GET /api/opay-business/withdrawals
// Auth: Bearer token for OpayBusiness (merchant dashboard)
// List withdrawals for this merchant
router.get('/withdrawals', opayBusinessAuth, async (req, res) => {
    try {
        const businessId = req.user._id;
        const items = await MerchantWithdrawal.find({ merchantId: businessId }).sort({ createdAt: -1 }).lean();
        return res.json({ success: true, data: items || [] });
    } catch (err) {
        console.error('opay-business withdrawals error:', err);
        return res.status(500).json({ success: false, message: 'Server error while loading withdrawals history' });
    }
});

module.exports = router;
