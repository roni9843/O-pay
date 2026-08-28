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
const MerchantTopupRecord = require('../models/MerchantTopupRecord');
const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
const PushLog = require('../models/PushLog');
const OpayBusinessPackage = require('../models/OpayBusinessPackage');

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

let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_DURATION = 8000; // 8 seconds cache

// Overall stats
router.get('/stats', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const now = Date.now();
    if (statsCache && (now - statsCacheTime < STATS_CACHE_DURATION)) {
      return res.json({ success: true, data: statsCache });
    }

    const [
      usersCount, 
      devicesCount, 
      verifiedPayments, 
      pendingBalanceTopUps, 
      pendingWithdrawals,
      pendingCreditTopUps,
      pendingAgentApplications,
      pendingNagad,
      pendingBank,
      pendingAutoWithdrawals
    ] = await Promise.all([
      User.countDocuments(),
      Device.countDocuments(),
      PaymentMessage.countDocuments({ verify: true }),
      require('../models/BalanceTopUp').countDocuments({ status: 'pending' }),
      MerchantWithdrawal.countDocuments({ status: 'pending' }),
      require('../models/CreditTopupRequest').countDocuments({ status: 'pending' }),
      require('../models/AgentApplication').countDocuments({ status: 'pending' }),
      OpayBusinessPaymentSession.countDocuments({ status: 'pending_nagad' }),
      OpayBusinessPaymentSession.countDocuments({ status: 'pending_bank' }),
      AutoWithdrawalRequest.countDocuments({ status: { $in: ['pending', 'booked'] } })
    ]);

    statsCache = {
      usersCount, 
      devicesCount, 
      verifiedPayments, 
      pendingBalanceTopUps, 
      pendingWithdrawals,
      pendingCreditTopUps,
      pendingAgentApplications,
      pendingNagad,
      pendingBank,
      pendingAutoWithdrawals
    };
    statsCacheTime = now;

    return res.json({ success: true, data: statsCache });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Today's payment statistics (verified payments from last 24 hours)
router.get('/today-stats', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    const startOfToday = require('moment-timezone')().tz('Asia/Dhaka').startOf('day').toDate();

    // Use same aggregation as today-user-list to get consistent grouping by resolved owner
    const agg = await PaymentMessage.aggregate([
      { $match: { verify: true, createdAt: { $gte: startOfToday } } },
      {
        $lookup: {
          from: 'apiaccesstokens',
          localField: 'apiAccessToken',
          foreignField: '_id',
          as: 'token'
        }
      },
      { $unwind: { path: '$token', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'token.owner',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'devices',
          let: { dId: '$deviceId', dName: '$deviceName' },
          pipeline: [
            { $match: { $expr: { $or: [ { $eq: ['$deviceCode', '$$dId'] }, { $eq: ['$deviceUserName', '$$dId'] }, { $eq: ['$deviceName', '$$dName'] }, { $eq: [{ $toString: '$_id' }, '$$dId'] } ] } } },
            { $project: { owner: 1, deviceName: 1, deviceCode: 1 } }
          ],
          as: 'deviceMatch'
        }
      },
      { $unwind: { path: '$deviceMatch', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          resolvedOwnerId: { $ifNull: [ '$user._id', '$deviceMatch.owner' ] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'resolvedOwnerId',
          foreignField: '_id',
          as: 'resolvedOwner'
        }
      },
      { $unwind: { path: '$resolvedOwner', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          resolvedOwnerName: { $ifNull: [ '$resolvedOwner.name', '$deviceMatch.deviceName' ] },
          resolvedOwnerEmail: { $ifNull: [ '$resolvedOwner.email', null ] },
          resolvedOwnerRole: { $ifNull: [ '$resolvedOwner.role', null ] }
        }
      },
      {
        $group: {
          _id: { $cond: [ { $ifNull: ['$resolvedOwnerId', false] }, { owner: '$resolvedOwnerId' }, { device: '$deviceId' } ] },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
          resolvedOwnerName: { $first: '$resolvedOwnerName' },
          resolvedOwnerEmail: { $first: '$resolvedOwnerEmail' },
          resolvedOwnerRole: { $first: '$resolvedOwnerRole' }
        }
      },
      { $sort: { count: -1, amount: -1 } }
    ]);

    // Calculate total and find top user
    let totalAmount = 0;
    let totalTransactions = 0;
    let topUser = null;
    let maxCount = 0;

    agg.forEach(item => {
      totalAmount += item.amount || 0;
      totalTransactions += item.count || 0;
      if ((item.count || 0) > maxCount) {
        maxCount = item.count || 0;
        topUser = {
          count: item.count || 0,
          amount: item.amount || 0,
          name: item.resolvedOwnerName,
          email: item.resolvedOwnerEmail
        };
      }
    });

    return res.json({
      success: true,
      data: {
        totalAmount,
        totalTransactions,
        topUser: topUser || { count: 0, amount: 0 }
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Today's per-user paid counts (verified PaymentMessage grouped by user/token/device fallback)
router.get('/today-user-list', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });

    const startOfToday = require('moment-timezone')().tz('Asia/Dhaka').startOf('day').toDate();

    const agg = await PaymentMessage.aggregate([
      { $match: { verify: true, createdAt: { $gte: startOfToday } } },
      // Lookup token -> user (if message linked to an API token)
      {
        $lookup: {
          from: 'apiaccesstokens',
          localField: 'apiAccessToken',
          foreignField: '_id',
          as: 'token'
        }
      },
      { $unwind: { path: '$token', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'token.owner',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      // Lookup device by possible identifiers to find an owner
      {
        $lookup: {
          from: 'devices',
          let: { dId: '$deviceId', dName: '$deviceName' },
          pipeline: [
            { $match: { $expr: { $or: [ { $eq: ['$deviceCode', '$$dId'] }, { $eq: ['$deviceUserName', '$$dId'] }, { $eq: ['$deviceName', '$$dName'] }, { $eq: [{ $toString: '$_id' }, '$$dId'] } ] } } },
            { $project: { owner: 1, deviceName: 1, deviceCode: 1 } }
          ],
          as: 'deviceMatch'
        }
      },
      { $unwind: { path: '$deviceMatch', preserveNullAndEmptyArrays: true } },
      // Resolve owner ID first (prefer token user, fallback to device owner)
      {
        $addFields: {
          resolvedOwnerId: { $ifNull: [ '$user._id', '$deviceMatch.owner' ] }
        }
      },
      // Lookup full user info for the resolved owner
      {
        $lookup: {
          from: 'users',
          localField: 'resolvedOwnerId',
          foreignField: '_id',
          as: 'resolvedOwner'
        }
      },
      { $unwind: { path: '$resolvedOwner', preserveNullAndEmptyArrays: true } },
      // Add final resolved fields
      {
        $addFields: {
          resolvedOwnerName: { $ifNull: [ '$resolvedOwner.name', '$deviceMatch.deviceName' ] },
          resolvedOwnerEmail: { $ifNull: [ '$resolvedOwner.email', null ] },
          resolvedOwnerRole: { $ifNull: [ '$resolvedOwner.role', null ] }
        }
      },
      {
        $group: {
          _id: { $cond: [ { $ifNull: ['$resolvedOwnerId', false] }, { owner: '$resolvedOwnerId' }, { device: '$deviceId' } ] },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
          resolvedOwnerName: { $first: '$resolvedOwnerName' },
          resolvedOwnerEmail: { $first: '$resolvedOwnerEmail' },
          resolvedOwnerRole: { $first: '$resolvedOwnerRole' }
        }
      },
      { $sort: { count: -1, amount: -1 } }
    ])

    const rows = agg.map(item => {
      if (item._id.owner) {
        return {
          userId: String(item._id.owner),
          name: item.resolvedOwnerName || 'Unknown',
          email: item.resolvedOwnerEmail || null,
          role: item.resolvedOwnerRole || null,
          count: item.count,
          amount: item.amount || 0
        }
      }
      return {
        userId: null,
        name: item._id.device || 'Unknown device',
        email: null,
        role: null,
        count: item.count,
        amount: item.amount || 0
      }
    })

    return res.json({ success: true, data: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: err.message || 'Server error' })
  }
})

// Users list with aggregates
router.get('/users', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(5000, Number(limit)));

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
    
    console.log(`[AdminAPI] Fetching devices - Page: ${page}, Limit: ${limit}`);

    const devices = await Device.find().sort({ createdAt: -1 }).skip(skip).limit(lim).populate('owner', 'name email').lean();
    
    console.log(`[AdminAPI] Found ${devices.length} devices`);

    const deviceKeys = [];
    devices.forEach(d => {
      deviceKeys.push(String(d._id));
      if (d.deviceCode) deviceKeys.push(d.deviceCode);
      if (d.deviceUserName) deviceKeys.push(d.deviceUserName);
      if (d.deviceName) deviceKeys.push(d.deviceName);
    });

    let statsMap = new Map();
    try {
      if (deviceKeys.length > 0) {
        const statsAgg = await PaymentMessage.aggregate([
          { $match: { verify: true, deviceId: { $in: deviceKeys } } },
          { $group: { _id: '$deviceId', total: { $sum: 1 }, amount: { $sum: '$amount' } } }
        ]);
        statsMap = new Map(statsAgg.map(s => [s._id, s]));
      }
    } catch (aggErr) {
      console.error('[AdminAPI] Stats aggregation failed:', aggErr.message);
    }

    const data = devices.map(d => {
      const keys = [String(d._id), d.deviceCode, d.deviceUserName, d.deviceName].filter(Boolean);
      let total = 0, amount = 0;
      keys.forEach(k => { 
        const s = statsMap.get(k); 
        if (s) { total += s.total; amount += s.amount; } 
      });

      return {
        _id: d._id,
        deviceUserName: d.deviceUserName,
        deviceName: d.deviceName,
        deviceCode: d.deviceCode,
        owner: d.owner,
        subscriptionEndDate: d.subscriptionEndDate,
        state: d.state,
        verifiedPayments: total,
        verifiedAmount: amount,
        createdAt: d.createdAt,
      };
    });

    const totalDevices = await Device.countDocuments();
    return res.json({ success: true, data, page: Number(page), total: totalDevices });
  } catch (err) {
    console.error('[AdminAPI] Error in /devices:', err);
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
      let presence = null;
      const keysToCheck = [
        d.deviceCode ? String(d.deviceCode) : null,
        d._id ? String(d._id) : null,
        d.deviceUserName ? String(d.deviceUserName) : null,
        d.deviceName ? String(d.deviceName) : null
      ].filter(Boolean);

      for (const key of keysToCheck) {
        if (presenceMap.has(key)) {
          presence = presenceMap.get(key);
          break;
        }
      }

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

    // Find all PaymentMethod rows linked to this device
    const paymentMethods = await PaymentMethod.find({ device: device._id });
    const pmIds = paymentMethods.map(pm => pm._id);

    // Delete all PaymentMethodPageContent rows linked to these payment methods
    if (pmIds.length > 0) {
      await PaymentMethodPageContent.deleteMany({ paymentMethod: { $in: pmIds } });
    }

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
    const { page = 1, limit = 50, q, status, userId, deviceId, from, to } = req.query;
    
    // Pagination
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(200, Number(limit)));

    // Base query
    const match = {};

    // Filter by Verification Status
    if (status === 'verified') match.verify = true;
    else if (status === 'unverified') match.verify = false;
    // else 'all' -> no filter

    // Filter by specific User (supporting both userId and owner parameter names)
    const targetUserId = userId || req.query.owner;
    if (targetUserId) {
       const userDevices = await Device.find({ owner: targetUserId }).select('_id deviceUserName deviceCode deviceName').lean();
       const ids = [];
       userDevices.forEach(d => ids.push(String(d._id), d.deviceUserName, d.deviceCode, d.deviceName));
       match.deviceId = { $in: ids.filter(Boolean) };
    }

    // Filter by specific Device
    if (deviceId) {
       match.deviceId = deviceId; 
    }

    // Filter by Date Range
    if (from || to) {
      match.createdAt = {};
      if (from) {
        const f = new Date(from);
        if (!isNaN(f)) match.createdAt.$gte = f;
      }
      if (to) {
        const t = new Date(to);
        if (!isNaN(t)) match.createdAt.$lte = t;
      }
      if (!Object.keys(match.createdAt).length) delete match.createdAt;
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

// Set agent's auto withdrawal commission rate (Admin only)
// Body: { rate: Number }  — e.g. { rate: 2 } sets 2%
router.post('/users/:id/commission-rate', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    let { rate } = req.body;
    rate = Number(rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ success: false, message: 'Rate must be a number between 0 and 100' });
    }
    const updated = await User.findByIdAndUpdate(
      id,
      { autoWithdrawalCommissionRate: rate },
      { new: true }
    ).select('-password');
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: updated, message: `Commission rate set to ${rate}%` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Send Push Notification (Admin Only)
router.post('/push-notification', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { deviceId, title, body, isAlarm } = req.body;
    
    if (!title && !body && !isAlarm) {
      return res.status(400).json({ success: false, message: 'Title/body or isAlarm flag is required' });
    }

    const { admin: firebaseAdmin, isFirebaseInitialized } = require('../firebase');
    if (!isFirebaseInitialized) {
      return res.status(500).json({ success: false, message: 'Firebase Admin SDK not initialized on server' });
    }

    let payload = {};
    if (isAlarm) {
      payload = {
        data: {
          type: "alarm",
          message: body || "Emergency Alarm!"
        },
        android: {
          priority: "high"
        }
      };
    } else {
      payload = {
        data: {
          type: "notification",
          title: title,
          message: body
        },
        android: {
          priority: "high"
        }
      };
    }

    let targetDevices = [];
    let targetTokens = [];

    if (deviceId === 'all') {
      targetDevices = await Device.find({ fcmToken: { $ne: null } }).select('_id fcmToken').lean();
      targetTokens = targetDevices.map(d => d.fcmToken).filter(Boolean);
    } else {
      const device = await Device.findById(deviceId).select('_id fcmToken').lean();
      if (!device || !device.fcmToken) {
        return res.status(404).json({ success: false, message: 'Device not found or missing FCM token' });
      }
      targetDevices = [device];
      targetTokens = [device.fcmToken];
    }

    if (targetTokens.length === 0) {
      return res.status(404).json({ success: false, message: 'No FCM tokens found to send notifications' });
    }

    const response = await firebaseAdmin.messaging().sendEachForMulticast({
      tokens: targetTokens,
      ...payload
    });

    if (response.successCount > 0) {
      const logsToInsert = [];
      response.responses.forEach((resp, index) => {
        if (resp.success) {
           logsToInsert.push({
             device: targetDevices[index]._id,
             type: isAlarm ? 'alarm' : 'notification',
             title: title || 'Emergency Alarm!',
             message: body || 'Emergency Alarm!',
             status: 'sent'
           });
        }
      });
      if (logsToInsert.length > 0) {
        await PushLog.insertMany(logsToInsert);
      }
    }

    return res.json({
      success: true,
      message: `Notifications sent successfully. Success: ${response.successCount}, Failure: ${response.failureCount}`,
      details: response
    });
  } catch (err) {
    console.error('[Firebase] Send Notification Error:', err);
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

    const merchantIds = Array.from(new Set(items.map((it) => {
      const val = it.merchant?._id || it.merchant;
      return val ? String(val) : null;
    }).filter(v => v && v !== 'undefined' && v !== 'null')));

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

// Update user (admin only) - basic fields + role + password
router.patch('/users/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, email, role, password } = req.body || {};
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
    if (typeof password === 'string' && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(password.trim(), salt);
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

// Delete a user and cascade delete all their devices, payment methods, page content & subscriptions (admin only)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Cascade delete
    await User.findByIdAndDelete(userId);
    await Device.deleteMany({ owner: userId });
    await PaymentMethod.deleteMany({ owner: userId });
    await PaymentMethodPageContent.deleteMany({ owner: userId });
    await UserSubscription.deleteMany({ user: userId });

    return res.json({ success: true, message: 'User and all associated devices/methods deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
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
  const ApiAccessToken = require('../models/ApiAccessToken');
  const PaymentMethod = require('../models/PaymentMethod');

  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      txnId = '',
      startDate, 
      endDate, 
      status,
      businessId,
      targetOwnerId,
      ownerId,
      // Advanced filters for PaymentMessage
      f_amount,
      f_masking,
      f_from,
      f_trxid,
      f_pmDateStart,
      f_pmDateEnd,
      f_pmTimeStart,
      f_pmTimeEnd,
      f_deviceName,
      f_deviceId,
      f_bdTimeStart,
      f_bdTimeEnd,
      f_verify
    } = req.query;
    
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 50));
    const skip = (pageNum - 1) * lim;

    let businessSessions = [];
    let totalBusiness = 0;
    let personalTokens = [];
    let totalPersonal = 0;

    // Build sub-query for PaymentMessage filters if active
    let pmQuery = {};
    let pmFilterActive = false;

    if (f_amount) {
      pmQuery.amount = Number(f_amount);
      pmFilterActive = true;
    }
    if (f_masking && String(f_masking).trim()) {
      pmQuery.masking = new RegExp(String(f_masking).trim(), 'i');
      pmFilterActive = true;
    }
    if (f_from && String(f_from).trim()) {
      pmQuery.from = new RegExp(String(f_from).trim(), 'i');
      pmFilterActive = true;
    }
    if (f_trxid && String(f_trxid).trim()) {
      pmQuery.trxID = new RegExp(String(f_trxid).trim(), 'i');
      pmFilterActive = true;
    }
    if (f_deviceName && String(f_deviceName).trim()) {
      pmQuery.deviceName = new RegExp(String(f_deviceName).trim(), 'i');
      pmFilterActive = true;
    }
    if (f_deviceId && String(f_deviceId).trim()) {
      pmQuery.deviceId = new RegExp(String(f_deviceId).trim(), 'i');
      pmFilterActive = true;
    }
    if (f_verify && f_verify !== 'all') {
      pmQuery.verify = f_verify === 'true';
      pmFilterActive = true;
    }

    if (f_pmDateStart || f_pmDateEnd) {
      pmQuery.date = {};
      if (f_pmDateStart) pmQuery.date.$gte = String(f_pmDateStart);
      if (f_pmDateEnd) pmQuery.date.$lte = String(f_pmDateEnd);
      pmFilterActive = true;
    }

    if (f_pmTimeStart || f_pmTimeEnd) {
      pmQuery.time = {};
      if (f_pmTimeStart) pmQuery.time.$gte = String(f_pmTimeStart);
      if (f_pmTimeEnd) pmQuery.time.$lte = String(f_pmTimeEnd);
      pmFilterActive = true;
    }

    if (f_bdTimeStart || f_bdTimeEnd) {
      pmQuery.BDTimeZone = {};
      if (f_bdTimeStart) pmQuery.BDTimeZone.$gte = String(f_bdTimeStart);
      if (f_bdTimeEnd) pmQuery.BDTimeZone.$lte = String(f_bdTimeEnd);
      pmFilterActive = true;
    }

    let matchingPMIds = [];
    let matchingPersonalTokenIds = [];
    if (pmFilterActive) {
      const PaymentMessage = require('../models/PaymentMessage');
      const pms = await PaymentMessage.find(pmQuery).select('_id apiAccessToken').lean();
      matchingPMIds = pms.map(m => m._id);
      matchingPersonalTokenIds = pms.map(m => m.apiAccessToken).filter(Boolean);
    }

    let baseQuery = {};
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate && !isNaN(Date.parse(startDate))) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDay = new Date(endDate);
        if (!isNaN(endDay.getTime())) {
          endDay.setHours(23, 59, 59, 999);
          dateFilter.$lte = endDay;
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        baseQuery.createdAt = dateFilter;
      }
    }
    if (status && status !== 'all') {
      baseQuery.status = status;
    }

    const businessQuery = { ...baseQuery };
    const personalQuery = { ...baseQuery };

    if (pmFilterActive) {
      businessQuery.paymentMessage = { $in: matchingPMIds };
      personalQuery._id = { $in: matchingPersonalTokenIds };
    }

    if (businessId && String(businessId).trim() && String(businessId) !== 'all') {
      businessQuery.business = businessId;
      personalQuery._id = { $in: [] };
    }

    if (targetOwnerId && String(targetOwnerId).trim() && String(targetOwnerId) !== 'all') {
      personalQuery.owner = targetOwnerId;

      const targetMethods = await PaymentMethod.find({ owner: targetOwnerId })
        .select('accountNumber')
        .lean();
      const targetAccountNumbers = targetMethods.map(method => method.accountNumber).filter(Boolean);
      if (targetAccountNumbers.length > 0) {
        const PaymentMessage = require('../models/PaymentMessage');
        const matchingMsgs = await PaymentMessage.find({
          $or: [
            { from: { $in: targetAccountNumbers } },
            { masking: { $in: targetAccountNumbers } }
          ]
        }).select('_id').lean();
        const matchingMsgIds = matchingMsgs.map(m => m._id);

        const targetSessionMatch = {
          $or: [
            { 'events.meta.method.accountNumber': { $in: targetAccountNumbers } },
            { paymentMessage: { $in: matchingMsgIds } }
          ]
        };
        businessQuery.$and = businessQuery.$and || [];
        businessQuery.$and.push(targetSessionMatch);
      } else {
        businessQuery._id = { $in: [] };
      }
    }

    if (ownerId && String(ownerId).trim() && String(ownerId) !== 'all') {
      personalQuery.owner = ownerId;
    }

    // Apply explicit txnId filter if provided
    if (txnId && String(txnId).trim()) {
      const txnRegex = new RegExp(String(txnId).trim(), 'i');
      const pms = await PaymentMessage.find({ trxID: txnRegex }).select('_id apiAccessToken').lean();
      const txnIdMessageIds = pms.map(m => m._id);
      const txnIdPersonalTokenIds = pms.map(m => m.apiAccessToken).filter(Boolean);

      const businessTxnIdFilter = {
        $or: [
          { paymentMessage: { $in: txnIdMessageIds } },
          { 'lastVerificationFailure.trxid': txnRegex },
          { 'verificationAttempts.trxid': txnRegex },
          { 'events.meta.txid': txnRegex },
          { 'events.meta.trxid': txnRegex }
        ]
      };
      businessQuery.$and = businessQuery.$and || [];
      businessQuery.$and.push(businessTxnIdFilter);

      const personalTxnIdFilter = {
        _id: { $in: txnIdPersonalTokenIds }
      };
      personalQuery.$and = personalQuery.$and || [];
      personalQuery.$and.push(personalTxnIdFilter);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      const OpayBusiness = require('../models/OpayBusiness');
      const PaymentMessage = require('../models/PaymentMessage');
      const User = require('../models/User');
      
      const [matchingBusinesses, matchingMessages, matchingUsers] = await Promise.all([
        OpayBusiness.find({ 
          $or: [{ name: searchRegex }, { domain: searchRegex }, { email: searchRegex }, { apiToken: searchRegex }] 
        }).select('_id').lean(),
        PaymentMessage.find({ 
          $or: [
            { trxID: searchRegex }, 
            { from: searchRegex }, 
            { fullMessage: searchRegex }, 
            { masking: searchRegex }, 
            { deviceId: searchRegex }
          ] 
        }).select('_id apiAccessToken').lean(),
        User.find({
          $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
        }).select('_id').lean()
      ]);
      
      const businessIds = matchingBusinesses.map(b => b._id);
      const messageIds = matchingMessages.map(m => m._id);
      const personalTokenIdsFromMsgs = matchingMessages.map(m => m.apiAccessToken).filter(Boolean);
      const userIds = matchingUsers.map(u => u._id);

      // --- Business Session Query ---
      const businessSearchMatch = {
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
          { 'lastVerificationFailure.trxid': searchRegex },
          { 'verificationAttempts.trxid': searchRegex },
          { 'events.meta.txid': searchRegex },
          { 'events.meta.trxid': searchRegex },
          { 'walletAgentSnapshot.agentName': searchRegex },
          { 'walletAgentSnapshot.agentId': { $in: userIds } }
        ]
      };

      if (!isNaN(search)) {
        const num = Number(search);
        businessSearchMatch.$or.push({ amount: num });
      }

      businessQuery.$and = businessQuery.$and || [];
      businessQuery.$and.push(businessSearchMatch);

      // --- Personal Token Query ---
      const personalSearchMatch = {
        $or: [
          { token: searchRegex },
          { userIdentifyAddress: searchRegex },
          { owner: { $in: userIds } },
          { _id: { $in: personalTokenIdsFromMsgs } },
          { 'meta.callbackUrl': searchRegex },
          { 'meta.orderId': searchRegex }
        ]
      };

      if (!isNaN(search)) {
        const num = Number(search);
        personalSearchMatch.$or.push({ 'meta.amount': num });
      }

      personalQuery.$and = personalQuery.$and || [];
      personalQuery.$and.push(personalSearchMatch);
    }

    [businessSessions, totalBusiness, personalTokens, totalPersonal] = await Promise.all([
      OpayBusinessPaymentSession.find(businessQuery)
        .populate('business', 'name domain email')
        .populate('paymentMessage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(businessQuery),
      ApiAccessToken.find(personalQuery)
        .populate('owner', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      ApiAccessToken.countDocuments(personalQuery),
    ]);

    const items = [...businessSessions];

    const total = totalBusiness + totalPersonal;


    const Device = require('../models/Device');
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
        events: undefined,
        resolvedDevice,
        resolvedMethod,
        attemptedTrxId,
        attemptedPaymentMessage,
        payment_page_url: `${baseUrl}/payment/${s.code}`,
        footprintUrl: s.footprintUrl || `${baseUrl}/payment/${s.code}/mask/footprint`,
        footprintUrlNonMask: s.footprintUrlNonMask || `${baseUrl}/payment/${s.code}/footprint`,
      };
    });

    // High-speed bulk matching for linked PaymentMessage to avoid N+1 queries in loops
    const personalTokenIds = personalTokens.map(t => t._id);
    const linkedMsgs = personalTokenIds.length 
      ? await PaymentMessage.find({ apiAccessToken: { $in: personalTokenIds } }).lean() 
      : [];
    const linkedMsgMap = new Map(linkedMsgs.map((m) => [String(m.apiAccessToken), m]));

    // Process Personal Tokens in-memory (0 database queries in loop)
    const processedPersonal = personalTokens.map((t) => {
       const linkedMsg = linkedMsgMap.get(String(t._id)) || null;
       const status = linkedMsg ? 'paid' : (new Date(t.expiresAt) < new Date() ? 'expired' : 'pending');
       
       return {
         _id: t._id,
         code: t.token,
         amount: t.meta?.amount || 0,
         status,
         createdAt: t.createdAt,
         updatedAt: t.updatedAt,
         expiresAt: t.expiresAt,
         userIdentityAddress: t.userIdentifyAddress,
         business: { name: 'Personal (User)', email: t.owner?.email, domain: t.owner?.name },
         paymentMessage: linkedMsg,
         callbackUrl: t.meta?.callbackUrl,
         isPersonal: true,
         payment_page_url: `${baseUrl}/${t.methods?.join(',')}/${t.token}`,
       };
    });

    const finalData = [...data, ...processedPersonal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, lim);

    return res.json({
      success: true,
      data: finalData,
      page: pageNum,
      total
    });
  } catch (err) {
    console.error('admin get global payment-sessions error:', err);
    return res.status(500).json({ success: false, message: 'Server error while loading payment sessions' });
  }
});

// Get a single payment link session by ID (with full events data)
router.get('/payment-sessions/:id', auth, async (req, res) => {
  const ApiAccessToken = require('../models/ApiAccessToken');
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    const { id } = req.params;
    
    // Check if it's a business session
    let session = await OpayBusinessPaymentSession.findById(id)
      .populate('business', 'name domain email')
      .populate('paymentMessage')
      .lean();
      
    let isBusiness = true;

    // If not found, check personal token
    if (!session) {
      session = await ApiAccessToken.findById(id)
        .populate('owner', 'name email phone')
        .lean();
      isBusiness = false;
    }

    if (!session) {
      return res.status(404).json({ success: false, message: 'Payment session not found' });
    }

    const Device = require('../models/Device');
    const PaymentMethod = require('../models/PaymentMethod');
    
    const devId = session.verificationFootprint?.deviceId || session.paymentMessage?.deviceId;
    const resolvedDevice = devId ? await Device.findOne({ deviceCode: devId }).populate('owner', 'name email phone').lean() : null;

    let tNum = null;
    if (session.events && Array.isArray(session.events)) {
      tNum = session.events.find(e => e.type === 'pay_click')?.meta?.method?.accountNumber;
    }
    tNum = tNum || session.paymentMessage?.from || session.paymentMessage?.masking;

    const resolvedMethod = tNum ? await PaymentMethod.findOne({ accountNumber: tNum }).populate('owner', 'name email phone').lean() : null;

    let attemptedTrxId = null;
    if (session.lastVerificationFailure?.trxid) {
      attemptedTrxId = String(session.lastVerificationFailure.trxid).trim();
    } else if (Array.isArray(session.verificationAttempts)) {
      for (let i = session.verificationAttempts.length - 1; i >= 0; i -= 1) {
        if (session.verificationAttempts[i]?.trxid) {
          attemptedTrxId = String(session.verificationAttempts[i].trxid).trim();
          break;
        }
      }
    }
    
    if (!attemptedTrxId && Array.isArray(session.events)) {
      for (let i = session.events.length - 1; i >= 0; i -= 1) {
        const evId = session.events[i]?.meta?.txid || session.events[i]?.meta?.trxid;
        if (evId) {
          attemptedTrxId = String(evId).trim();
          break;
        }
      }
    }

    const PaymentMessageModel = require('../models/PaymentMessage');
    const attemptedPaymentMessage = attemptedTrxId 
      ? await PaymentMessageModel.findOne({ trxID: new RegExp(`^${attemptedTrxId}$`, 'i') }).lean() 
      : null;

    const baseUrl = (process.env.OPAY_PAYMENT_PAGE_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '');
    
    const returnData = {
      ...session,
      resolvedDevice,
      resolvedMethod,
      attemptedTrxId,
      attemptedPaymentMessage,
      payment_page_url: isBusiness ? `${baseUrl}/payment/${session.code}` : `${baseUrl}/payment/${session.token}`,
      footprintUrl: isBusiness ? (session.footprintUrl || `${baseUrl}/payment/${session.code}/mask/footprint`) : undefined,
      footprintUrlNonMask: isBusiness ? (session.footprintUrlNonMask || `${baseUrl}/payment/${session.code}/footprint`) : undefined,
    };

    res.json({ success: true, data: returnData });
  } catch (err) {
    console.error('admin get payment-session detail error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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
        const startOfToday = require('moment-timezone')().tz('Asia/Dhaka').startOf('day').toDate();
        
        const [paidStats, withStats, todayStats, autoWithStats] = await Promise.all([
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
            ]),
            AutoWithdrawalRequest.aggregate([
                { $match: { merchant: busId, status: { $in: ['pending', 'booked', 'completed'] } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$deductedAmount', '$amount'] } } } }
            ])
        ]);

        const totalSuccessAmount = (paidStats[0]?.total) || 0;
        const totalWithdrawalAmount = (withStats[0]?.total) || 0;
        const totalAutoWithdrawalAmount = (autoWithStats[0]?.total) || 0;
        const availableBalance = totalSuccessAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + (b.balanceAdjustment || 0);
        
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
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const businessId = new mongoose.Types.ObjectId(String(id).trim());
    const query = { business: businessId };
    const trimmedStatus = status ? String(status).trim() : null;
    
    if (trimmedStatus && trimmedStatus !== 'all') {
      // Use case-insensitive regex for status matching to be robust
      query.status = { $regex: new RegExp(`^${trimmedStatus}$`, 'i') };
    }

    const [items, total, stats] = await Promise.all([
      OpayBusinessPaymentSession.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(query),
      OpayBusinessPaymentSession.aggregate([
        { $match: { business: businessId } },
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
        { $match: { merchantId: businessId, status: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawalAmount = withdrawals[0]?.total || 0;

    const autoWithdrawals = await AutoWithdrawalRequest.aggregate([
        { $match: { merchant: businessId, status: { $in: ['pending', 'booked', 'completed'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$deductedAmount', '$amount'] } } } }
    ]);
    const totalAutoWithdrawalAmount = autoWithdrawals[0]?.total || 0;

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
    summary.availableBalance = summary.successAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + balanceAdjustment;

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

    return res.json({ success: true, data, page: pageNum, total, summary, debugQuery: query });
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

    const [totalsRes, withdrawalRes, autoWithRes, graphRes] = await Promise.all([
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
      AutoWithdrawalRequest.aggregate([
        { $match: { merchant: businessId, status: { $in: ['pending', 'booked', 'completed'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$deductedAmount', '$amount'] } } } }
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
    const totalAutoWithdrawalAmount = autoWithRes[0]?.total || 0;
    const business = await OpayBusiness.findById(id).select('balanceAdjustment').lean();
    const balanceAdjustment = business?.balanceAdjustment || 0;
    resTotals.balanceAdjustment = balanceAdjustment;
    resTotals.availableBalance = resTotals.totalSuccessAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + balanceAdjustment;

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

    // Find the activation payment session (if any)
    const activationSession = await OpayBusinessPaymentSession.findOne({
      'checkoutItems.merchantIdToActivate': req.params.id
    }).populate('paymentMessage').lean();

    return res.json({ success: true, data: { ...item, activationSession } });
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

// Admin: Toggle Lifetime Payment (Manual Activation)
router.post('/opay-businesses/:id/toggle-lifetime-payment', auth, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        const business = await OpayBusiness.findById(req.params.id);
        if (!business) return res.status(404).json({ message: "Business not found" });

        business.isLifetimePaid = !business.isLifetimePaid;
        
        if (business.isLifetimePaid) {
          business.allowDeposit = req.body.allowDeposit !== undefined ? req.body.allowDeposit : true;
          business.allowAutoWithdrawal = req.body.allowAutoWithdrawal !== undefined ? req.body.allowAutoWithdrawal : true;
        } else {
          business.allowDeposit = false;
          business.allowAutoWithdrawal = false;
          business.activePackageId = null;
        }

        await business.save();
        
        return res.json({ 
            success: true, 
            message: `Lifetime Payment status is now ${business.isLifetimePaid ? 'PAID' : 'UNPAID'}`, 
            data: business 
        });
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

// Update Opay business basic fields (enabled, password)
router.patch('/opay-businesses/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const { enabled, password } = req.body || {};

    const update = {};
    if (typeof enabled === 'boolean') update.enabled = enabled;

    if (password !== undefined) {
      if (typeof password !== 'string' || password.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      update.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await OpayBusiness.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Business not found' });
    delete updated.passwordHash;
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: Assign / Change Package for a Merchant
router.post('/opay-businesses/:id/assign-package', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const { packageId } = req.body || {};

    const business = await OpayBusiness.findById(id);
    if (!business) return res.status(404).json({ success: false, message: 'Merchant not found' });

    if (packageId) {
      const pkg = await OpayBusinessPackage.findById(packageId);
      if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

      business.activePackageId = pkg._id;
      business.isLifetimePaid = true;
      business.allowDeposit = pkg.packageType === 'both' || pkg.packageType === 'deposit';
      business.allowAutoWithdrawal = pkg.packageType === 'both' || pkg.packageType === 'withdrawal';
    } else {
      business.activePackageId = null;
    }

    await business.save();
    return res.json({ success: true, message: 'Merchant package updated successfully', data: business });
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
    
    // Send SMS Notification to Merchant on status change (Approved/Rejected)
    try {
      const business = await OpayBusiness.findById(updated.merchantId).select('name kycData').lean();
      const merchantPhone = business?.kycData?.primaryContact?.phone || business?.kycData?.company?.mdMobile;
      if (merchantPhone && ['approved', 'rejected'].includes(status)) {
        const formattedMerchant = merchantPhone.startsWith("88") ? merchantPhone : (merchantPhone.startsWith("0") ? "88" + merchantPhone : "880" + merchantPhone);
        let msgText = '';
        if (status === 'approved') {
          msgText = `Congratulations ${business?.name || 'Merchant'}!\nYour Withdrawal request for ${updated.amount} BDT has been APPROVED.\nThank you!`;
        } else if (status === 'rejected') {
          msgText = `Dear Merchant,\nYour Withdrawal request for ${updated.amount} BDT has been REJECTED.\nReason: ${rejectReason || 'N/A'}\nThank you!`;
        }

        await fetch("https://api.o-sms.com/api/service/send-single", {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient: formattedMerchant, message: msgText })
        }).catch(e => console.error("Failed to send status update SMS to merchant:", e.message));
      }
    } catch (notifyErr) {
      console.error("Merchant status SMS notification error:", notifyErr.message);
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// DELETE /api/admin/merchant-withdrawals/:id (Delete test or invalid withdrawal request)
router.delete('/merchant-withdrawals/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const deleted = await MerchantWithdrawal.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    return res.json({ success: true, message: 'Merchant withdrawal deleted successfully' });
  } catch (err) {
    console.error('Delete merchant withdrawal error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// DELETE /api/admin/auto-withdrawals/:id (Delete test or invalid auto withdrawal request)
router.delete('/auto-withdrawals/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { id } = req.params;
    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    const deleted = await AutoWithdrawalRequest.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Auto withdrawal request not found' });
    return res.json({ success: true, message: 'Auto withdrawal deleted successfully' });
  } catch (err) {
    console.error('Delete auto withdrawal error:', err);
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

// Get push notification history
router.get('/push-logs', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    // Fetch last 100 logs
    const logs = await PushLog.find()
      .populate('device', 'deviceName deviceCode deviceUserName')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ success: true, logs });
  } catch (err) {
    console.error('Error fetching push logs:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all OpayBusinessPackages
router.get('/opay-business-packages', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const packages = await OpayBusinessPackage.find().sort({ createdAt: 1 }).lean();
    return res.json({ success: true, data: packages });
  } catch (err) {
    console.error('Error fetching business packages:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new OpayBusinessPackage
router.post('/opay-business-packages', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, amount, offerDetails, features, isActive, packageType } = req.body || {};

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return res.status(400).json({ success: false, message: 'Invalid activation fee amount' });
    }
    if (!Array.isArray(features)) {
      return res.status(400).json({ success: false, message: 'Features list must be an array' });
    }

    const pkg = new OpayBusinessPackage({
      name: String(name || 'Lifetime Activation Package').trim(),
      amount: amountNum,
      offerDetails: String(offerDetails || '').trim(),
      features: features.map(f => String(f).trim()),
      isActive: typeof isActive === 'boolean' ? isActive : true,
      packageType: packageType || 'both'
    });

    await pkg.save();
    return res.json({ success: true, message: 'Package created successfully', data: pkg });
  } catch (err) {
    console.error('Error creating business package:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update OpayBusinessPackage
router.put('/opay-business-packages/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, amount, offerDetails, features, isActive, packageType } = req.body || {};
    
    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (amount !== undefined) updateData.amount = Number(amount);
    if (offerDetails !== undefined) updateData.offerDetails = String(offerDetails).trim();
    if (features && Array.isArray(features)) updateData.features = features.map(f => String(f).trim());
    if (isActive !== undefined) updateData.isActive = isActive;
    if (packageType !== undefined) updateData.packageType = packageType;

    const pkg = await OpayBusinessPackage.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    return res.json({ success: true, message: 'Package updated successfully', data: pkg });
  } catch (err) {
    console.error('Error updating business package:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete OpayBusinessPackage
router.delete('/opay-business-packages/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const pkg = await OpayBusinessPackage.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    return res.json({ success: true, message: 'Package deleted successfully' });
  } catch (err) {
    console.error('Error deleting business package:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== PENDING NAGAD VERIFICATION ====================

// Get pending nagad sessions
router.get('/pending-nagad', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const query = { status: 'pending_nagad' };
    const [items, total] = await Promise.all([
      OpayBusinessPaymentSession.find(query)
        .populate('business')
        .populate('paymentMessage')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(query),
    ]);

    return res.json({ success: true, data: items, page: pageNum, total });
  } catch (err) {
    console.error('Error fetching pending nagad sessions:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve a pending Nagad session
router.post('/pending-nagad/accept', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_nagad' }).populate('business');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending session not found' });
    }

    const matchedMessage = await PaymentMessage.findById(session.paymentMessage);
    if (!matchedMessage) {
      return res.status(404).json({ success: false, message: 'Transaction message not found' });
    }

    if (matchedMessage.verify) {
      return res.status(400).json({ success: false, message: 'Transaction ID already used' });
    }

    // Mark verified
    matchedMessage.verify = true;
    await matchedMessage.save();

    session.status = 'paid';
    session.paymentMessage = matchedMessage._id;

    // Resolve PaymentMethod to find wallet agent
    const attempts = Array.isArray(session.verificationAttempts) ? session.verificationAttempts : [];
    const agentAccountNumber = attempts[attempts.length - 1]?.agentAccountNumber;

    let method = null;
    if (agentAccountNumber) {
      method = await PaymentMethod.findOne({ accountNumber: agentAccountNumber, provider: 'nagad', status: 'active' });
    }

    if (!method) {
      const deviceIdentifier = matchedMessage.deviceId || matchedMessage.deviceName;
      method = await PaymentMethod.findOne({ device: deviceIdentifier, provider: 'nagad', status: 'active' });
    }

    if (method) {
      // ── Wallet Agent Credit Deduction ──
      const paymentAmount = Number(session.amount) || 0;
      let walletAgentSnapshot = null;

      try {
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
          console.log(`[CREDIT DEDUCTED - ADMIN NAGAD] Agent: ${agentUser.name}, Before: ৳${creditBefore}, After: ৳${creditAfter}, Deducted: ৳${paymentAmount}`);
          
          await updateAgentMethodsStatus(agentUser._id);
        }
      } catch (creditErr) {
        console.error('[CREDIT DEDUCTION ERROR - ADMIN NAGAD]', creditErr.message);
      }
    }

    // ── Merchant Balance Snapshot ──
    try {
      const business = await OpayBusiness.findById(session.business._id || session.business).select('name balanceAdjustment');
      if (business) {
        const paymentAmount = Number(session.amount) || 0;
        const previousPaidTotal = await OpayBusinessPaymentSession.aggregate([
          { $match: { business: business._id, status: 'paid', _id: { $ne: session._id } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const balanceBefore = (previousPaidTotal[0]?.total || 0) + (business.balanceAdjustment || 0);
        const balanceAfter = balanceBefore + paymentAmount;

        const merchantSnapshot = {
          businessId: business._id,
          businessName: business.name || 'Unknown Merchant',
          balanceBefore,
          balanceAfter,
          balanceAdded: paymentAmount,
        };

        session.merchantSnapshot = merchantSnapshot;
        console.log(`[MERCHANT SNAPSHOT - ADMIN NAGAD] ${business.name}: Before ৳${balanceBefore} → After ৳${balanceAfter} (+৳${paymentAmount})`);
      }
    } catch (balErr) {
      console.error('[MERCHANT SNAPSHOT ERROR - ADMIN NAGAD]', balErr.message);
    }

    await session.save();
    console.log(`[VERIFY SUCCESS - ADMIN NAGAD] Nagad session ${code} verified by admin and marked as paid`);

    // If activation payment, activate merchant
    if (session.checkoutItems && session.checkoutItems.type === 'Activation Payment' && session.checkoutItems.merchantIdToActivate) {
      try {
        const merchantToActivate = await OpayBusiness.findById(session.checkoutItems.merchantIdToActivate);
        if (merchantToActivate) {
          merchantToActivate.isLifetimePaid = true;
          if (session.checkoutItems.packageId) {
            const pkg = await require('../models/OpayBusinessPackage').findById(session.checkoutItems.packageId);
            if (pkg) {
              merchantToActivate.allowDeposit = pkg.packageType === 'both' || pkg.packageType === 'deposit';
              merchantToActivate.allowAutoWithdrawal = pkg.packageType === 'both' || pkg.packageType === 'withdrawal';
              merchantToActivate.activePackageId = pkg._id;
            }
          } else {
            merchantToActivate.allowDeposit = true;
            merchantToActivate.allowAutoWithdrawal = true;
          }
          await merchantToActivate.save();
          console.log(`[ACTIVATION SUCCESS - ADMIN NAGAD] Activated merchant ${merchantToActivate.email} (ID: ${merchantToActivate._id})`);
        }
      } catch (activationErr) {
        console.error('[ACTIVATION ERROR - ADMIN NAGAD]', activationErr.message);
      }
    }

    // Webhook callback
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
          bank: 'nagad',
          footprint: footprintUrlMasked
        };
        const axios = require('axios');
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

    // Send SMS
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

    return res.json({ success: true, message: 'Payment approved successfully' });
  } catch (err) {
    console.error('Error approving pending Nagad session:', err);
    return res.status(500).json({ success: false, message: 'Server error during approval' });
  }
});

// Reject/cancel a pending Nagad session
router.post('/pending-nagad/reject', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_nagad' });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending session not found' });
    }

    session.status = 'cancelled';
    await session.save();

    console.log(`[VERIFY REJECTED - ADMIN NAGAD] Nagad session ${code} cancelled by admin`);
    return res.json({ success: true, message: 'Payment session cancelled successfully' });
  } catch (err) {
    console.error('Error rejecting pending Nagad session:', err);
    return res.status(500).json({ success: false, message: 'Server error during rejection' });
  }
});

// Admin Reject Auto Withdrawal
router.post('/auto-withdrawals/:id/reject', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    const { id } = req.params;
    const { reason } = req.body || {};
    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    const axios = require('axios');
    
    const request = await AutoWithdrawalRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Auto withdrawal request not found' });
    }
    
    if (request.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already completed request' });
    }
    if (request.status === 'rejected') {
      return res.status(400).json({ success: false, message: 'Request is already rejected' });
    }
    
    request.status = 'rejected';
    if (reason) {
      request.rejectReason = reason.trim();
    }
    
    // Send callback to merchant notifying rejection
    if (request.callbackUrl) {
      try {
        const payload = {
          status: 'REJECTED',
          withdrawal_id: request._id,
          amount: request.amount,
          payment_method: request.paymentMethod,
          user_identity_address: request.userIdentityAddress,
          account_number: request.accountNumber,
          checkout_items: request.checkoutItems,
          reason: request.rejectReason || 'Rejected by administrator'
        };
        const cbRes = await axios.post(request.callbackUrl, payload, { timeout: 10000 });
        request.callbackResult = {
          success: true,
          statusCode: cbRes.status,
          data: cbRes.data,
          note: 'Rejected callback sent'
        };
      } catch (cbErr) {
        request.callbackResult = {
          success: false,
          error: cbErr.message,
          note: 'Failed to send rejected callback'
        };
      }
    }
    
    // Add admin ID to rejectedBy
    if (!request.rejectedBy) request.rejectedBy = [];
    if (!request.rejectedBy.includes(req.user.id)) {
      request.rejectedBy.push(req.user.id);
    }
    
    await request.save();
    
    // Emit socket to update wallet agents who might be looking at it
    const io = req.app.get('socketio');
    if (io) {
      io.emit('auto_withdrawal_rejected', { id: request._id, merchant: request.merchant });
    }
    
    return res.json({ success: true, message: 'Request rejected and merchant notified' });
  } catch (err) {
    console.error('Admin auto-withdrawal reject error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all auto withdrawals
router.get('/auto-withdrawals', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));

    const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
    
    const total = await AutoWithdrawalRequest.countDocuments(query);
    const withdrawals = await AutoWithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('merchant', 'name email company')
      .populate('bookedBy', 'name email phone')
      .populate('rejectedBy', 'name email phone')
      .populate('agentRejections.agent', 'name email phone')
      .lean();

    return res.json({ success: true, data: withdrawals, total });
  } catch (err) {
    console.error('Admin auto-withdrawals error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/merchant-topup-history
router.get('/merchant-topup-history', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const [items, total] = await Promise.all([
      MerchantTopupRecord.find({})
        .populate('merchantId', 'businessName ownerName phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      MerchantTopupRecord.countDocuments({})
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

// --- BANK LIST MANAGEMENT (ADMIN) ---
router.get('/banks', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const BankList = require('../models/BankList');
    const AgentBankAccount = require('../models/AgentBankAccount');
    
    const banks = await BankList.find({}).sort({ sortOrder: 1, name: 1 }).lean();

    // Aggregate how many agent bank accounts exist for each bank name
    const counts = await AgentBankAccount.aggregate([
      { $group: { _id: '$bankName', totalAccounts: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(c => [c._id, c.totalAccounts]));

    const result = banks.map(b => ({
      ...b,
      agentAccountCount: countMap.get(b.name) || 0
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching bank list:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/banks', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const BankList = require('../models/BankList');
    const { name, code, logo, status, sortOrder, bgColor, textColor, labelColor } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Bank name is required' });
    }
    const bank = await BankList.create({
      name: name.trim(),
      code: code ? code.trim() : '',
      logo: logo ? logo.trim() : '',
      status: status === 'inactive' ? 'inactive' : 'active',
      sortOrder: Number(sortOrder) || 0,
      bgColor: bgColor ? bgColor.trim() : '#ffffff',
      textColor: textColor ? textColor.trim() : '#1e293b',
      labelColor: labelColor ? labelColor.trim() : '#94a3b8',
    });
    return res.json({ success: true, data: bank });
  } catch (err) {
    console.error('Error creating bank:', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Bank name already exists' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/banks/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const BankList = require('../models/BankList');
    const { name, code, logo, status, sortOrder, bgColor, textColor, labelColor } = req.body;
    
    const bank = await BankList.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });

    if (name) bank.name = name.trim();
    if (code !== undefined) bank.code = code.trim();
    if (logo !== undefined) bank.logo = logo.trim();
    if (status) bank.status = status === 'inactive' ? 'inactive' : 'active';
    if (sortOrder !== undefined) bank.sortOrder = Number(sortOrder) || 0;
    if (bgColor !== undefined) bank.bgColor = bgColor.trim();
    if (textColor !== undefined) bank.textColor = textColor.trim();
    if (labelColor !== undefined) bank.labelColor = labelColor.trim();

    await bank.save();
    return res.json({ success: true, data: bank });
  } catch (err) {
    console.error('Error updating bank:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/banks/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const BankList = require('../models/BankList');
    await BankList.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Bank deleted' });
  } catch (err) {
    console.error('Error deleting bank:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- PENDING BANK PAYMENTS (ADMIN) ---
router.get('/pending-bank-payments', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const query = { status: 'pending_bank' };
    const [items, total] = await Promise.all([
      OpayBusinessPaymentSession.find(query)
        .populate('business')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      OpayBusinessPaymentSession.countDocuments(query),
    ]);

    return res.json({ success: true, data: items, page: pageNum, total });
  } catch (err) {
    console.error('Error fetching pending bank sessions:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/pending-bank-payments/accept', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_bank' }).populate('business');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending bank session not found or already processed' });
    }

    session.status = 'paid';
    session.lastVerificationSuccessAt = new Date();
    await session.save();

    // Trigger Callback URL
    const payload = {
      status: 'COMPLETED',
      amount: Number(session.amount),
      transaction_id: session.bankDetails?.trxid || session.code,
      invoice_number: session.invoiceNumber || null,
      session_code: session.code,
      user_identity: session.userIdentityAddress || null,
      checkout_items: session.checkoutItems || null,
      bank: 'bank_transfer',
    };

    if (session.callbackUrl) {
      const axios = require('axios');
      axios.post(session.callbackUrl, payload, { timeout: 5000 }).catch(e => console.warn('Callback error:', e.message));
    }

    return res.json({ success: true, message: 'Bank payment accepted successfully', session });
  } catch (err) {
    console.error('Error accepting pending bank payment:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/pending-bank-payments/reject', auth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin only' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_bank' });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending bank session not found' });
    }

    session.status = 'cancelled';
    await session.save();

    return res.json({ success: true, message: 'Bank payment rejected', session });
  } catch (err) {
    console.error('Error rejecting pending bank payment:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
