const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Device = require('../models/Device');
const PaymentMessage = require('../models/PaymentMessage');
const UserSubscription = require('../models/UserSubscription');
const PaymentMethod = require('../models/PaymentMethod');
const PaymentMethodPageContent = require('../models/PaymentMethodPageContent');
const WalletAgentPaymentTemplate = require('../models/WalletAgentPaymentTemplate');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const OpayBusiness = require('../models/OpayBusiness');
const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
const BalanceAdjustmentLog = require('../models/BalanceAdjustmentLog');
const Setting = require('../models/Setting');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const MerchantWithdrawal = require('../models/MerchantWithdrawal');

const router = express.Router();

const WITHDRAW_MIN_KEY = 'merchant_withdraw_min_amount';
const WITHDRAW_COMMISSION_KEY = 'merchant_withdraw_commission_percent';

function isAdmin(req) {
  return req.user?.role === 'admin';
}

// Helper to check credit vs minimumCredit and update payment method status
async function updateAgentMethodsStatus(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    const credit = user.credit || 0;
    const min = user.minimumCredit || 0;
    
    // If credit falls to or below minimum credit -> Deactivate active methods
    if (credit <= min) {
      const methods = await PaymentMethod.find({ owner: userId, status: 'active' });
      if (methods.length > 0) {
        console.log(`Deactivating ${methods.length} payment methods for user ${userId} due to low credit (credit: ${credit}, min: ${min})`);
        await PaymentMethod.updateMany(
          { owner: userId, status: 'active' },
          { $set: { status: 'inactive' } }
        );
      }
    } 
    // If credit is strictly greater than minimum credit -> Reactivate inactive methods
    else {
      const methods = await PaymentMethod.find({ owner: userId, status: 'inactive' });
      if (methods.length > 0) {
        console.log(`Reactivating ${methods.length} payment methods for user ${userId} due to sufficient credit (credit: ${credit}, min: ${min})`);
        await PaymentMethod.updateMany(
          { owner: userId, status: 'inactive' },
          { $set: { status: 'active' } }
        );
      }
    }
  } catch (err) {
    console.error(`Error in updateAgentMethodsStatus for user ${userId}:`, err);
  }
}

// Overall stats
router.get('/stats', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const [usersCount, devicesCount, verifiedPayments, pendingTopUps, pendingWithdrawals] = await Promise.all([
      User.countDocuments(),
      Device.countDocuments(),
      PaymentMessage.countDocuments({ verify: true }),
      require('../models/BalanceTopUp').countDocuments({ status: 'pending' }),
      MerchantWithdrawal.countDocuments({ status: 'pending' })
    ]);
    return res.json({ success: true, data: { usersCount, devicesCount, verifiedPayments, pendingTopUps, pendingWithdrawals } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Users list with aggregates
router.get('/users', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));

    const users = await User.find().sort({ createdAt: -1 }).skip(skip).limit(lim).select('-password').lean();
    const userIds = users.map(u => u._id);

    // Devices per user
    const deviceAgg = await Device.aggregate([
      { $match: { owner: { $in: userIds } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } }
    ]);
    const deviceMap = new Map(deviceAgg.map(d => [String(d._id), d.count]));

    // Verified payments per user (via devices & apiAccessToken linkage is not direct, we infer by deviceId/deviceName/deviceUserName)
    const paymentsAgg = await PaymentMessage.aggregate([
      { $match: { verify: true } },
      { $group: { _id: '$deviceId', total: { $sum: 1 }, amount: { $sum: '$amount' } } }
    ]);
    // Map deviceId -> stats then sum per user by matching deviceUserName/deviceCode/deviceName heuristically
    const userPaymentStats = new Map();
    const userDevices = await Device.find({ owner: { $in: userIds } }).select('owner deviceUserName deviceCode _id deviceName').lean();
    const deviceStatsMap = new Map(paymentsAgg.map(p => [p._id, p]));
    userDevices.forEach(d => {
      const keys = [String(d._id), d.deviceCode, d.deviceUserName, d.deviceName].filter(Boolean);
      let total = 0, amount = 0;
      keys.forEach(k => {
        const stat = deviceStatsMap.get(k);
        if (stat) { total += stat.total; amount += stat.amount; }
      });
      const prev = userPaymentStats.get(String(d.owner)) || { total: 0, amount: 0 };
      prev.total += total; prev.amount += amount;
      userPaymentStats.set(String(d.owner), prev);
    });

    // Active subscription per user
    const subs = await UserSubscription.find({ user: { $in: userIds }, active: true }).select('user plan endDate').populate('plan', 'name').lean();
    const subMap = new Map();
    subs.forEach(s => { subMap.set(String(s.user), { planName: s.plan?.name || 'Unknown', endDate: s.endDate }); });

    const data = users.map(u => {
      const payments = userPaymentStats.get(String(u._id)) || { total: 0, amount: 0 };
      const subscription = subMap.get(String(u._id)) || null;
      return {
        ...u,
        devicesCount: deviceMap.get(String(u._id)) || 0,
        verifiedPayments: payments.total,
        verifiedAmount: payments.amount,
        subscription,
      };
    });

    const totalUsers = await User.countDocuments();
    return res.json({ success: true, data, page: Number(page), total: totalUsers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Devices list with payment stats
router.get('/devices', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(200, Number(limit)));
    const devices = await Device.find().sort({ createdAt: -1 }).skip(skip).limit(lim).populate('owner', 'name email').lean();
    const deviceKeys = [];
    devices.forEach(d => {
      deviceKeys.push(String(d._id));
      if (d.deviceCode) deviceKeys.push(d.deviceCode);
      if (d.deviceUserName) deviceKeys.push(d.deviceUserName);
      if (d.deviceName) deviceKeys.push(d.deviceName);
    });
    const statsAgg = await PaymentMessage.aggregate([
      { $match: { verify: true, deviceId: { $in: deviceKeys } } },
      { $group: { _id: '$deviceId', total: { $sum: 1 }, amount: { $sum: '$amount' } } }
    ]);
    const statsMap = new Map(statsAgg.map(s => [s._id, s]));
    const data = devices.map(d => {
      const keys = [String(d._id), d.deviceCode, d.deviceUserName, d.deviceName].filter(Boolean);
      let total = 0, amount = 0;
      keys.forEach(k => { const s = statsMap.get(k); if (s) { total += s.total; amount += s.amount; } });
      return {
        _id: d._id,
        deviceUserName: d.deviceUserName,
        deviceName: d.deviceName,
        deviceCode: d.deviceCode,
        owner: d.owner,
        subscriptionEndDate: d.subscriptionEndDate,
        verifiedPayments: total,
        verifiedAmount: amount,
        createdAt: d.createdAt,
      };
    });
    const totalDevices = await Device.countDocuments();
    return res.json({ success: true, data, page: Number(page), total: totalDevices });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Devices online/offline status with linked payment methods and user roles
router.get('/devices/online-status', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const presenceMap = req.app?.get('onlineDevices') || new Map();

    // Load all devices with owner info
    const devices = await Device.find()
      .populate('owner', 'name email role')
      .lean();

    const deviceIds = devices.map((d) => d._id);

    // Load all payment methods grouped by device
    const methods = await PaymentMethod.find({ device: { $in: deviceIds } })
      .populate('owner', 'name email role')
      .lean();

    const methodsByDevice = new Map();
    methods.forEach((m) => {
      const key = String(m.device);
      if (!methodsByDevice.has(key)) methodsByDevice.set(key, []);
      methodsByDevice.get(key).push(m);
    });

    const data = devices.map((d) => {
      const presenceKey = d.deviceCode ? String(d.deviceCode) : null;
      const presence = presenceKey ? presenceMap.get(presenceKey) : null;

      const deviceOnline = Boolean(presence?.active);
      const lastSeen = presence?.lastSeen || null;

      const pmList = methodsByDevice.get(String(d._id)) || [];

      return {
        _id: d._id,
        deviceUserName: d.deviceUserName,
        deviceName: d.deviceName,
        deviceCode: d.deviceCode,
        subscriptionEndDate: d.subscriptionEndDate,
        online: deviceOnline,
        lastSeen,
        owner: d.owner || null,
        paymentMethods: pmList.map((m) => ({
          _id: m._id,
          provider: m.provider,
          accountNumber: m.accountNumber,
          gateway: m.gateway,
          simIndex: m.simIndex,
          status: m.status,
          owner: m.owner || null,
        })),
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List payment methods (admin only)
router.get('/payment-methods', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { owner, status } = req.query;
    const query = {};
    if (owner) query.owner = owner;
    if (status && ['active', 'inactive'].includes(status)) query.status = status;

    const methods = await PaymentMethod.find(query)
      .populate('owner', 'name email role')
      .populate('device', 'deviceUserName deviceName')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: methods });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Update payment method status (active/inactive) - admin only
router.patch('/payment-methods/:id/status', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await PaymentMethod.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate('owner', 'name email role').populate('device', 'deviceUserName deviceName');

    if (!updated) return res.status(404).json({ success: false, message: 'Payment method not found' });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Delete device (and related data) - admin only
router.delete('/devices/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const { id } = req.params;
    const device = await Device.findById(id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    // Delete all PaymentMethod rows linked to this device
    await PaymentMethod.deleteMany({ device: device._id });

    // Delete all PaymentMessage rows linked to this device
    const deviceKeys = [
      String(device._id),
      device.deviceCode,
      device.deviceUserName,
      device.deviceName,
    ].filter(Boolean);
    await PaymentMessage.deleteMany({ deviceId: { $in: deviceKeys } });

    // Optionally, you could also clean other external artifacts (files, logs) if needed.

    await device.deleteOne();

    return res.json({ success: true, message: 'Device and related data deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Payments list with comprehensive search and filtering
router.get('/payments', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 50, q, status, userId, deviceId } = req.query;
    
    // Pagination
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(200, Number(limit)));

    // Base query
    const match = {};

    // Filter by Verification Status
    if (status === 'verified') match.verify = true;
    else if (status === 'unverified') match.verify = false;
    // else 'all' -> no filter

    // Filter by specific User
    if (userId) {
       const userDevices = await Device.find({ owner: userId }).select('_id deviceUserName deviceCode deviceName').lean();
       const ids = [];
       userDevices.forEach(d => ids.push(String(d._id), d.deviceUserName, d.deviceCode, d.deviceName));
       match.deviceId = { $in: ids.filter(Boolean) };
    }

    // Filter by specific Device
    if (deviceId) {
       match.deviceId = deviceId; 
    }

    // Global Search (q)
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      
      const matchingDevices = await Device.find({
        $or: [
          { deviceName: regex },
          { deviceCode: regex },
          { deviceUserName: regex }
        ]
      }).select('_id deviceName deviceCode deviceUserName').lean();

      const matchingUsers = await User.find({
        $or: [{ name: regex }, { email: regex }, { phone: regex }]
      }).select('_id').lean();
      
      const userIds = matchingUsers.map(u => u._id);
      let deviceIdsFromUsers = [];
      if (userIds.length > 0) {
        const devicesOfUsers = await Device.find({ owner: { $in: userIds } }).select('_id deviceName deviceCode deviceUserName').lean();
        deviceIdsFromUsers = devicesOfUsers; 
      }

      const targetDeviceKeys = new Set();
      [...matchingDevices, ...deviceIdsFromUsers].forEach(d => {
         targetDeviceKeys.add(String(d._id));
         if (d.deviceCode) targetDeviceKeys.add(d.deviceCode);
         if (d.deviceName) targetDeviceKeys.add(d.deviceName);
         if (d.deviceUserName) targetDeviceKeys.add(d.deviceUserName);
      });

      match.$or = [
        { trxID: regex },
        { fullMessage: regex },
        { title: regex },
        { deviceId: { $in: Array.from(targetDeviceKeys) } }
      ];
    }

    const payments = await PaymentMessage.find(match)
      .sort({ createdAt: -1 }) // New to Old
      .skip(skip)
      .limit(lim)
      .populate('paymentSession', 'footprintUrlNonMask') // Populate session data
      .lean();

    const allKeys = Array.from(new Set(payments.map(p => p.deviceId).filter(Boolean)));
    const objectIdKeys = allKeys.filter(k => mongoose.Types.ObjectId.isValid(k));
    const nonObjectIdKeys = allKeys.filter(k => !mongoose.Types.ObjectId.isValid(k));

    const orConditions = [];
    if (objectIdKeys.length) orConditions.push({ _id: { $in: objectIdKeys } });
    if (nonObjectIdKeys.length) {
      orConditions.push({ deviceUserName: { $in: nonObjectIdKeys } });
      orConditions.push({ deviceCode: { $in: nonObjectIdKeys } });
      orConditions.push({ deviceName: { $in: nonObjectIdKeys } });
    }

    const devices = orConditions.length
      ? await Device.find({ $or: orConditions }).populate('owner','name email').lean()
      : [];
      
    const deviceLookup = new Map();
    devices.forEach(d => {
      [String(d._id), d.deviceUserName, d.deviceCode, d.deviceName].filter(Boolean).forEach(k => deviceLookup.set(k, d));
    });

    const data = payments.map(p => {
      const dev = deviceLookup.get(p.deviceId) || deviceLookup.get(p.deviceName);
      return {
        ...p,
        owner: dev?.owner ? { name: dev.owner.name, email: dev.owner.email, _id: dev.owner._id } : null,
        deviceResolved: dev ? { id: dev._id, deviceUserName: dev.deviceUserName, deviceName: dev.deviceName, deviceCode: dev.deviceCode } : null,
      };
    });

    const total = await PaymentMessage.countDocuments(match);
    return res.json({ success: true, data, page: Number(page), total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Increment (or set) a user's balance
router.post('/users/:id/balance', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    let { amount, mode } = req.body;
    amount = Number(amount);
    if (!Number.isFinite(amount)) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (mode === 'set') {
      const updated = await User.findByIdAndUpdate(id, { balance: amount }, { new: true, runValidators: true }).select('-password');
      if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: updated });
    } else {
      if (amount === 0) return res.status(400).json({ success: false, message: 'Amount must be non-zero' });
      const updated = await User.findByIdAndUpdate(id, { $inc: { balance: amount } }, { new: true }).select('-password');
      if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: updated });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Increment (or set) a user's credit (separate from balance)
router.post('/users/:id/credit', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    let { amount, mode } = req.body;
    amount = Number(amount);
    if (!Number.isFinite(amount)) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (mode === 'set') {
      const updated = await User.findByIdAndUpdate(
        id,
        { credit: amount },
        { new: true, runValidators: true }
      ).select('-password');
      if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: updated });
    } else {
      if (amount === 0) return res.status(400).json({ success: false, message: 'Amount must be non-zero' });
      const updated = await User.findByIdAndUpdate(
        id,
        { $inc: { credit: amount } },
        { new: true }
      ).select('-password');
      if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
      
      // Check credit threshold (fire and forget or await - await is safer for consistency)
      await updateAgentMethodsStatus(id);

      return res.json({ success: true, data: updated });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Increment (or set) a user's minimum credit
router.post('/users/:id/minimum-credit', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    let { amount, mode } = req.body;
    amount = Number(amount);
    if (!Number.isFinite(amount)) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (mode === 'set') {
      const updated = await User.findByIdAndUpdate(
        id,
        { minimumCredit: amount },
        { new: true, runValidators: true }
      ).select('-password');
      if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: updated });
    } else {
      if (amount === 0) return res.status(400).json({ success: false, message: 'Amount must be non-zero' });
      const updated = await User.findByIdAndUpdate(
        id,
        { $inc: { minimumCredit: amount } },
        { new: true }
      ).select('-password');
      if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
      
      // Check credit threshold
      await updateAgentMethodsStatus(id);

      return res.json({ success: true, data: updated });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Adjust either wallet-agent credit, merchant balance, or both in opposite directions
// targetType=wallet_agent: action=plus/minus affects only wallet agent credit
// targetType=merchant: action=plus/minus affects only merchant balanceAdjustment
// targetType=paired: action=plus/minus affects both in opposite directions (old behavior)
router.post('/balance-adjustments', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const { walletAgentId, merchantId, amount, action, note, targetType } = req.body || {};
    const parsedAmount = Number(amount);
    const normalizedTargetType = String(targetType || '').trim();

    if (!['wallet_agent', 'merchant', 'paired'].includes(normalizedTargetType)) {
      return res.status(400).json({ success: false, message: 'targetType must be wallet_agent, merchant, or paired' });
    }

    if (!['plus', 'minus'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be plus or minus' });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }

    if (normalizedTargetType === 'wallet_agent' && !walletAgentId) {
      return res.status(400).json({ success: false, message: 'walletAgentId is required for wallet agent adjustments' });
    }
    if (normalizedTargetType === 'merchant' && !merchantId) {
      return res.status(400).json({ success: false, message: 'merchantId is required for merchant adjustments' });
    }
    if (normalizedTargetType === 'paired' && (!walletAgentId || !merchantId)) {
      return res.status(400).json({ success: false, message: 'walletAgentId and merchantId are required for paired adjustments' });
    }

    let walletAgent = null;
    let merchant = null;
    let walletCreditBefore = 0;
    let walletCreditAfter = 0;
    let merchantBalanceBefore = 0;
    let merchantBalanceAfter = 0;
    let merchantWalletBefore = 0;
    let merchantWalletAfter = 0;
    let walletDelta = 0;
    let merchantDelta = 0;
    let updatedAgent = null;
    let updatedMerchant = null;

    if (normalizedTargetType === 'wallet_agent') {
      walletAgent = await User.findOne({ _id: walletAgentId, role: 'wallet_agent' });
      if (!walletAgent) {
        return res.status(404).json({ success: false, message: 'Wallet agent not found' });
      }

      walletDelta = action === 'plus' ? parsedAmount : -parsedAmount;
      walletCreditBefore = Number(walletAgent.credit || 0);
      updatedAgent = await User.findByIdAndUpdate(
        walletAgentId,
        { $inc: { credit: walletDelta } },
        { new: true, runValidators: true }
      ).select('-password');
      walletCreditAfter = Number(updatedAgent.credit || 0);

      merchant = await OpayBusiness.findById(merchantId).lean();
      merchantBalanceBefore = Number(merchant?.balanceAdjustment || 0);
      merchantBalanceAfter = merchantBalanceBefore;
      merchantWalletBefore = merchantBalanceBefore;
      merchantWalletAfter = merchantBalanceAfter;
    } else if (normalizedTargetType === 'merchant') {
      merchant = await OpayBusiness.findById(merchantId);
      if (!merchant) {
        return res.status(404).json({ success: false, message: 'Merchant not found' });
      }

      merchantDelta = action === 'plus' ? parsedAmount : -parsedAmount;
      merchantBalanceBefore = Number(merchant.balanceAdjustment || 0);
      const [paidStats, withdrawalStats] = await Promise.all([
        OpayBusinessPaymentSession.aggregate([
          { $match: { business: new mongoose.Types.ObjectId(merchantId), status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        MerchantWithdrawal.aggregate([
          { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), status: { $in: ['approved', 'pending'] } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);

      const totalSuccessAmount = Number(paidStats[0]?.total || 0);
      const totalWithdrawalAmount = Number(withdrawalStats[0]?.total || 0);
      const merchantWalletBase = totalSuccessAmount - totalWithdrawalAmount;

      updatedMerchant = await OpayBusiness.findByIdAndUpdate(
        merchantId,
        { $inc: { balanceAdjustment: merchantDelta } },
        { new: true, runValidators: true }
      ).lean();

      merchantBalanceAfter = Number(updatedMerchant.balanceAdjustment || 0);
      merchantWalletBefore = merchantWalletBase + merchantBalanceBefore;
      merchantWalletAfter = merchantWalletBase + merchantBalanceAfter;
    } else {
      [walletAgent, merchant] = await Promise.all([
        User.findOne({ _id: walletAgentId, role: 'wallet_agent' }),
        OpayBusiness.findById(merchantId),
      ]);

      if (!walletAgent) {
        return res.status(404).json({ success: false, message: 'Wallet agent not found' });
      }
      if (!merchant) {
        return res.status(404).json({ success: false, message: 'Merchant not found' });
      }

      walletDelta = action === 'plus' ? parsedAmount : -parsedAmount;
      merchantDelta = -walletDelta;

      walletCreditBefore = Number(walletAgent.credit || 0);
      merchantBalanceBefore = Number(merchant.balanceAdjustment || 0);

      const [paidStats, withdrawalStats] = await Promise.all([
        OpayBusinessPaymentSession.aggregate([
          { $match: { business: new mongoose.Types.ObjectId(merchantId), status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        MerchantWithdrawal.aggregate([
          { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), status: { $in: ['approved', 'pending'] } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);

      const totalSuccessAmount = Number(paidStats[0]?.total || 0);
      const totalWithdrawalAmount = Number(withdrawalStats[0]?.total || 0);
      const merchantWalletBase = totalSuccessAmount - totalWithdrawalAmount;

      [updatedAgent, updatedMerchant] = await Promise.all([
        User.findByIdAndUpdate(
          walletAgentId,
          { $inc: { credit: walletDelta } },
          { new: true, runValidators: true }
        ).select('-password'),
        OpayBusiness.findByIdAndUpdate(
          merchantId,
          { $inc: { balanceAdjustment: merchantDelta } },
          { new: true, runValidators: true }
        ).lean(),
      ]);

      walletCreditAfter = Number(updatedAgent.credit || 0);
      merchantBalanceAfter = Number(updatedMerchant.balanceAdjustment || 0);
      merchantWalletBefore = merchantWalletBase + merchantBalanceBefore;
      merchantWalletAfter = merchantWalletBase + merchantBalanceAfter;
    }

    const log = await BalanceAdjustmentLog.create({
      adminUser: req.user._id,
      walletAgent: walletAgentId,
      merchant: merchantId,
      targetType: normalizedTargetType,
      action,
      amount: parsedAmount,
      walletCreditDelta: walletDelta,
      merchantBalanceDelta: merchantDelta,
      walletCreditBefore,
      walletCreditAfter,
      merchantBalanceBefore,
      merchantBalanceAfter,
      merchantWalletBefore,
      merchantWalletAfter,
      note: note ? String(note).trim() : '',
    });

    await updateAgentMethodsStatus(walletAgentId);

    return res.json({
      success: true,
      message: 'Balance adjusted successfully',
      data: {
        targetType: normalizedTargetType,
        walletAgent: updatedAgent ? {
          _id: updatedAgent._id,
          name: updatedAgent.name,
          email: updatedAgent.email,
          credit: updatedAgent.credit,
        } : null,
        merchant: updatedMerchant ? {
          _id: updatedMerchant._id,
          name: updatedMerchant.name,
          email: updatedMerchant.email,
          domain: updatedMerchant.domain,
          balanceAdjustment: updatedMerchant.balanceAdjustment || 0,
        } : merchant ? {
          _id: merchant._id,
          name: merchant.name,
          email: merchant.email,
          domain: merchant.domain,
          balanceAdjustment: merchant.balanceAdjustment || 0,
        } : null,
        applied: {
          action,
          amount: parsedAmount,
          walletCreditDelta: walletDelta,
          merchantBalanceDelta: merchantDelta,
        },
        history: {
          _id: log._id,
          createdAt: log.createdAt,
        },
      },
    });
  } catch (err) {
    console.error('admin balance-adjustments error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List balance-adjustment history documents
router.get('/balance-adjustments', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const { page = 1, limit = 50, walletAgentId, merchantId } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(200, Number(limit) || 50));
    const skip = (pageNum - 1) * lim;

    const query = {};
    if (walletAgentId) query.walletAgent = walletAgentId;
    if (merchantId) query.merchant = merchantId;

    const [items, total] = await Promise.all([
      BalanceAdjustmentLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('adminUser', 'name email')
        .populate('walletAgent', 'name email credit')
        .populate('merchant', 'name email domain balanceAdjustment')
        .lean(),
      BalanceAdjustmentLog.countDocuments(query),
    ]);

    const merchantIds = Array.from(new Set(items.map((it) => String(it.merchant?._id || it.merchant)).filter(Boolean)));

    let merchantBaseMap = new Map();
    if (merchantIds.length > 0) {
      const objectIds = merchantIds.map((id) => new mongoose.Types.ObjectId(id));

      const [successAgg, withdrawalAgg] = await Promise.all([
        OpayBusinessPaymentSession.aggregate([
          { $match: { business: { $in: objectIds }, status: 'paid' } },
          { $group: { _id: '$business', total: { $sum: '$amount' } } },
        ]),
        MerchantWithdrawal.aggregate([
          { $match: { merchantId: { $in: objectIds }, status: { $in: ['approved', 'pending'] } } },
          { $group: { _id: '$merchantId', total: { $sum: '$amount' } } },
        ]),
      ]);

      const successMap = new Map(successAgg.map((s) => [String(s._id), Number(s.total || 0)]));
      const withdrawalMap = new Map(withdrawalAgg.map((w) => [String(w._id), Number(w.total || 0)]));

      merchantBaseMap = new Map(
        merchantIds.map((id) => [id, (successMap.get(id) || 0) - (withdrawalMap.get(id) || 0)])
      );
    }

    const data = items.map((item) => {
      const merchantIdStr = String(item.merchant?._id || item.merchant || '');
      const base = merchantBaseMap.get(merchantIdStr) || 0;

      const walletBefore = Number.isFinite(item.merchantWalletBefore)
        ? Number(item.merchantWalletBefore)
        : base + Number(item.merchantBalanceBefore || 0);
      const walletAfter = Number.isFinite(item.merchantWalletAfter)
        ? Number(item.merchantWalletAfter)
        : base + Number(item.merchantBalanceAfter || 0);

      return {
        ...item,
        merchantWalletBefore: walletBefore,
        merchantWalletAfter: walletAfter,
      };
    });

    return res.json({ success: true, data, page: pageNum, total });
  } catch (err) {
    console.error('admin list balance-adjustments error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Create a new user (admin only)
router.post('/users', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const allowedRoles = ['admin', 'wallet_agent', 'user'];
    const finalRole = allowedRoles.includes(role) ? role : 'user';

    const hashed = await bcrypt.genSalt(10).then(s => bcrypt.hash(password, s));
    const user = await User.create({ name, email, password: hashed, role: finalRole });
    const obj = user.toObject();
    delete obj.password;
    return res.json({ success: true, data: obj });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Get single user (admin only)
router.get('/users/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Update user (admin only) - basic fields + role
router.patch('/users/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, email, role } = req.body || {};
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof email === 'string' && email.trim()) update.email = email.trim();
    if (typeof role === 'string') {
      const allowedRoles = ['admin', 'wallet_agent', 'user'];
      if (allowedRoles.includes(role)) update.role = role;
    }
    if (req.body.minimumCredit !== undefined) {
      const mc = Number(req.body.minimumCredit);
      if (!isNaN(mc)) update.minimumCredit = mc;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Wallet agent global templates (shared by all wallet agents per provider+gateway)
router.get('/wallet-agent/templates', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const templates = await WalletAgentPaymentTemplate.find({}).sort({ provider: 1, gateway: 1 }).lean();
    return res.json({ success: true, data: templates });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Create or update a global template for wallet agents
router.post('/wallet-agent/templates', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const {
      provider,
      gateway,
      methodName,
      note,
      importantNote,
      details,
      image,
      color,
      bgColor,
      buttonText,
      buttonTextColor,
      buttonTextBgColor,
    } = req.body || {};

    if (!provider || !gateway || !methodName) {
      return res.status(400).json({ success: false, message: 'provider, gateway and methodName are required' });
    }

    const update = {
      provider,
      gateway,
      methodName: String(methodName).trim(),
      note: note ? String(note).trim() : '',
      importantNote: importantNote ? String(importantNote).trim() : '',
      image: image ? String(image).trim() : '',
      color: color || '',
      bgColor: bgColor || '',
      buttonText: buttonText ? String(buttonText).trim() : '',
      buttonTextColor: buttonTextColor || '',
      buttonTextBgColor: buttonTextBgColor || '',
      details: Array.isArray(details) ? details.map((d) => String(d).trim()).filter(Boolean) : [],
    };

    const tpl = await WalletAgentPaymentTemplate.findOneAndUpdate(
      { provider, gateway },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, data: tpl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Purchase subscription for a user (admin panel)
// body: { planId, durationMonths, domain }
router.post('/users/:id/subscriptions', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const { planId, durationMonths, domain } = req.body || {};
    const months = Number(durationMonths);
    if (!planId) return res.status(400).json({ success: false, message: 'planId required' });
    if (![1, 6, 12].includes(months)) return res.status(400).json({ success: false, message: 'Invalid duration. Allowed: 1, 6, 12' });
    if (!domain || String(domain).trim() === '') return res.status(400).json({ success: false, message: 'Domain is required' });

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    let price = 0;
    if (months === 1) price = plan.pricing.monthly;
    else if (months === 6) price = plan.pricing.sixMonths?.price ?? 0;
    else if (months === 12) price = plan.pricing.yearly?.price ?? 0;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if ((user.balance || 0) < price) {
      return res.status(400).json({ success: false, message: 'Insufficient balance for this user' });
    }

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
      domains: [String(domain).trim()],
      featuresSnapshot: plan.features,
      pricingSnapshot: plan.pricing,
      active: true,
    });

    await subscription.save();

    const userSafe = await User.findById(user._id).select('-password');

    return res.json({ success: true, message: 'Subscription purchased', subscription, user: userSafe });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List all subscriptions for a specific user (admin view)
router.get('/users/:id/subscriptions', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;

    const subs = await UserSubscription.find({ user: id })
      .populate('plan', 'name color pricing features')
      .sort({ endDate: -1 })
      .lean();

    return res.json({ success: true, data: subs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// --- Opay Business management ---

function generateBusinessToken() {
  return crypto.randomBytes(24).toString('hex');
}

// List all payment link sessions globally
router.get('/payment-sessions', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 50, search = '', startDate, endDate } = req.query;
    
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 50));
    const skip = (pageNum - 1) * lim;

    let query = {};
    
    // Add Date Filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set to the end of the selected day
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDay;
      }
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      const OpayBusiness = require('../models/OpayBusiness');
      const PaymentMessage = require('../models/PaymentMessage');
      
      const [matchingBusinesses, matchingMessages] = await Promise.all([
        OpayBusiness.find({ 
          $or: [{ name: searchRegex }, { domain: searchRegex }, { email: searchRegex }, { apiToken: searchRegex }] 
        }).select('_id').lean(),
        PaymentMessage.find({ 
          $or: [{ from: searchRegex }, { fullMessage: searchRegex }, { masking: searchRegex }, { deviceId: searchRegex }] 
        }).select('_id').lean()
      ]);
      
      const businessIds = matchingBusinesses.map(b => b._id);
      const messageIds = matchingMessages.map(m => m._id);

      query = {
        $or: [
          { code: searchRegex },
          { userIdentityAddress: searchRegex },
          { invoiceNumber: searchRegex },
          { requestIp: searchRegex },
          { status: searchRegex },
          { footprintUrl: searchRegex },
          { footprintUrlNonMask: searchRegex },
          { successRedirectUrl: searchRegex },
          { callbackUrl: searchRegex },
          { 'verificationFootprint.deviceId': searchRegex },
          { 'verificationFootprint.deviceName': searchRegex },
          { 'verificationFootprint.senderPhone': searchRegex },
          { 'verificationFootprint.ip': searchRegex },
          { 'verificationFootprint.userAgent': searchRegex },
          { 'checkoutItems.username': searchRegex },
          { business: { $in: businessIds } },
          { paymentMessage: { $in: messageIds } },
          { $expr: { $regexMatch: { input: { $toString: { $ifNull: ["$createdAt", ""] } }, regex: search, options: "i" } } },
          { $expr: { $regexMatch: { input: { $toString: { $ifNull: ["$updatedAt", ""] } }, regex: search, options: "i" } } },
          { $expr: { $regexMatch: { input: { $toString: { $ifNull: ["$expiresAt", ""] } }, regex: search, options: "i" } } },
          { $expr: { $regexMatch: { input: { $toString: { $ifNull: ["$firstOpenedAt", ""] } }, regex: search, options: "i" } } },
          { $expr: { $regexMatch: { input: { $toString: { $ifNull: ["$lastActivityAt", ""] } }, regex: search, options: "i" } } }
        ]
      };
      
      // If search is a number, we can also search by amount
      if (!isNaN(search)) {
        query.$or.push({ amount: Number(search) });
      }
    }

    const [items, total] = await Promise.all([
      OpayBusinessPaymentSession.find(query)
        .populate('business', 'name domain email')
        .populate('paymentMessage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(query),
    ]);

    const Device = require('../models/Device');
    const PaymentMethod = require('../models/PaymentMethod');
    const PaymentMessage = require('../models/PaymentMessage');

    // We need to resolve the Device owner and the PaymentMethod Details
    const deviceIds = items.map(i => i.verificationFootprint?.deviceId || i.paymentMessage?.deviceId).filter(Boolean);
    const devices = await Device.find({ deviceCode: { $in: deviceIds } }).populate('owner', 'name email phone').lean();
    
    // We also might want to resolve PaymentMethod by the account number
    const targetNumbers = items.map(i => i.events?.find(e => e.type === 'pay_click')?.meta?.method?.accountNumber || i.paymentMessage?.from || i.paymentMessage?.masking).filter(Boolean);
    const methods = await PaymentMethod.find({ accountNumber: { $in: targetNumbers } }).populate('owner', 'name email phone').lean();

    const getAttemptedTrxId = (session) => {
      if (session?.lastVerificationFailure?.trxid) return String(session.lastVerificationFailure.trxid).trim();
      const attempts = Array.isArray(session?.verificationAttempts) ? session.verificationAttempts : [];
      for (let i = attempts.length - 1; i >= 0; i -= 1) {
        if (attempts[i]?.trxid) return String(attempts[i].trxid).trim();
      }
      const evs = Array.isArray(session?.events) ? session.events : [];
      for (let i = evs.length - 1; i >= 0; i -= 1) {
        const type = String(evs[i]?.type || '').toLowerCase();
        if (!type.includes('verify')) continue;
        const id = evs[i]?.meta?.txid || evs[i]?.meta?.trxid;
        if (id) return String(id).trim();
      }
      return null;
    };

    const attemptedTrxIds = [...new Set(items.map(getAttemptedTrxId).filter(Boolean))];
    const attemptedMessages = attemptedTrxIds.length
      ? await PaymentMessage.find({ trxID: { $in: attemptedTrxIds } })
          .select('trxID amount fullMessage createdAt from masking deviceId deviceName type title')
          .lean()
      : [];
    const attemptedMessageMap = new Map(
      attemptedMessages.map((m) => [String(m.trxID || '').toLowerCase(), m])
    );

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');

    const data = items.map((s) => {
      const devId = s.verificationFootprint?.deviceId || s.paymentMessage?.deviceId;
      const tNum = s.events?.find(e => e.type === 'pay_click')?.meta?.method?.accountNumber || s.paymentMessage?.from || s.paymentMessage?.masking;
      
      const resolvedDevice = devices.find(d => d.deviceCode === devId) || null;
      const resolvedMethod = methods.find(m => m.accountNumber === tNum) || null;
      const attemptedTrxId = getAttemptedTrxId(s);
      const attemptedPaymentMessage = attemptedTrxId
        ? attemptedMessageMap.get(String(attemptedTrxId).toLowerCase()) || null
        : null;

      return {
        ...s,
        resolvedDevice,
        resolvedMethod,
        attemptedTrxId,
        attemptedPaymentMessage,
        payment_page_url: `${baseUrl}/payment/${s.code}`,
        footprintUrl: s.footprintUrl || `${baseUrl}/payment/${s.code}/mask/footprint`,
        footprintUrlNonMask: s.footprintUrlNonMask || `${baseUrl}/payment/${s.code}/footprint`,
      };
    });

    return res.json({ success: true, data, page: pageNum, total });
  } catch (err) {
    console.error('admin get global payment-sessions error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading payment sessions' });
  }
});

// List all Opay businesses
router.get('/opay-businesses', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    // 1. Get all businesses
    const businesses = await OpayBusiness.find().sort({ createdAt: -1 }).lean();
    
    // 2. Aggregate Total Success Amount for ALL businesses
    const successStats = await OpayBusinessPaymentSession.aggregate([
        { $match: { status: 'paid' } },
        {
            $group: {
                _id: '$business',
                totalSuccessAmount: { $sum: '$amount' }
            }
        }
    ]);

    // 3. Aggregate Total Withdrawal Amount (approved & pending) for ALL businesses
    const withdrawalStats = await MerchantWithdrawal.aggregate([
        { $match: { status: { $in: ['approved', 'pending'] } } },
        {
            $group: {
                _id: '$merchantId',
                totalWithdrawalAmount: { $sum: '$amount' }
            }
        }
    ]);

    // 4. Map the aggregated data back to businesses with accurate financial & performance stats
    const data = await Promise.all(businesses.map(async (b) => {
        const busId = new mongoose.Types.ObjectId(b._id);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const [paidStats, withStats, todayStats] = await Promise.all([
            OpayBusinessPaymentSession.aggregate([
                { $match: { business: busId, status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            MerchantWithdrawal.aggregate([
                { $match: { merchantId: busId, status: { $in: ['approved', 'pending'] } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            OpayBusinessPaymentSession.aggregate([
                { $match: { business: busId, createdAt: { $gte: startOfToday } } },
                {
                    $group: {
                        _id: null,
                        generatedToday: { $sum: 1 },
                        successToday: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
                        amountToday: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } }
                    }
                }
            ])
        ]);

        const totalSuccessAmount = (paidStats[0]?.total) || 0;
        const totalWithdrawalAmount = (withStats[0]?.total) || 0;
        const availableBalance = totalSuccessAmount - totalWithdrawalAmount + (b.balanceAdjustment || 0);
        
        const today = todayStats[0] || { generatedToday: 0, successToday: 0, amountToday: 0 };

        return {
            ...b,
            totalSuccessAmount,
          balanceAdjustment: b.balanceAdjustment || 0,
            availableBalance,
            today
        };
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('admin get opay-businesses error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List payment page history for a single Opay business
// GET /api/admin/opay-businesses/:id/payment-page-history?page=1&limit=50
router.get('/opay-businesses/:id/payment-page-history', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const query = { business: id };

    const [items, total, stats] = await Promise.all([
      OpayBusinessPaymentSession.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(query),
      OpayBusinessPaymentSession.aggregate([
        { $match: { business: new mongoose.Types.ObjectId(id) } },
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

    // Calculate withdrawals for available balance
    const withdrawals = await MerchantWithdrawal.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(id), status: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawalAmount = withdrawals[0]?.total || 0;

    const summary = stats[0] || {
      totalAmount: 0,
      successAmount: 0,
      unsuccessfulAmount: 0,
      successCount: 0,
      unsuccessfulCount: 0
    };

    const business = await OpayBusiness.findById(id).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;
    summary.balanceAdjustment = balanceAdjustment;
    summary.availableBalance = summary.successAmount - totalWithdrawalAmount + balanceAdjustment;

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');

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
    }));

    return res.json({ success: true, data, page: pageNum, total, summary });
  } catch (err) {
    console.error('admin opay-business payment-page-history error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: Get dashboard overview for a specific Opay business (graph data)
router.get('/opay-businesses/:id/dashboard-overview', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const { id } = req.params;
    const businessId = new mongoose.Types.ObjectId(id);

    const [totalsRes, withdrawalRes, graphRes] = await Promise.all([
      OpayBusinessPaymentSession.aggregate([
        { $match: { business: businessId } },
        {
          $group: {
            _id: null,
            totalGenerated: { $sum: 1 },
            totalSuccess: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            totalSuccessAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          },
        },
      ]),
      MerchantWithdrawal.aggregate([
        { $match: { merchantId: businessId, status: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      OpayBusinessPaymentSession.aggregate([
        {
          $match: {
            business: businessId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalGenerated: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            successAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const resTotals = totalsRes[0] || { totalGenerated: 0, totalSuccess: 0, totalSuccessAmount: 0 };
    const totalWithdrawalAmount = withdrawalRes[0]?.total || 0;
    const business = await OpayBusiness.findById(id).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;
    resTotals.balanceAdjustment = balanceAdjustment;
    resTotals.availableBalance = resTotals.totalSuccessAmount - totalWithdrawalAmount + balanceAdjustment;

    const daily = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const match = graphRes.find((s) => s._id === dateStr);
      daily.push({
        date: dateStr,
        totalGenerated: match ? match.totalGenerated : 0,
        successCount: match ? match.successCount : 0,
        successAmount: match ? match.successAmount : 0,
      });
    }

    return res.json({
      success: true,
      data: {
        totals: resTotals,
        daily,
      },
    });
  } catch (err) {
    console.error('admin opay-business dashboard-overview error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading overview' });
  }
});

// Get single Opay business
router.get('/opay-businesses/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const item = await OpayBusiness.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Business not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: Approve KYC
router.post('/opay-businesses/:id/approve', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        business.kycStatus = 'approved';
        business.enabled = true;
        
        // Update domain from KYC data if available
        if (business.kycData?.site?.url) {
            business.domain = business.kycData.site.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
        
        // Regenerate API Token
        business.apiToken = generateBusinessToken();

        await business.save();
        
        return res.json({ success: true, message: "KYC Approved and Account Activated", data: business });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// Admin: Edit full KYC data
router.patch('/opay-businesses/:id/kyc', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        const { kycData } = req.body;
        if (!kycData) return res.status(400).json({ success: false, message: 'kycData is required' });

        business.kycData = kycData;
        business.markModified('kycData');
        await business.save();

        return res.json({ success: true, message: "KYC data updated", data: business });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// Admin: Request Re-verification
router.post('/opay-businesses/:id/reverify', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        business.kycStatus = 'pending';
        business.enabled = false;
        business.kycMessage = req.body.message || 'Please update your KYC documents and re-submit.';
        await business.save();
        
        return res.json({ success: true, message: "Requested Re-verification", data: business });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// Admin: Reject KYC
router.post('/opay-businesses/:id/reject', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        business.kycStatus = 'rejected';
        await business.save();
        
        return res.json({ success: true, message: "KYC Rejected", data: business });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// Admin: Toggle Active Status
router.post('/opay-businesses/:id/toggle', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        business.enabled = !business.enabled;
        await business.save();
        
        return res.json({ success: true, message: `Business is now ${business.enabled ? 'Active' : 'Inactive'}`, data: business });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// Admin: Delete Opay Business
router.delete('/opay-businesses/:id', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        await business.deleteOne();
        
        return res.json({ success: true, message: "Business deleted successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// Create a new Opay business/brand
router.post('/opay-businesses', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, domain, email, password, enabled = true } = req.body || {};

    if (!name || !domain || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, domain, email and password are required' });
    }

    const cleanDomain = String(domain).trim().toLowerCase();
    const existing = await OpayBusiness.findOne({ domain: cleanDomain });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Domain already exists' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const apiToken = generateBusinessToken();

    const created = await OpayBusiness.create({
      name: String(name).trim(),
      domain: cleanDomain,
      email: String(email).trim(),
      passwordHash,
      enabled: Boolean(enabled),
      apiToken,
    });

    const obj = created.toObject();
    delete obj.passwordHash;
    return res.json({ success: true, data: obj });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Update Opay business basic fields (currently only enabled)
router.patch('/opay-businesses/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const { enabled } = req.body || {};

    const update = {};
    if (typeof enabled === 'boolean') update.enabled = enabled;

    const updated = await OpayBusiness.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Business not found' });
    delete updated.passwordHash;
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Regenerate API token for a business
router.post('/opay-businesses/:id/regenerate-token', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;

    const apiToken = generateBusinessToken();
    const updated = await OpayBusiness.findByIdAndUpdate(
      id,
      { apiToken },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: 'Business not found' });
    delete updated.passwordHash;
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/admin/merchant-withdrawals
// List all withdrawal requests
router.get('/merchant-withdrawals', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    const items = await MerchantWithdrawal.find()
      .populate('merchantId', 'name mobile email')
      .sort({ createdAt: -1 })
      .lean();
      
    return res.json({ success: true, data: items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// POST /api/admin/merchant-withdrawals/:id/status
// Update status (approve/reject)
router.post('/merchant-withdrawals/:id/status', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const { status, rejectReason, proofImages } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const update = { 
        status, 
        rejectReason: status === 'rejected' ? rejectReason : null 
    };

    if (status === 'approved' && Array.isArray(proofImages)) {
        update.proofImages = proofImages;
    }

    const updated = await MerchantWithdrawal.findByIdAndUpdate(
        id, 
        update,
        { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/admin/merchant-withdrawal-config
// Read admin-controlled minimum withdrawal + commission percent
router.get('/merchant-withdrawal-config', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const [minSetting, commissionSetting] = await Promise.all([
      Setting.findOne({ key: WITHDRAW_MIN_KEY }).lean(),
      Setting.findOne({ key: WITHDRAW_COMMISSION_KEY }).lean(),
    ]);

    const minAmount = Number(minSetting?.value);
    const commissionPercent = Number(commissionSetting?.value);

    return res.json({
      success: true,
      data: {
        minAmount: Number.isFinite(minAmount) && minAmount >= 0 ? minAmount : 10000,
        commissionPercent: Number.isFinite(commissionPercent) && commissionPercent >= 0 ? commissionPercent : 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// POST /api/admin/merchant-withdrawal-config
// Update admin-controlled minimum withdrawal + commission percent
router.post('/merchant-withdrawal-config', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const { minAmount, commissionPercent } = req.body || {};
    const parsedMin = Number(minAmount);
    const parsedCommission = Number(commissionPercent);

    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      return res.status(400).json({ success: false, message: 'Invalid minimum withdrawal amount' });
    }
    if (!Number.isFinite(parsedCommission) || parsedCommission < 0 || parsedCommission > 100) {
      return res.status(400).json({ success: false, message: 'Invalid commission percent (0-100)' });
    }

    await Promise.all([
      Setting.findOneAndUpdate(
        { key: WITHDRAW_MIN_KEY },
        { $set: { value: parsedMin } },
        { upsert: true, new: true }
      ),
      Setting.findOneAndUpdate(
        { key: WITHDRAW_COMMISSION_KEY },
        { $set: { value: parsedCommission } },
        { upsert: true, new: true }
      ),
    ]);

    return res.json({
      success: true,
      message: 'Merchant withdrawal config updated',
      data: { minAmount: parsedMin, commissionPercent: parsedCommission },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;
