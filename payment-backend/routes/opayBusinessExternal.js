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
const OpayBusinessPackage = require('../models/OpayBusinessPackage');
const MerchantWithdrawal = require('../models/MerchantWithdrawal');
const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
const MerchantTopupRecord = require('../models/MerchantTopupRecord');
const Setting = require('../models/Setting');
const { default: mongoose } = require('mongoose');

const WITHDRAW_MIN_KEY = 'merchant_withdraw_min_amount';
const WITHDRAW_COMMISSION_KEY = 'merchant_withdraw_commission_percent';

async function getWithdrawalConfig() {
  const [minSetting, commissionSetting, minAutoWithdrawSetting, topupFeeTypeSetting, topupFeeValueSetting] = await Promise.all([
    Setting.findOne({ key: WITHDRAW_MIN_KEY }).lean(),
    Setting.findOne({ key: WITHDRAW_COMMISSION_KEY }).lean(),
    Setting.findOne({ key: 'merchant_auto_withdraw_min_balance' }).lean(),
    Setting.findOne({ key: 'merchant_topup_fee_type' }).lean(),
    Setting.findOne({ key: 'merchant_topup_fee_value' }).lean(),
  ]);

  const minAmount = Number(minSetting?.value);
  const commissionPercent = Number(commissionSetting?.value);
  const minAutoWithdrawBalance = Number(minAutoWithdrawSetting?.value || 0);
  const topupFeeType = topupFeeTypeSetting?.value || 'percentage';
  const topupFeeValue = Number(topupFeeValueSetting?.value || 0);

  return {
    minAmount: Number.isFinite(minAmount) && minAmount >= 0 ? minAmount : 10000,
    commissionPercent: Number.isFinite(commissionPercent) && commissionPercent >= 0 ? commissionPercent : 0,
    minAutoWithdrawBalance: Number.isFinite(minAutoWithdrawBalance) ? minAutoWithdrawBalance : 0,
    topupFeeType,
    topupFeeValue: Number.isFinite(topupFeeValue) ? topupFeeValue : 0,
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

// POST /api/opay-business/auto-withdraw
// Header: X-Opay-Business-Token: <business apiToken>
// Body:
//   amount                   (number, required)
//   payment_method           (string, required)
//   user_identity_address    (string, required)
//   callback_url             (string, required)
//   checkout_items           (array, required)
router.post('/auto-withdraw', async (req, res) => {
  try {
    const headerToken = req.header('X-Opay-Business-Token')
      || req.header('x-opay-business-token')
      || req.header('opay-business-token');

    if (!headerToken || typeof headerToken !== 'string' || !headerToken.trim()) {
      return res.status(400).json({ success: false, message: 'Missing or invalid X-Opay-Business-Token header' });
    }

    const apiToken = headerToken.trim();
    const business = await OpayBusiness.findOne({ apiToken });

    if (!business) {
      return res.status(401).json({ success: false, message: 'Invalid business token' });
    }

    if (!business.enabled) {
      return res.status(403).json({ success: false, message: 'Business is disabled' });
    }

    const { amount, payment_method, user_identity_address, callback_url, checkout_items, account_number } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (!payment_method || typeof payment_method !== 'string') {
      return res.status(400).json({ success: false, message: 'payment_method is required' });
    }
    if (!user_identity_address || typeof user_identity_address !== 'string') {
      return res.status(400).json({ success: false, message: 'user_identity_address is required' });
    }
    if (!callback_url || typeof callback_url !== 'string' || !/^https?:\/\//i.test(callback_url)) {
      return res.status(400).json({ success: false, message: 'Valid callback_url is required' });
    }
    if (!checkout_items || !Array.isArray(checkout_items)) {
      return res.status(400).json({ success: false, message: 'checkout_items array is required' });
    }
    if (!account_number || typeof account_number !== 'string') {
      return res.status(400).json({ success: false, message: 'account_number is required' });
    }

    // Check Merchant Balance
    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    
    // Calculate total paid success amount
    const sessions = await OpayBusinessPaymentSession.find({ business: business._id, status: 'paid' }).select('amount').lean();
    const totalSuccessAmount = sessions.reduce((sum, s) => sum + (s.amount || 0), 0);

    // Calculate regular merchant withdrawals
    const withdrawals = await MerchantWithdrawal.find({ merchantId: business._id, status: { $in: ['approved', 'pending'] } }).select('amount').lean();
    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    
    // Calculate previous auto-withdrawals that are pending/booked/completed
    const autoWithdrawals = await AutoWithdrawalRequest.find({ merchant: business._id, status: { $in: ['pending', 'booked', 'completed'] } }).select('amount').lean();
    const totalAutoWithdrawalAmount = autoWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const balanceAdjustment = business.balanceAdjustment || 0;

    const availableBalance = totalSuccessAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + balanceAdjustment;

    const minBalanceSetting = await Setting.findOne({ key: 'merchant_auto_withdraw_min_balance' }).lean();
    const minAutoWithdrawBalance = Number(minBalanceSetting?.value || 0);

    if (amount > availableBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance for auto withdrawal' });
    }
    
    if (availableBalance - Number(amount) < minAutoWithdrawBalance) {
      return res.status(400).json({ success: false, message: `Insufficient balance. You must maintain a minimum balance of ৳${minAutoWithdrawBalance}.` });
    }

    const request = await AutoWithdrawalRequest.create({
      merchant: business._id,
      amount: Number(amount),
      paymentMethod: payment_method,
      userIdentityAddress: user_identity_address,
      accountNumber: account_number,
      callbackUrl: callback_url,
      checkoutItems: checkout_items,
      status: 'pending'
    });

    // Broadcast to wallet agents
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new_auto_withdrawal', request);
    }

    return res.json({
      success: true,
      message: 'Auto withdrawal request created',
      data: request
    });
  } catch (err) {
    console.error('auto-withdraw api error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/opay-business/auto-withdraw/cancel
// Header: X-Opay-Business-Token: <business apiToken>
// Body:
//   withdrawal_id (string, required)
router.post('/auto-withdraw/cancel', async (req, res) => {
  try {
    const headerToken = req.header('X-Opay-Business-Token')
      || req.header('x-opay-business-token')
      || req.header('opay-business-token');

    if (!headerToken || typeof headerToken !== 'string' || !headerToken.trim()) {
      return res.status(400).json({ success: false, message: 'Missing or invalid X-Opay-Business-Token header' });
    }

    const apiToken = headerToken.trim();
    const business = await OpayBusiness.findOne({ apiToken });

    if (!business) {
      return res.status(401).json({ success: false, message: 'Invalid business token' });
    }

    if (!business.enabled) {
      return res.status(403).json({ success: false, message: 'Business is disabled' });
    }

    const { withdrawal_id } = req.body;
    if (!withdrawal_id) {
      return res.status(400).json({ success: false, message: 'withdrawal_id is required' });
    }

    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    const request = await AutoWithdrawalRequest.findOne({ _id: withdrawal_id, merchant: business._id });
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be cancelled' });
    }
    
    request.status = 'cancelled';
    await request.save();
    
    // Broadcast to agents so it's removed from their UI
    const io = req.app.get('socketio');
    if (io) {
      io.emit('auto_withdrawal_cancelled', request._id);
    }
    
    return res.json({
      success: true,
      message: 'Auto withdrawal cancelled successfully',
      data: {
        withdrawal_id: request._id,
        status: request.status
      }
    });
  } catch (err) {
    console.error('auto-withdraw cancel external api error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/opay-business/auto-withdraw/history
router.get('/auto-withdraw/history', opayBusinessAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    const query = { merchant: req.user._id };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));

    const total = await AutoWithdrawalRequest.countDocuments(query);
    const withdrawals = await AutoWithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean();

    return res.json({ success: true, data: withdrawals, total });
  } catch (err) {
    console.error('Auto withdraw history error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/opay-business/auto-withdraw/:id/cancel
router.post('/auto-withdraw/:id/cancel', opayBusinessAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    
    const request = await AutoWithdrawalRequest.findOne({ _id: id, merchant: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending requests can be cancelled' });
    }
    
    request.status = 'cancelled';
    await request.save();
    
    // Broadcast to agents so it's removed from their UI
    const io = req.app.get('socketio');
    if (io) {
      io.emit('auto_withdrawal_cancelled', request._id);
    }
    
    // Send Webhook to Merchant
    if (request.callbackUrl) {
      const axios = require('axios');
      axios.post(request.callbackUrl, {
        status: 'CANCELLED',
        withdrawal_id: request._id,
        amount: request.amount,
        payment_method: request.paymentMethod,
        user_identity_address: request.userIdentityAddress,
        checkout_items: request.checkoutItems
      }).catch(err => console.error('Cancel webhook failed:', err.message));
    }
    
    return res.json({ success: true, message: 'Withdrawal cancelled successfully' });
  } catch (err) {
    console.error('Cancel auto withdraw error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
      expiry_minutes,
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

    if (!success_redirect_url || typeof success_redirect_url !== 'string' || (success_redirect_url !== 'AUTO_SUCCESS_PAGE' && !/^https?:\/\//i.test(success_redirect_url))) {
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

    // Optional: set an expiry (defaults to 30 minutes from now)
    const expiryMin = Number(expiry_minutes);
    const validExpiry = Number.isInteger(expiryMin) && expiryMin > 0 ? expiryMin : 30;
    const expiresAt = new Date(Date.now() + validExpiry * 60 * 1000);

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');
    let resolvedSuccessUrl = success_redirect_url;
    if (success_redirect_url === 'AUTO_SUCCESS_PAGE') {
      resolvedSuccessUrl = `${baseUrl}/payment/${shortCode}/success`;
    } else if (resolvedSuccessUrl && resolvedSuccessUrl.includes('{code}')) {
      resolvedSuccessUrl = resolvedSuccessUrl.replace('{code}', shortCode);
    }

    // Persist session for this payment so frontend can load it by code
    await OpayBusinessPaymentSession.create({
      code: shortCode,
      business: business._id,
      amount: amountNumber,
      userIdentityAddress: user_identity_address,
      callbackUrl: callback_url,
      successRedirectUrl: resolvedSuccessUrl,
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
    if (session.status !== 'paid') {
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

// GET /api/opay-business/payment-receipt/:code
// Public endpoint to load receipt details without any single-use lock
router.get('/payment-receipt/:code', async (req, res) => {
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

    if (session.status === 'paid' && session.checkoutItems && session.checkoutItems.type === 'Activation Payment' && session.checkoutItems.merchantIdToActivate) {
      try {
        const merchantToActivate = await OpayBusiness.findById(session.checkoutItems.merchantIdToActivate);
        if (merchantToActivate && !merchantToActivate.isLifetimePaid) {
          merchantToActivate.isLifetimePaid = true;
          await merchantToActivate.save();
          console.log(`[ACTIVATION FALLBACK SUCCESS] Activated merchant ${merchantToActivate.email}`);
        }
      } catch (e) {
        console.error('[ACTIVATION FALLBACK ERROR]', e);
      }
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
    console.error('opay-business payment-receipt fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading payment receipt data' });
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

// DELETE /api/opay-business/payment-page-history/:code
// Delete an unpaid session that has not been opened yet
router.delete('/payment-page-history/:code', opayBusinessAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const businessId = new mongoose.Types.ObjectId(String(req.user._id).trim());

    const session = await OpayBusinessPaymentSession.findOne({ code, business: businessId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    if (session.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Paid sessions cannot be deleted' });
    }

    if (session.firstOpenedAt) {
      return res.status(400).json({ success: false, message: 'Opened sessions cannot be deleted. Expire them instead.' });
    }

    await session.deleteOne();
    return res.json({ success: true, message: 'Payment session deleted successfully' });
  } catch (err) {
    console.error('opay-business payment-page-history delete error:', err);
    return res.status(500).json({ success: false, message: 'Server error while deleting payment session' });
  }
});

// POST /api/opay-business/payment-page-history/:code/expire
// Force-expire a session even if it has already been opened
router.post('/payment-page-history/:code/expire', opayBusinessAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const businessId = new mongoose.Types.ObjectId(String(req.user._id).trim());

    const session = await OpayBusinessPaymentSession.findOne({ code, business: businessId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    if (session.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Paid sessions cannot be expired manually' });
    }

    session.status = 'expired';
    session.expiresAt = session.expiresAt || new Date();
    await session.save();

    return res.json({ success: true, message: 'Payment session expired successfully', data: session });
  } catch (err) {
    console.error('opay-business payment-page-history expire error:', err);
    return res.status(500).json({ success: false, message: 'Server error while expiring payment session' });
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
  } catch (e) { }

  // Recover from markdown code block
  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (e) { }
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

// সহায়ক ফাংশন: সেফলি JSON এক্সট্র্যাক্ট করার জন্য
function safeParseJson(text) {
  try {
    if (!text) return null;
    // যদি markdown কোড ব্লকে ঘেরা থাকে (```json ... ```), তা ক্লিন করা হচ্ছে
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error('[JSON PARSE ERROR] Failed to parse AI response:', e.message);
    return null;
  }
}

async function verifyWithGeminiAI(checkingDetails, smsHistory) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error('[AI VERIFICATION ERROR] GEMINI_API_KEY not found in .env');
    return { status: false, confidence: "low", reason: "API Key missing", risk_flag: "none" };
  }

  // ======================================================================
  // ⚡ [CRITICAL MATH VALIDATOR] NAGAD ৫০০ টাকা টলারেন্স হার্ড-চেক (Skipped per user request)
  // ======================================================================
  /*
  if (checkingDetails && checkingDetails.provider && checkingDetails.provider.toUpperCase() === 'NAGAD') {
    if (Array.isArray(smsHistory) && smsHistory.length >= 2) {

      const balanceRegex = /Balance:\s*(?:Tk\s*)?([\d,.]+)/i;
      const cleanNum = (str) => parseFloat(str.replace(/,/g, ''));

      const match1 = smsHistory[0].message.match(balanceRegex);
      const match2 = smsHistory[1].message.match(balanceRegex);

      if (match1 && match2) {
        const currentBalance = cleanNum(match1[1]);
        const previousBalance = cleanNum(match2[1]);
        const txAmount = parseFloat(smsHistory[0].amount || 0);

        let expectedBalance = previousBalance;
        const msgText = smsHistory[0].message.toLowerCase();

        if (msgText.includes('received') || msgText.includes('cash in') || msgText.includes('money received')) {
          expectedBalance += txAmount;
        } else {
          expectedBalance -= txAmount;
        }

        const actualGap = Math.abs(currentBalance - expectedBalance);

        if (actualGap > 500.0) {
          console.log(`[CORE REJECTION] Nagad Balance Gap (${actualGap.toFixed(2)} Tk) exceeded 500 Tk limit!`);
          return {
            status: false,
            confidence: "high",
            reason: `Critical balance anomaly. Expected balance ${expectedBalance.toFixed(2)} Tk, but found ${currentBalance.toFixed(2)} Tk. Gap of ${actualGap.toFixed(2)} Tk exceeds allowed 500 Tk tolerance.`,
            risk_flag: "high_forgery_detected",
            modelUsed: "Core-Math-Validator"
          };
        }
      }
    }
  }
  */
  // ======================================================================

  const promptText = JSON.stringify({
    checkingDetails,
    smsList: smsHistory
  }, null, 2);

  const systemInstruction =
    "You are an Elite Payment Security AI. Your task is to verify the authenticity of the target transaction.\n\n" +
    "Input format: You will receive a JSON object containing `checkingDetails` (the target transaction to verify) and `smsList` (SMS messages received by the device, sorted newest to oldest).\n\n" +
    "Verification Logic:\n" +
    "1. Find the target SMS message in `smsList` that matches `checkingDetails.trxid` (case-insensitive search, e.g., 'DFP8NYNNJJ').\n" +
    "2. If the target SMS is not found in the list, set `status` to false, `confidence` to 'HIGH', `reason` to 'Transaction TrxID not found in the SMS list.', and `risk_flag` to 'TRX_NOT_FOUND'.\n" +
    "3. If found, verify that the transaction amount in that target SMS matches `checkingDetails.amount` exactly.\n" +
    "4. Do NOT check or verify the balance history, balance calculations, or balance changes. Ignore any balance discrepancies or balance gaps entirely. As long as the TrxID and amount match and the SMS text is structurally authentic, the transaction must be considered valid.\n" +
    "5. Evaluate the result:\n" +
    "   - Set `status` to true if the transaction is authentic (matching TrxID, amount, provider) and structurally correct. Set `risk_flag` to 'NONE' and explain the verification (e.g., 'Transaction found with matching TrxID and amount').\n" +
    "   - Set `status` to false ONLY if there is a clear detail mismatch, the TrxID is not found, or there is strong evidence of message forgery (e.g., invalid SMS header/format). Do NOT set status to false for balance-related reasons.\n" +
    "6. Your output must strictly follow the JSON response schema. Do not output anything other than raw JSON.";

  const modelName = 'gemini-2.5-pro';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[AI INFO] Calling ${modelName}, attempt ${attempt}...`);
      const ai = await getGeminiClient(GEMINI_API_KEY);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.0,
          maxOutputTokens: 8000,
          responseMimeType: 'application/json',
          responseSchema: {
            type: "OBJECT",
            properties: {
              status: { type: "BOOLEAN" },
              confidence: { type: "STRING" },
              reason: { type: "STRING" },
              risk_flag: { type: "STRING" }
            },
            required: ["status", "confidence", "reason", "risk_flag"]
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        }
      });

      const rawResponse = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = extractJson(rawResponse);

      if (parsed && typeof parsed.status === 'boolean') {
        parsed.modelUsed = modelName;
        return parsed;
      } else {
        console.error(`[PARSE WARNING] ${modelName} attempt ${attempt} failed to parse JSON.`);
        console.error(`[RAW AI OUTPUT]: "${rawResponse}"`);
      }
    } catch (error) {
      console.error(`[AI ERROR] ${modelName} attempt ${attempt}:`, error.message);
    }
  }

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
  console.log('Target       :', JSON.stringify(checkingDetails, null, 2));
  console.log(`SMS Count   : ${Array.isArray(smsHistory) ? smsHistory.length : 0}`);
  console.log('========================================================\n');

  // --- [ক্রিটিক্যাল কোড চেক] NAGAD এর ব্যালেন্স ফ্লো ম্যাথমেটিক্যাল চেক (Skipped per user request) ---
  // --- [ক্রিটিক্যাল কোড চেক] NAGAD এর ৫০০ টাকা টলারেন্স ব্যালেন্স চেক ---
  /*
  if (checkingDetails && checkingDetails.provider && checkingDetails.provider.toUpperCase() === 'NAGAD') {
    if (Array.isArray(smsHistory) && smsHistory.length >= 2) {

      const balanceRegex = /Balance:\s*(?:Tk\s*)?([\d,.]+)/i;
      const commRegex = /Comm:\s*(?:Tk\s*)?([\d.]+)/i;

      // কমা (,) থাকলে তা রিমুভ করে ফ্লোট-এ কনভার্ট করার ফাংশন
      const cleanNum = (str) => parseFloat(str.replace(/,/g, ''));

      const match1 = smsHistory[0].message.match(balanceRegex);
      const match2 = smsHistory[1].message.match(balanceRegex);
      const commMatch = smsHistory[0].message.match(commRegex);

      if (match1 && match2) {
        const currentBalance = cleanNum(match1[1]); // ইন্ডেক্স ১ এর ব্যালেন্স (उदा. 358028.70)
        const previousBalance = cleanNum(match2[1]); // ইন্ডেক্স ২ এর ব্যালেন্স (उदा. 257808.94)
        const txAmount = parseFloat(smsHistory[0].amount || 0);
        const commission = commMatch ? parseFloat(commMatch[1]) : 0;

        let expectedBalance = previousBalance;
        const msgText = smsHistory[0].message.toLowerCase();

        // ক্যাশ আউট রিসিভ হলে এজেন্টের ব্যালেন্স বাড়ে (অ্যামাউন্ট + কমিশন)
        if (msgText.includes('received') || msgText.includes('cash in') || msgText.includes('money received')) {
          expectedBalance += (txAmount + commission);
        } else if (msgText.includes('cash out') || msgText.includes('pay') || msgText.includes('recharge')) {
          expectedBalance -= txAmount;
        }

        // ৫০০ টাকার বেশি এদিক-সেদিক বা অমিল হলে সরাসরি রিজেক্ট
        const actualGap = Math.abs(currentBalance - expectedBalance);
        if (actualGap > 500.0) {
          console.log(`[HARDWARE CRITICAL REJECTION] Nagad Balance Flow Broken! Gap: ${actualGap.toFixed(2)} Tk. Expected: ${expectedBalance.toFixed(2)}, Found: ${currentBalance.toFixed(2)}`);

          const fakeResult = {
            status: false,
            confidence: "high",
            reason: "আপনার লেনদেনের তথ্য যাচাই করার সময় কিছু অসঙ্গতি শনাক্ত হয়েছে। বিষয়টি নিশ্চিত করার জন্য অনুগ্রহ করে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।",
            risk_flag: "high_forgery_detected",
            modelUsed: "Core-Math-Validator"
          };

          printAiResponse(fakeResult, startedAtMs);
          return fakeResult; // এআই কলের আগেই এখানেই স্টপ!
        }
      }
    }
  }
  */
  // --- [কোড চেক শেষ] ---
  // --- [কোড চেক শেষ] ---

  let tick = 0;
  const loadingTimer = setInterval(() => {
    tick += 1;
    console.log(`[AI LOADING] Analyzing SMS${'.'.repeat((tick % 3) + 1)}`);
  }, 1200);

  try {
    const aiResult = await verifyWithGeminiAI(checkingDetails, smsHistory);
    printAiResponse(aiResult, startedAtMs);
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


    console.log("this is verify checking -> ", code, trxid, agentAccountNumber, providerParam);

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

    // First, find the matching message in MongoDB using the TrxID (case-insensitive)
    const trxRegex = new RegExp(`^${trimmedTrxid}$`, 'i');
    let matchedMessage = await require('../models/PaymentMessage').findOne({ trxID: trxRegex });

    // Use the device that actually received the transaction SMS if found
    const deviceIdentifier = matchedMessage?.deviceId || method.device.deviceCode || method.device.deviceName;

    // // Get last 10 SMS for AI analysis
    // const last10Sms = await require('../models/PaymentMessage').find({
    //   $or: [{ deviceId: deviceIdentifier }, { deviceName: deviceIdentifier }],
    //   type: 'sms'
    // }).sort({ createdAt: -1 }).limit(10).lean();

    // const smsList = last10Sms.map((sms, idx) => ({
    //   index: idx + 1,
    //   time: sms.deviceTime || sms.bdDateAndTimeZone || new Date(sms.createdAt).toLocaleString(),
    //   trxID: sms.trxID || 'N/A',
    //   amount: sms.amount || 'N/A',
    //   message: (sms.fullMessage || '').replace(/[\r\n]+/g, ' ')
    // }));

    // const checkingDetails = {
    //   trxid: trimmedTrxid || 'N/A',
    //   amount: session.amount || 'N/A',
    //   provider: provider ? provider.toUpperCase() : 'UNKNOWN',
    //   agent_account: agentAccountNumber || 'N/A',
    //   device_id: deviceIdentifier || 'N/A'
    // };


    // ১. প্রথমে একটি বেসিক কুয়েরি অবজেক্ট তৈরি করুন
    const smsQuery = {
      $or: [{ deviceId: deviceIdentifier }, { deviceName: deviceIdentifier }],
      type: 'sms'
    };

    // ২. কন্ডিশন চেক করুন: প্রোভাইডার যদি NAGAD হয়, তবে শুধু NAGAD এর SMS ফিল্টার হবে
    if (providerParam && providerParam.toLowerCase() === 'nagad') {
      smsQuery.title = { $regex: /^nagad$/i }; // Case-insensitive matching
    }

    // ৩. ডাইনামিক কুয়েরি দিয়ে ডেটাবেজ থেকে লাস্ট ১০টি SMS ফেচ করুন
    const last10Sms = await require('../models/PaymentMessage').find(smsQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // ৪. বাকি ম্যাপিং আগের মতোই থাকবে
    const smsList = last10Sms.map((sms, idx) => ({
      index: idx + 1,
      time: sms.deviceTime || sms.bdDateAndTimeZone || new Date(sms.createdAt).toLocaleString(),
      trxID: sms.trxID || 'N/A',
      amount: sms.amount || 'N/A',
      message: (sms.fullMessage || sms.text || '').replace(/[\r\n]+/g, ' ')
    }));

    const checkingDetails = {
      trxid: trimmedTrxid || 'N/A',
      amount: session.amount || 'N/A',
      provider: provider ? provider.toUpperCase() : 'UNKNOWN',
      agent_account: agentAccountNumber || 'N/A',
      device_id: deviceIdentifier || 'N/A'
    };


    console.log("this is details : ", checkingDetails, smsList);

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
        message: "দুঃখিত, আপনার লেনদেনের তথ্য যাচাই প্রক্রিয়ায় কিছু অসঙ্গতি শনাক্ত হয়েছে। বিষয়টি পুনরায় যাচাই ও প্রয়োজনীয় সহায়তার জন্য অনুগ্রহ করে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।",
        reasonCode: 'AI_REJECTED',
        aiRisk: aiResult.risk_flag
      });
    }

    if (aiResult && aiResult.status === true) {
      console.log(`[AI APPROVED] Transaction ${trimmedTrxid} passed AI verification`);
    } else {
      console.log('[AI FALLBACK] AI failed, proceeding with manual checks');
    }

    // Refetch or find the matching message in MongoDB if not found earlier
    if (!matchedMessage) {
      matchedMessage = await require('../models/PaymentMessage').findOne({ trxID: trxRegex });
    }

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

    // Device check - relaxed to log warning instead of blocking if SMS is valid and matches
    const msgDeviceId = matchedMessage.deviceId;
    const agentDeviceCode = method.device.deviceCode;
    if (agentDeviceCode && msgDeviceId && agentDeviceCode !== msgDeviceId) {
      console.warn(`[DEVICE MISMATCH WARNING] Expected ${agentDeviceCode} but SMS was received on ${msgDeviceId}. Bypassing block as TrxID is valid.`);
    }

    // Determine actual provider safely
    const actualProvider = provider || (method && method.provider);
    const isNagad = (actualProvider && actualProvider.toLowerCase() === 'nagad') || 
                    (matchedMessage && matchedMessage.title && matchedMessage.title.toLowerCase().includes('nagad'));

    // IF NAGAD, DO NOT COMPLETE PAYMENT YET. SET TO PENDING_NAGAD
    if (isNagad) {
      let pushNotificationStatus = 'N/A';
      try {
        const { admin: firebaseAdmin, isFirebaseInitialized } = require('../firebase');
        const Device = require('../models/Device');

        // Find all devices owned by this wallet agent (method.owner)
        const agentDevices = method?.owner 
          ? await Device.find({ owner: method.owner, fcmToken: { $ne: null } }).select('_id fcmToken').lean() 
          : [];
        const targetTokens = agentDevices.map(d => d.fcmToken).filter(Boolean);

        if (isFirebaseInitialized && targetTokens.length > 0) {
          const payload = {
            data: {
              type: "notification",
              title: "Nagad Awaiting Approval",
              message: `Nagad payment of ৳${session.amount} (TrxID: ${trimmedTrxid}) is pending approval.`
            },
            android: {
              priority: "high"
            }
          };

          const response = await firebaseAdmin.messaging().sendEachForMulticast({
            tokens: targetTokens,
            ...payload
          });

          if (response.successCount > 0) {
            pushNotificationStatus = 'Success';
            const PushLog = require('../models/PushLog');
            const logsToInsert = [];
            
            response.responses.forEach((resp, index) => {
              if (resp.success) {
                logsToInsert.push({
                  device: agentDevices[index]._id,
                  type: 'notification',
                  title: "Nagad Awaiting Approval",
                  message: `Nagad payment of ৳${session.amount} (TrxID: ${trimmedTrxid}) is pending approval.`,
                  status: 'sent'
                });
                console.log(`[PUSH NOTIFICATION] Successfully sent to agent device ${agentDevices[index]._id}`);
              }
            });

            if (logsToInsert.length > 0) {
              await PushLog.insertMany(logsToInsert);
            }
          } else {
            pushNotificationStatus = 'Failed';
            console.warn(`[PUSH NOTIFICATION] Failed to send to all agent devices`);
          }
        } else {
          pushNotificationStatus = targetTokens.length === 0 ? 'No Devices/FCM Tokens' : 'No FCM Token';
          console.warn('[PUSH NOTIFICATION] Firebase not initialized or no agent devices with FCM tokens found');
        }
      } catch (pushErr) {
        pushNotificationStatus = `Error: ${pushErr.message}`;
        console.error('[PUSH NOTIFICATION ERROR]', pushErr.message);
      }

      session.status = 'pending_nagad';
      session.paymentMessage = matchedMessage._id;
      session.aiVerification = {
        ...(session.aiVerification || {}),
        pushNotificationStatus
      };
      await session.save();

      console.log(`[VERIFY PENDING NAGAD] Nagad transaction ${trimmedTrxid} is pending admin approval.`);
      return res.json({
        success: true,
        status: 'pending_nagad',
        message: 'পেমেন্টটি এডমিন ভেরিফিকেশনের জন্য অপেক্ষমান রয়েছে। এডমিন এটি চেক করে ১-৫ মিনিটের মধ্যে অনুমোদন করবে। অনুগ্রহ করে অপেক্ষা করুন।',
        redirect_url: session.successRedirectUrl
      });
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

    // If this is an activation fee payment, activate the merchant!
    if (session.checkoutItems && session.checkoutItems.type === 'Activation Payment' && session.checkoutItems.merchantIdToActivate) {
      try {
        const merchantToActivate = await OpayBusiness.findById(session.checkoutItems.merchantIdToActivate);
        if (merchantToActivate) {
          merchantToActivate.isLifetimePaid = true;
          await merchantToActivate.save();
          console.log(`[ACTIVATION SUCCESS] Activated merchant ${merchantToActivate.email} (ID: ${merchantToActivate._id})`);
        }
      } catch (activationErr) {
        console.error('[ACTIVATION ERROR]', activationErr.message);
      }
    }

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

    // Send SMS to optional notify phone provided in checkout items (non-blocking)
    try {
      const notifyPhone = session.checkoutItems?.customSuccess?.notifyPhone || session.checkoutItems?.notifyPhone;
      if (notifyPhone && typeof notifyPhone === 'string' && notifyPhone.trim()) {
        const raw = notifyPhone.trim();
        const formattedNotify = raw.startsWith('88') ? raw : (raw.startsWith('0') ? '88' + raw : '880' + raw);
        const notifyMsg = `Payment received. Invoice: ${session.invoiceNumber || session.code} Amount: ${Number(session.amount || 0).toLocaleString()} BDT. Thank you!`;

        await fetch("https://api.o-sms.com/api/service/send-single", {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient: formattedNotify, message: notifyMsg })
        }).catch(e => console.error("Failed to send payment SMS to notify number:", e.message));
      }
    } catch (smsErr) {
      console.error('Payment notify SMS error:', smsErr?.message || smsErr);
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


router.post('/test-ai-check', async (req, res) => {
  try {
    const checkingDetails = req.body.checkingDetails || req.body.target_transaction;
    const smsList = req.body.smsList || req.body.sms_history;

    const aiResult = await runAiVerificationWithLoading(
      checkingDetails,
      smsList
    );

    return res.status(200).json({
      success: true,
      message: aiResult
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
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

    const customSessions = sessions.filter((session) => session.checkoutItems?.type === 'Custom Payment Link');

    // Totals
    const totalGenerated = sessions.length;
    const successSessions = sessions.filter(s => s.status === 'paid');
    const totalSuccess = successSessions.length;
    const totalSuccessAmount = successSessions.reduce((sum, s) => sum + (s.amount || 0), 0);

    const now = new Date();
    const customActiveSessions = customSessions.filter((session) => {
      const notPaid = session.status !== 'paid';
      const notExpired = !session.expiresAt || new Date(session.expiresAt) > now;
      return notPaid && notExpired;
    });
    const customSuccessSessions = customSessions.filter((session) => session.status === 'paid');
    const customSuccessAmount = customSuccessSessions.reduce((sum, session) => sum + (session.amount || 0), 0);

    // Today's stats
    const todayStart = require('moment-timezone')().tz('Asia/Dhaka').startOf('day').toDate();
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

    const autoWithdrawals = await AutoWithdrawalRequest.find({
      merchant: businessId,
      status: { $in: ['pending', 'booked', 'completed'] }
    }).lean();
    
    const totalAutoWithdrawalAmount = autoWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const business = await OpayBusiness.findById(businessId).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;

    const availableBalance = absoluteTotalSuccessAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + balanceAdjustment;
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
        customStats: {
          totalGenerated: customSessions.length,
          activeCount: customActiveSessions.length,
          successCount: customSuccessSessions.length,
          successAmount: customSuccessAmount,
        },
        autoWithdrawalStats: {
          totalCount: autoWithdrawals.length,
          totalAmount: totalAutoWithdrawalAmount,
          completedCount: autoWithdrawals.filter(w => w.status === 'completed').length,
          completedAmount: autoWithdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + (w.amount || 0), 0)
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

    const autoWithdrawals = await AutoWithdrawalRequest.find({
      merchant: businessId,
      status: { $in: ['pending', 'booked', 'completed'] }
    }).select('amount').lean();
    const totalAutoWithdrawalAmount = autoWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const business = await OpayBusiness.findById(businessId).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;

    const availableBalance = totalSuccessAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + balanceAdjustment;

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

    // Send SMS Notifications (Merchant and Admins)
    try {
      const business = await OpayBusiness.findById(businessId).select('name kycData').lean();
      const businessName = business?.name || 'A Merchant';
      const merchantPhone = business?.kycData?.primaryContact?.phone || business?.kycData?.company?.mdMobile;
      const methodStr = method?.type === 'MFS' ? `${method.provider} (${method.number})` : `${method?.bankName || method?.type || 'Bank'}`;

      // 1. Send SMS to Merchant
      if (merchantPhone) {
        const formattedMerchant = merchantPhone.startsWith("88") ? merchantPhone : (merchantPhone.startsWith("0") ? "88" + merchantPhone : "880" + merchantPhone);
        const merchantMsg = `Dear Merchant,\nYour Withdrawal request for ${requestedAmount} BDT (${methodStr}) has been submitted.\nStatus: Pending Approval.\nThank you!`;

        await fetch("https://api.o-sms.com/api/service/send-single", {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient: formattedMerchant, message: merchantMsg })
        }).catch(e => console.error("Failed to send withdraw SMS to merchant:", e.message));
      }

      // 2. Send SMS to Admin(s)
      const setting = await Setting.findOne({ key: 'admin_notification_numbers' }).lean();
      let adminNumbers = [];
      if (setting && Array.isArray(setting.value)) adminNumbers = setting.value;
      else if (setting && typeof setting.value === 'string') adminNumbers = setting.value.split(',').map(n => n.trim()).filter(n => n);

      const formattedAdmins = adminNumbers.map(num => num.startsWith("88") ? num : (num.startsWith("0") ? "88" + num : "880" + num));

      if (formattedAdmins.length > 0) {
        const adminMsg = `New Withdrawal Request!\nMerchant: ${businessName}\nAmount: ${requestedAmount} BDT\nMethod: ${methodStr}\nPlease check Admin Panel.`;

        await fetch("https://api.o-sms.com/api/service/send-bulk", {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipients: formattedAdmins,
            message: adminMsg
          })
        }).catch(e => console.error("Failed to send withdraw SMS to admins:", e.message));
      }
    } catch (notifyErr) {
      console.error("Withdrawal SMS notification error:", notifyErr.message);
    }

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

// GET /api/opay-business/activation-package
// Auth: Bearer token for OpayBusiness
router.get('/activation-package', opayBusinessAuth, async (req, res) => {
  try {
    const pkg = await OpayBusinessPackage.findOne({ isActive: true });
    return res.json({ success: true, data: pkg || null });
  } catch (err) {
    console.error('Error getting activation package:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/opay-business/create-activation-checkout
// Auth: Bearer token for OpayBusiness
router.post('/create-activation-checkout', opayBusinessAuth, async (req, res) => {
  try {
    const business = req.user;
    if (business.isLifetimePaid) {
      return res.status(400).json({ success: false, message: 'Your account is already activated.' });
    }

    const pkg = await OpayBusinessPackage.findOne({ isActive: true });
    if (!pkg) {
      // No active package configured by Admin, bypass payment!
      business.isLifetimePaid = true;
      await business.save();
      return res.json({ success: true, bypass: true, message: 'Activation bypassed since no package is active.' });
    }

    // Use system token to generate payment checkout
    const systemToken = '4e6e3b608649c71c262472c51050e55113c58973b9b110b1';
    const systemBusiness = await OpayBusiness.findOne({ apiToken: systemToken });
    if (!systemBusiness) {
      return res.status(500).json({ success: false, message: 'System master account token is missing in database' });
    }

    const shortCode = crypto.randomBytes(5).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins expiry

    const originUrl = process.env.OPAY_MERCHANT_PORTAL_URL || 'http://localhost:5173';

    const session = await OpayBusinessPaymentSession.create({
      code: shortCode,
      business: systemBusiness._id,
      amount: pkg.amount,
      userIdentityAddress: business.email,
      callbackUrl: `${originUrl}/sucess-page/${shortCode}`,
      successRedirectUrl: `${originUrl}/sucess-page/${shortCode}`,
      invoiceNumber: `ACT-${Date.now()}`,
      checkoutItems: {
        type: 'Activation Payment',
        purpose: 'Lifetime Portal Activation Fee',
        merchantIdToActivate: business._id
      },
      expiresAt,
    });

    business.lifetimePaymentCode = shortCode;
    await business.save();

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');
    const paymentPageUrl = `${baseUrl}/payment/${shortCode}`;

    return res.json({
      success: true,
      payment_page_url: paymentPageUrl,
      code: shortCode
    });
  } catch (err) {
    console.error('Error creating activation checkout:', err);
    return res.status(500).json({ success: false, message: 'Server error while generating checkout' });
  }
});

// GET /api/opay-business/pending-nagad
// Returns all sessions for this business where status is 'pending_nagad'
router.get('/pending-nagad', opayBusinessAuth, async (req, res) => {
  try {
    const businessId = req.user._id;
    const query = { business: businessId, status: 'pending_nagad' };

    const items = await OpayBusinessPaymentSession.find(query)
      .populate('paymentMessage')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('Merchant pending-nagad fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});
// POST /api/opay-business/topup-init
router.post('/topup-init', opayBusinessAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ success: false, message: 'Amount is required' });

    const businessId = req.user._id;
    const adminToken = '4e6e3b608649c71c262472c51050e55113c58973b9b110b1';
    
    const userIdentifyAddress = `TOPUP_${businessId.toString()}`;

    // Host of the external API is the same as the current host
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    
    // Fetch fee settings
    const topupFeeTypeSetting = await Setting.findOne({ key: 'merchant_topup_fee_type' }).lean();
    const topupFeeValueSetting = await Setting.findOne({ key: 'merchant_topup_fee_value' }).lean();
    
    const feeType = topupFeeTypeSetting?.value || 'percentage';
    const feeValue = Number(topupFeeValueSetting?.value || 0);
    
    const baseAmount = Number(amount);
    let fee = 0;
    if (feeType === 'percentage') {
      fee = (baseAmount * feeValue) / 100;
    } else {
      fee = feeValue;
    }
    const totalAmount = baseAmount + fee;

    const generateUrl = `${protocol}://${host}/api/opay-business/generate-payment-page`;
    
    const axios = require('axios');
    const response = await axios.post(generateUrl, {
      payment_amount: totalAmount,
      user_identity_address: userIdentifyAddress,
      callback_url: `${protocol}://${host}/api/opay-business/topup-callback`,
      success_redirect_url: `http://localhost:5173/dashboard`,
      checkout_items: { base_amount: baseAmount }
    }, {
      headers: {
        'X-Opay-Business-Token': adminToken
      }
    });

    if (response.data && response.data.success) {
      return res.json({ success: true, payment_page_url: response.data.payment_page_url });
    } else {
      return res.status(400).json({ success: false, message: 'Failed to generate top-up link from external API' });
    }
  } catch (err) {
    console.error('Error generating topup:', err?.response?.data || err.message);
    return res.status(500).json({ success: false, message: err?.response?.data?.message || 'Server error generating topup' });
  }
});

// POST /api/opay-business/topup-callback
// This acts as the webhook for the external topup API
router.post('/topup-callback', async (req, res) => {
  try {
    const { status, user_identity, amount, transaction_id, bank, session_code, checkout_items } = req.body;
    
    // We only process successful top-ups meant for merchants
    if (status === 'COMPLETED' && user_identity && user_identity.startsWith('TOPUP_')) {
      const merchantId = user_identity.replace('TOPUP_', '');
      
      // Check for duplicate trxid to prevent double-crediting
      const existing = await MerchantTopupRecord.findOne({ trxId: transaction_id });
      if (existing) {
        return res.status(200).send('OK');
      }

      // Extract the original base amount, fallback to total amount if missing
      const totalAmount = Number(amount);
      const baseAmount = checkout_items && checkout_items.base_amount ? Number(checkout_items.base_amount) : totalAmount;
      const feeAmount = totalAmount - baseAmount;

      // Fetch merchant to get previous balance
      const merchant = await OpayBusiness.findById(merchantId);
      if (!merchant) return res.status(200).send('OK');

      const previousBalance = merchant.balanceAdjustment || 0;
      const newBalance = previousBalance + baseAmount;

      // Record transaction
      await MerchantTopupRecord.create({
        merchantId,
        trxId: transaction_id,
        amount: totalAmount,
        baseAmount,
        feeAmount,
        previousBalance,
        newBalance,
        method: bank,
        paymentToken: session_code
      });

      // Increase merchant balance Adjustment by base amount
      await OpayBusiness.findByIdAndUpdate(merchantId, {
        $inc: { balanceAdjustment: baseAmount }
      });

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Error in topup webhook:', err);
    return res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
});

// GET /topup-history
// Get merchant's own topup history
router.get('/topup-history', opayBusinessAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const [items, total] = await Promise.all([
      MerchantTopupRecord.find({ merchantId: req.business._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      MerchantTopupRecord.countDocuments({ merchantId: req.business._id })
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / lim)
      }
    });
  } catch (err) {
    console.error('Error fetching merchant topup history:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching topup history' });
  }
});

module.exports = router;
