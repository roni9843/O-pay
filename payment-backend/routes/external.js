const express = require('express');
const router = express.Router();
const UserSubscription = require('../models/UserSubscription');
const Device = require('../models/Device');
const PaymentMethod = require('../models/PaymentMethod');
const PaymentMethodPageContent = require('../models/PaymentMethodPageContent');
const WalletAgentPaymentTemplate = require('../models/WalletAgentPaymentTemplate');
const ApiAccessToken = require('../models/ApiAccessToken');
const PaymentMessage = require('../models/PaymentMessage');
const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/User');

// Assumption: we restrict requested methods to subscription's featuresSnapshot.paymentMethods if present.
// Clarification for unresolved answers (1 & 2): Using plan allowed providers; no resolve endpoint yet.

function parseMethods(q) {
  if (!q) return [];
  return String(q)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

const VALID_METHODS = ["bkash", "rocket", "nagad", "upay"];

// Helper: provider display mapping & fallback instructions
const PROVIDER_DISPLAY = {
  bkash: 'bKash',
  nagad: 'NAGAD',
  rocket: 'Rocket',
  upay: 'Upay'
};

// GET /api/external/resolve/:provider/:token
// Updated logic per new requirement:
// 1. Validate token & expiry
// 2. Use token.methods[0] as primary depositMethod
// 3. Find all PaymentMethodPageContent by (owner, depositMethod)
// 4. Randomly pick one content; fetch its paymentMethod doc; respond with both
router.get('/resolve/:provider/:token', async (req, res) => {
  try {
    const { provider, token } = req.params;
    const tokenDoc = await ApiAccessToken.findOne({ token });
    if (!tokenDoc) return res.status(404).json({ success: false, message: 'Token not found' });
    if (!tokenDoc.active) return res.status(403).json({ success: false, message: 'Token inactive' });
    if (new Date(tokenDoc.expiresAt) < new Date()) {
      return res.status(410).json({ success: false, message: 'Token expired' });
    }

    const primaryMethod = (tokenDoc.methods && tokenDoc.methods.length) ? tokenDoc.methods[0].toLowerCase() : null;

    // if (!primaryMethod || !VALID_METHODS.includes(primaryMethod)) {
    //   return res.status(400).json({ success: false, message: 'Invalid or missing method in token' });
    // }

    // Optional: ensure URL provider (if given) matches first method
    if (provider && provider.toLowerCase() !== primaryMethod) {
      // Not fatal; could enforce strict match. We'll allow but mark mismatch.
    }

    const owner = await User.findById(tokenDoc.owner).select('role');
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    let content = null;
    let pm = null;

    if (owner.role === 'wallet_agent') {
      // For wallet agents, prefer global template per (provider,gateway)
      const methods = await PaymentMethod.find({ owner: tokenDoc.owner, provider: primaryMethod }).lean();
      if (!methods.length) {
        return res.status(404).json({ success: false, message: 'No payment method found for this wallet agent' });
      }
      // Randomly pick one device/method
      pm = methods[Math.floor(Math.random() * methods.length)];

      const tpl = await WalletAgentPaymentTemplate.findOne({
        provider: primaryMethod,
        gateway: pm.gateway || 'personal',
      }).lean();

      if (!tpl) {
        return res.status(404).json({ success: false, message: 'No global template configured for this method' });
      }

      content = {
        details: Array.isArray(tpl.details) ? tpl.details : [],
        note: tpl.note || '',
        importantNote: tpl.importantNote || '',
        image: tpl.image || '',
        methodName: tpl.methodName || '',
        depositMethod: tpl.provider || primaryMethod,
        color: tpl.color || '',
        bgColor: tpl.bgColor || '',
        buttonText: tpl.buttonText || '',
        buttonTextColor: tpl.buttonTextColor || '',
        buttonTextBgColor: tpl.buttonTextBgColor || '',
      };
    } else {
      // Non-wallet-agent: use per-owner page contents as before
      const allContents = await PaymentMethodPageContent.find({ owner: tokenDoc.owner, depositMethod: primaryMethod }).lean();
      if (!allContents.length) {
        return res.status(404).json({ success: false, message: 'No page content configured for method' });
      }
      content = allContents[Math.floor(Math.random() * allContents.length)];

      pm = await PaymentMethod.findById(content.paymentMethod);
    }

    if (!pm) {
      return res.status(404).json({ success: false, message: 'Linked payment method not found for content' });
    }

    return res.json({
      success: true,
      provider: primaryMethod,
    //   providerDisplay: PROVIDER_DISPLAY[primaryMethod] || primaryMethod,
    //   token,
      amount: tokenDoc.meta?.amount ?? null,
      accountNumber: pm.accountNumber,
      gateway: pm.gateway,
      expiresAt: tokenDoc.expiresAt,
    //   meta: { callbackUrl: tokenDoc.meta?.callbackUrl || null },
    //   paymentMethod: {
    //     id: pm._id,
    //     provider: pm.provider,
    //     accountNumber: pm.accountNumber,
    //     gateway: pm.gateway,
    //     simIndex: pm.simIndex,
    //   },
      pageContent: {
        details: content.details || [],
        note: content.note || '',
        importantNote: content.importantNote || '',
        image: content.image || '',
        methodName: content.methodName || '',
        depositMethod: content.depositMethod || '',
        color: content.color || '',
        bgColor: content.bgColor || '',
        buttonText: content.buttonText || '',
        buttonTextColor: content.buttonTextColor || '',
        buttonTextBgColor: content.buttonTextBgColor || ''
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/external/generate?methods=bkash,nagad&amount=200
// Header: X-API-Key: <subscription api key>
router.get('/generate', async (req, res) => {

  try {
    const apiKey = req.header('X-API-Key');
    if (!apiKey) return res.status(400).json({ success: false, message: 'Missing X-API-Key header' });

    const methods = parseMethods(req.query.methods);
    if (!methods.length) return res.status(400).json({ success: false, message: 'methods query required (comma separated)' });
    if (!methods.every(m => VALID_METHODS.includes(m))) {
      return res.status(400).json({ success: false, message: 'Invalid method in list' });
    }

    // amount validation
    const amountRaw = req.query.amount;
    const amount = Number(amountRaw);
    if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'amount query required and must be > 0' });
    }

    // userIdentifyAddress validation (required string)
    const userIdentifyAddressRaw = req.query.userIdentifyAddress;
    const userIdentifyAddress = typeof userIdentifyAddressRaw === 'string' ? userIdentifyAddressRaw.trim() : '';
    if (!userIdentifyAddress) {
      return res.status(400).json({ success: false, message: 'userIdentifyAddress query required' });
    }

    const subscription = await UserSubscription.findOne({ apiKey });
    if (!subscription) return res.status(401).json({ success: false, message: 'Invalid API key' });
    if (!subscription.apiKeyActive) return res.status(403).json({ success: false, message: 'API key inactive' });

    const now = new Date();
    if (new Date(subscription.endDate) < now) {
      // expire & deactivate key
      subscription.apiKeyActive = false;
      await subscription.save();
      return res.status(403).json({ success: false, message: 'Subscription expired; API key deactivated.' });
    }

    // active devices under subscription
    const activeDevices = await Device.find({ subscription: subscription._id, state: true });
    if (!activeDevices.length) return res.status(400).json({ success: false, message: 'No active devices for subscription' });

    const deviceIds = activeDevices.map(d => d._id);

    // active payment methods tied to these devices
    const activePaymentMethods = await PaymentMethod.find({ device: { $in: deviceIds }, status: 'active' });
    if (!activePaymentMethods.length) return res.status(400).json({ success: false, message: 'No active payment methods on devices' });

    // Check at least one requested provider exists among active payment methods
    const providersAvailable = new Set(activePaymentMethods.map(pm => pm.provider.toLowerCase()));
    const hasAtLeastOne = methods.some(m => providersAvailable.has(m));
    if (!hasAtLeastOne) {
      return res.status(400).json({ success: false, message: 'None of requested providers have active payment method' });
    }

    // (Optional) restrict methods to plan allowed list if present
    const allowedPlanProviders = Array.isArray(subscription.featuresSnapshot?.paymentMethods)
      ? subscription.featuresSnapshot.paymentMethods.map(p => p.toLowerCase())
      : null;
    if (allowedPlanProviders) {
      const disallowed = methods.filter(m => !allowedPlanProviders.includes(m));
      if (disallowed.length) {
        return res.status(400).json({ success: false, message: 'Requested providers not allowed by plan', disallowed });
      }
    }

    // Ensure subscription has a callback URL configured
    if (!subscription.apiCallbackUrl || !/^https?:\/\//i.test(subscription.apiCallbackUrl)) {
      return res.status(400).json({ success: false, message: 'No callback URL configured for this API key/subscription' });
    }

    // Generate persistent token entry
    const rawToken = crypto.randomBytes(16).toString('hex');
    const shortHash = crypto.createHash('sha256').update(rawToken + Date.now()).digest('hex').slice(0, 24);

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes validity

    const tokenDoc = new ApiAccessToken({
      owner: subscription.user,
      subscription: subscription._id,
      methods,
      token: shortHash,
      expiresAt,
      userIdentifyAddress,
      meta: { 
        generatedFrom: 'external/generate', 
        rawTokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
        amount,
        callbackUrl: subscription.apiCallbackUrl,
        userIdentifyAddress
      }
    });
    await tokenDoc.save();

    const domain = "secure.oraclepay.org" || req.get('host') || 'localhost';
    const link = `https://${domain}/${methods.join(',')}/${shortHash}`;

    return res.json({
      success: true,
      payment_page_url: link,
      amount,
      userIdentifyAddress,
      expiresAt,
      expiresInSeconds: 20 * 60,
      methods,
      callbackUrl: subscription.apiCallbackUrl
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/external/support-number
// Header: X-API-Key: <subscription api key>
// Returns the owning user's supportNumber if subscription/key valid and active
router.get('/support-number', async (req, res) => {
  try {
    const apiKey = req.header('X-API-Key');
    if (!apiKey) return res.status(400).json({ success: false, message: 'Missing X-API-Key header' });

    const subscription = await UserSubscription.findOne({ apiKey }).select('user endDate apiKeyActive active');
    if (!subscription) return res.status(401).json({ success: false, message: 'Invalid API key' });
    if (!subscription.apiKeyActive) return res.status(403).json({ success: false, message: 'API key inactive' });
    const now = new Date();
    if (!subscription.active || new Date(subscription.endDate) < now) {
      return res.status(403).json({ success: false, message: 'Subscription expired or inactive' });
    }

    const user = await User.findById(subscription.user).select('supportNumber');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, supportNumber: user.supportNumber || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/external/key/validate
// Header: X-API-Key: <subscription api key>
// Validates: subscription (exists/active/not expired), user devices (active), and device numbers (active payment methods)
router.get('/key/validate', async (req, res) => {
  try {
    const apiKey = req.header('X-API-Key');
    if (!apiKey) {
      return res.status(400).json({ success: false, valid: false, reason: 'MISSING_API_KEY' });
    }

    const subscription = await UserSubscription.findOne({ apiKey }).populate('plan');
    if (!subscription) {
      return res.status(401).json({ success: false, valid: false, reason: 'INVALID_API_KEY' });
    }
    if (!subscription.apiKeyActive) {
      return res.status(403).json({ success: false, valid: false, reason: 'API_KEY_INACTIVE' });
    }

    // Optional: ensure user exists
    const userId = subscription.user;
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ success: false, valid: false, reason: 'USER_NOT_FOUND' });
    }

    // Subscription time validity
    const now = new Date();
    const isActiveSub = Boolean(subscription.active) && new Date(subscription.endDate) > now;
    if (!isActiveSub) {
      return res.status(200).json({
        success: false,
        valid: false,
        reason: 'SUBSCRIPTION_EXPIRED_OR_INACTIVE',
        endDate: subscription.endDate,
      });
    }

    // Active devices for this user
    const devices = await Device.find({ owner: userId, state: true }).select('_id deviceName deviceCode');
    if (!devices.length) {
      return res.status(200).json({ success: false, valid: false, reason: 'NO_ACTIVE_DEVICES', endDate: subscription.endDate });
    }

    const deviceIds = devices.map(d => d._id);

    // Device numbers = active payment methods attached to these devices with an accountNumber
    const activeNumbers = await PaymentMethod.countDocuments({
      device: { $in: deviceIds },
      status: 'active',
      accountNumber: { $exists: true, $ne: '' },
    });
    if (activeNumbers <= 0) {
      return res.status(200).json({ success: false, valid: false, reason: 'NO_ACTIVE_DEVICE_NUMBERS', endDate: subscription.endDate });
    }

    // Latest subscription end date for this user (across all subs)
    const latestSub = await UserSubscription.findOne({ user: userId }).sort({ endDate: -1 }).select('endDate');
    const latestEndDate = latestSub?.endDate || subscription.endDate;

    return res.json({
      success: true,
      valid: true,
      subscriptionId: subscription._id,
      endDate: subscription.endDate,
      latestEndDate,
      domains: Array.isArray(subscription.domains) ? subscription.domains : [],
      primaryDomain: Array.isArray(subscription.domains) && subscription.domains.length ? subscription.domains[0] : null,
      deviceCount: devices.length,
      activeNumberCount: activeNumbers,
      plan: subscription.plan ? { id: subscription.plan._id, name: subscription.plan.name } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, valid: false, reason: 'SERVER_ERROR', message: err.message || 'Server error' });
  }
});

// POST /api/external/verify/:provider/:token
// Body: { trxid: string }
// Logic:
//  - Validate token (exists, active, not expired)
//  - Find PaymentMessage by trxID
//  - If not found => return success:false, code:'PENDING' (to allow client polling)
//  - If found => compare amount with token.meta.amount, then ensure createdAt within 5 minutes
//  - On pass => success:true, code:'VERIFIED'
router.post('/verify/:provider/:token', async (req, res) => {
  try {
    const { provider, token } = req.params;
    const { trxid } = req.body || {};

    if (!trxid || typeof trxid !== 'string' || !trxid.trim()) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'trxid is required' });
    }

    const tokenDoc = await ApiAccessToken.findOne({ token });
    if (!tokenDoc) return res.status(404).json({ success: false, code: 'TOKEN_NOT_FOUND', message: 'Token not found' });
    if (!tokenDoc.active) return res.status(403).json({ success: false, code: 'TOKEN_INACTIVE', message: 'Token inactive' });
    if (new Date(tokenDoc.expiresAt) < new Date()) {
      return res.status(410).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token expired' });
    }

    // Normalize provider names to lowercase
    const providerLower = (provider || '').toString().trim().toLowerCase();
    const primaryMethodLower = Array.isArray(tokenDoc.methods) && tokenDoc.methods.length
      ? String(tokenDoc.methods[0]).toLowerCase()
      : '';

    // Fetch subscription to include allowed domains and perform a request-domain match check
    const subscription = await UserSubscription.findById(tokenDoc.subscription).lean();
    const allowedDomains = Array.isArray(subscription?.domains) ? subscription.domains : [];

    const originHeader = req.get('origin') || req.get('referer') || '';
    let requestDomain = null;
    try {
      // Ensure we have a proper URL object; if originHeader missing protocol, prepend http
      const url = originHeader ? new URL(originHeader) : null;
      requestDomain = url ? url.hostname : null;
    } catch {
      requestDomain = null;
    }

    const normalizeHost = (val) => {
      if (!val || typeof val !== 'string') return null;
      try {
        // Support cases where the stored domain may include protocol
        const hasProto = /^https?:\/\//i.test(val) ? val : `http://${val}`;
        const u = new URL(hasProto);
        return u.hostname.toLowerCase();
      } catch {
        // Fallback: strip protocol manually
        return String(val)
          .replace(/^https?:\/\//i, '')
          .split('/')[0]
          .split(':')[0]
          .toLowerCase();
      }
    };

    const normalizedAllowed = allowedDomains.map(normalizeHost).filter(Boolean);
    const normalizedRequest = normalizeHost(requestDomain);
    const domainMatched = !!(normalizedRequest && normalizedAllowed.includes(normalizedRequest));

    // Try to find incoming payment by trxID (non-lean; we will update it on success)
    const msg = await PaymentMessage.findOne({ trxID: trxid.trim() });
    if (!msg) {
      // Not found yet; allow client to continue polling without treating as hard error
      return res.status(200).json({ success: false, code: 'PENDING', message: 'Transaction not found yet' });
    }

    // Hard-stop: if this transaction was already verified before, do not allow re-verification
    const sameToken = msg.apiAccessToken && tokenDoc._id && String(msg.apiAccessToken) === String(tokenDoc._id);
    if (msg.verify === true) {
      return res.status(200).json({
        success: false,
        code: sameToken ? 'ALREADY_VERIFIED' : 'ALREADY_VERIFIED_WITH_ANOTHER_TOKEN',
        message: sameToken
          ? 'This transaction is already verified.'
          : 'This transaction was verified with a different token and cannot be verified again.',
        data: {
        //   existingToken: msg.apiAccessToken || null,
        }
      });
    }
    // Also prevent linking a trxID that is already bound to a different token (defensive)
    if (msg.apiAccessToken && !sameToken) {
      return res.status(200).json({
        success: false,
        code: 'BOUND_TO_ANOTHER_TOKEN',
        message: 'This transaction is already linked to a different token.',
        // data: { existingToken: msg.apiAccessToken }
      });
    }

    // Detect provider of the message from known fields (lowercased)
    const toText = (v) => (v == null ? '' : String(v));
    const blob = (
      toText(msg.type) + ' ' +
      toText(msg.title) + ' ' +
      toText(msg.fullMessage) + ' ' +
      toText(msg.masking) + ' ' +
      toText(msg.from)
    ).toLowerCase();

    const detectProvider = (text) => {
      if (text.includes('bkash')) return 'bkash';
      if (text.includes('nagad')) return 'nagad';
      if (text.includes('rocket') || text.includes('dbbl rocket') || text.includes('dbbl')) return 'rocket';
      if (text.includes('upay') || text.includes('u pay')) return 'upay';
      return 'unknown';
    };

    const messageProvider = detectProvider(blob);

    // Enforce that the message provider matches the token provider (and URL provider when provided)
    // Always compare in lowercase to avoid case issues
    if (primaryMethodLower && messageProvider !== 'unknown' && messageProvider !== primaryMethodLower) {
      return res.status(200).json({
        success: false,
        code: 'PROVIDER_MISMATCH',
        message: `Payment provider mismatch: expected ${primaryMethodLower}, got ${messageProvider}`
      });
    }
    if (providerLower && primaryMethodLower && providerLower !== primaryMethodLower) {
      // Optional: also block when URL provider differs from token's first method
      // This helps ensure users can't verify under a different route
      return res.status(200).json({
        success: false,
        code: 'URL_PROVIDER_MISMATCH',
        message: `URL provider mismatch: expected ${primaryMethodLower}, got ${providerLower}`
      });
    }

    // Amount check (exact match, numeric)
    const expectedAmount = Number(tokenDoc.meta?.amount ?? NaN);
    const receivedAmount = Number(msg.amount ?? NaN);
    if (!Number.isFinite(expectedAmount)) {
      return res.status(500).json({ success: false, code: 'SERVER_CONFIG', message: 'Expected amount missing in token' });
    }
    if (!Number.isFinite(receivedAmount) || Math.abs(receivedAmount - expectedAmount) > 0.009) {
      return res.status(200).json({ success: false, code: 'AMOUNT_MISMATCH', message: 'Amount does not match' });
    }

    // Time window check: createdAt within last 5 minutes
    const createdAt = new Date(msg.createdAt);
    const now = new Date();
    const diffMs = now - createdAt;
    const within5m = diffMs >= 0 && diffMs <= 5 * 60 * 1000;
    if (!within5m) {
      return res.status(200).json({ success: false, code: 'TIME_WINDOW_EXCEEDED', message: 'Transaction found but outside 5 minute window' });
    }

    // All checks passed -> mark verified and link apiAccessToken
    try {
      msg.verify = true;
      msg.apiAccessToken = tokenDoc._id;
      await msg.save();
    } catch (e) {
      console.error('Failed to update PaymentMessage verification fields:', e);
      // Do not fail verification due to a persistence issue; return success but include a warning
    }

    // Fire callback to client webhook with verification details (non-blocking)
    try {
      const callbackUrl = tokenDoc.meta?.callbackUrl || (await UserSubscription.findById(tokenDoc.subscription).lean())?.apiCallbackUrl;
      if (callbackUrl && /^https?:\/\//i.test(callbackUrl)) {
        const payload = {
          success: true,
          userIdentifyAddress: tokenDoc.userIdentifyAddress || tokenDoc.meta?.userIdentifyAddress || null,
          time: msg.time || (msg.createdAt ? new Date(msg.createdAt).toISOString() : null),
          method: Array.isArray(tokenDoc.methods) && tokenDoc.methods.length ? tokenDoc.methods[0] : null,
          token: tokenDoc.token,
          amount: Number(msg.amount),
          from: msg.from || null,
          trxid: msg.trxID,
          deviceName: msg.deviceName || null,
          deviceId: msg.deviceId || null,
          bdTimeZone: msg.BDTimeZone || null,
        };
        axios.post(callbackUrl, payload, { timeout: 5000 }).catch((err) => {
          console.warn('Callback POST failed:', err?.message || err);
        });
      }
    } catch (cbErr) {
      console.warn('Callback handling error:', cbErr?.message || cbErr);
    }
    // All checks passed
    return res.json({
      success: true,
      code: 'VERIFIED',
      message: 'Payment verified successfully',
      data: {
        trxID: msg.trxID,
        amount: receivedAmount,
        createdAt: msg.createdAt,
        type: (msg.type || null),
        from: msg.from || null,
        deviceId: msg.deviceId || null,
        verify: true,
        apiAccessToken: msg.apiAccessToken || tokenDoc._id,
        provider: messageProvider === 'unknown' ? primaryMethodLower || providerLower || null : messageProvider
      },
      domain: {
        requestDomain: normalizedRequest,
        allowedDomains: normalizedAllowed,
        matched: domainMatched
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message || 'Server error' });
  }
});

module.exports = router;