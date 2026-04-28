const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const crypto = require('crypto');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
};

// Admin update subscription (endDate, active)
// Body: { endDate?: Date, active?: Boolean }
router.patch('/:id/admin', [auth, isAdmin], async (req, res) => {
  try {
    const { id } = req.params;
    const { endDate, active } = req.body;
    const sub = await UserSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });

    if (endDate) sub.endDate = new Date(endDate);
    if (typeof active === 'boolean') sub.active = active;

    await sub.save();
    res.json({ message: 'Subscription updated', subscription: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Purchase a subscription using user's balance
// body: { planId, durationMonths, domain? }
router.post('/purchase', auth, async (req, res) => {
  try {
    const { planId, durationMonths, domain } = req.body;
    const months = Number(durationMonths);
    if (!planId) return res.status(400).json({ message: 'planId required' });
    if (![1,6,12].includes(months)) return res.status(400).json({ message: 'Invalid duration. Allowed: 1, 6, 12' });
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const requiresDomain = plan.name !== 'Wallet Agent';
    const cleanDomain = domain && String(domain).trim();
    if (requiresDomain && !cleanDomain) {
      return res.status(400).json({ message: 'Domain is required' });
    }

    // determine price based on months
    let price = 0;
    if (months === 1) price = plan.pricing.monthly;
    else if (months === 6) price = plan.pricing.sixMonths?.price ?? 0;
    else if (months === 12) price = plan.pricing.yearly?.price ?? 0;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if ((user.balance || 0) < price) return res.status(400).json({ message: 'Insufficient balance' });

    // Deduct balance
    user.balance = (user.balance || 0) - price;
    await user.save();

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    const subscription = new UserSubscription({
      user: user._id,
      plan: plan._id,
      startDate,
      durationMonths: months,
      endDate,
      purchasePrice: price,
      domains: cleanDomain ? [cleanDomain] : [],
      featuresSnapshot: plan.features,
      pricingSnapshot: plan.pricing,
      active: true,
    });

    await subscription.save();

    const userSafe = await User.findById(user._id).select('-password');

    res.json({ message: 'Subscription purchased', subscription, user: userSafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;

// Get subscriptions for authenticated user
// Also auto-expire any active subscriptions whose endDate has passed
router.get('/my', auth, async (req, res) => {
  try {
    const subs = await UserSubscription.find({ user: req.user._id })
      .populate('plan')
      .sort({ createdAt: -1 });

    const now = new Date();
    const updates = [];

    subs.forEach((sub) => {
      if (sub.active && sub.endDate && new Date(sub.endDate) < now) {
        sub.active = false;
        updates.push(sub.save());
      }
    });

    if (updates.length) {
      await Promise.all(updates);
    }

    res.json(subs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Generate or rotate API key for a subscription
router.post('/:id/api-key/generate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { callbackUrl } = req.body || {};
    const sub = await UserSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    if (String(sub.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    // Generate random key
    const raw = crypto.randomBytes(32).toString('hex');
    const apiKey = `sk_sub_${raw}`;
    sub.apiKey = apiKey; // In production replace with hash
    sub.apiKeyActive = true;
    if (callbackUrl ) {
      sub.apiCallbackUrl = callbackUrl.trim();
    } else if (!sub.apiCallbackUrl) {
      // If no existing callback and none provided, require it
      return res.status(400).json({ message: 'callbackUrl (http/https) is required when creating API key' });
    }
    await sub.save();
    res.json({ message: sub.apiKey ? 'API key generated' : 'API key error', apiKey, active: sub.apiKeyActive, callbackUrl: sub.apiCallbackUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get API key (masked) status for a subscription
router.get('/:id/api-key', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await UserSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    if (String(sub.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    if (!sub.apiKey) return res.json({ hasKey: false, active: false });
    // Return full apiKey as requested (note: in production you would avoid this)
    res.json({ hasKey: true, apiKey: sub.apiKey, active: sub.apiKeyActive, callbackUrl: sub.apiCallbackUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Revoke API key
router.delete('/:id/api-key', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await UserSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    if (String(sub.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    sub.apiKey = null;
    sub.apiKeyActive = true; // reset
    // keep callbackUrl as is
    await sub.save();
    res.json({ message: 'API key revoked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Toggle API key active state
router.post('/:id/api-key/toggle', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const sub = await UserSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    if (String(sub.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    if (!sub.apiKey) return res.status(400).json({ message: 'No API key to toggle' });
    sub.apiKeyActive = Boolean(active);
    await sub.save();
    res.json({ message: 'API key state updated', active: sub.apiKeyActive });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Update only callback URL
router.patch('/:id/api-key/callback', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { callbackUrl } = req.body || {};
    const sub = await UserSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    if (String(sub.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    if (!callbackUrl || !/^https?:\/\//i.test(callbackUrl)) {
      return res.status(400).json({ message: 'Valid callbackUrl (http/https) is required' });
    }
    sub.apiCallbackUrl = String(callbackUrl).trim();
    await sub.save();
    res.json({ message: 'Callback URL updated', callbackUrl: sub.apiCallbackUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});
