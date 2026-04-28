const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Device = require('../models/Device');
const PaymentMessage = require('../models/PaymentMessage');
const ApiAccessToken = require('../models/ApiAccessToken');

router.get('/overview', auth, async (req, res) => {
  try {
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceUserName deviceCode');

    if (!devices.length) {
      return res.json({
        success: true,
        data: {
          totals: { totalTransactions: 0, totalAmount: 0 },
          today: { totalTransactions: 0, totalAmount: 0 },
          devices: [],
          providers: [],
          recent: []
        }
      });
    }

    const deviceMap = new Map();
    const deviceIds = [];
    const deviceCodes = [];
    const deviceUserNames = [];
    const deviceNames = [];

    devices.forEach((device) => {
      const id = String(device._id);
      const entry = {
        deviceId: id,
        deviceName: device.deviceName || device.deviceUserName || 'Unnamed Device',
        deviceUserName: device.deviceUserName || null,
        deviceCode: device.deviceCode || null,
      };

      const keys = new Set([
        id,
        device.deviceCode || null,
        device.deviceUserName || null,
        device.deviceName || null,
      ].filter(Boolean).map(String));

      keys.forEach((key) => {
        if (!deviceMap.has(key)) {
          deviceMap.set(key, entry);
        }
      });

      deviceIds.push(id);
      if (device.deviceCode) deviceCodes.push(String(device.deviceCode));
      if (device.deviceUserName) deviceUserNames.push(String(device.deviceUserName));
      if (device.deviceName) deviceNames.push(String(device.deviceName));
    });

    const identifierSet = Array.from(new Set([...deviceIds, ...deviceCodes, ...deviceUserNames]));

    const tokens = await ApiAccessToken.find({ owner: req.user._id }).select('_id');
    const tokenIds = tokens.map((t) => t._id);

    const matchConditions = [];
    if (identifierSet.length) {
      matchConditions.push({ deviceId: { $in: identifierSet } });
    }
    if (deviceNames.length) {
      matchConditions.push({ deviceName: { $in: deviceNames } });
    }

    if (!matchConditions.length && !tokenIds.length) {
      return res.json({
        success: true,
        data: {
          totals: { totalTransactions: 0, totalAmount: 0 },
          today: { totalTransactions: 0, totalAmount: 0 },
          devices: [],
          providers: [],
          recent: [],
        },
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const matchStage = tokenIds.length
      ? { $match: { apiAccessToken: { $in: tokenIds }, verify: true } }
      : { $match: { $and: [{ $or: matchConditions }, { verify: true }] } };

    const [agg] = await PaymentMessage.aggregate([
      matchStage,
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
              },
            },
          ],
          today: [
            { $match: { createdAt: { $gte: startOfToday } } },
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
              },
            },
          ],
          byDevice: [
            { $sort: { createdAt: -1 } },
            {
              $group: {
                _id: '$deviceId',
                totalTransactions: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                lastMessageAt: { $first: '$createdAt' },
                lastTrxID: { $first: '$trxID' },
                provider: { $first: '$title' },
                fallbackName: { $first: '$deviceName' },
              },
            },
            { $sort: { totalAmount: -1 } },
          ],
          byProvider: [
            {
              $group: {
                _id: '$title',
                totalTransactions: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
              },
            },
            { $sort: { totalAmount: -1 } },
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 0,
                trxID: '$trxID',
                amount: '$amount',
                title: '$title',
                deviceId: '$deviceId',
                deviceName: '$deviceName',
                createdAt: '$createdAt',
                verify: '$verify',
              },
            },
          ],
        },
      },
    ]);

    const totalsDoc = agg?.totals?.[0] || { totalTransactions: 0, totalAmount: 0 };
    const todayDoc = agg?.today?.[0] || { totalTransactions: 0, totalAmount: 0 };

    const devicesBreakdown = (agg?.byDevice || []).map((item) => {
      const info = deviceMap.get(String(item._id)) || deviceMap.get(String(item.fallbackName)) || {
        deviceId: String(item._id),
        deviceName: item.fallbackName || 'Unknown device',
        deviceUserName: null,
        deviceCode: null,
      };
      return {
        ...info,
        totalTransactions: item.totalTransactions,
        totalAmount: item.totalAmount,
        lastMessageAt: item.lastMessageAt,
        lastTrxID: item.lastTrxID,
        provider: item.provider || null,
      };
    });

    const providersBreakdown = (agg?.byProvider || []).map((item) => ({
      provider: item._id || 'Unknown',
      totalTransactions: item.totalTransactions,
      totalAmount: item.totalAmount,
    }));

    const recent = (agg?.recent || []).map((item) => {
      const lookup = deviceMap.get(String(item.deviceId)) || deviceMap.get(String(item.deviceName));
      return {
        ...item,
        deviceName: item.deviceName || lookup?.deviceName || 'Unknown device',
      };
    });

    return res.json({
      success: true,
      data: {
        totals: {
          totalTransactions: totalsDoc.totalTransactions || 0,
          totalAmount: totalsDoc.totalAmount || 0,
        },
        today: {
          totalTransactions: todayDoc.totalTransactions || 0,
          totalAmount: todayDoc.totalAmount || 0,
        },
        devices: devicesBreakdown,
        providers: providersBreakdown,
        recent,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List verified payments for current user with filters
// GET /api/dashboard/payments?provider=bkash&from=ISO&to=ISO&min=0&max=999&page=1&limit=20
router.get('/payments', auth, async (req, res) => {
  try {
    const {
      provider,
      from,
      to,
      min,
      max,
      page = 1,
      limit = 20,
    } = req.query;

    // Collect identifiers from user's devices, similar to overview route
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceUserName deviceCode');
    const deviceIds = [];
    const deviceCodes = [];
    const deviceUserNames = [];
    const deviceNames = [];
    devices.forEach((d) => {
      deviceIds.push(String(d._id));
      if (d.deviceCode) deviceCodes.push(String(d.deviceCode));
      if (d.deviceUserName) deviceUserNames.push(String(d.deviceUserName));
      if (d.deviceName) deviceNames.push(String(d.deviceName));
    });
    const identifierSet = Array.from(new Set([...deviceIds, ...deviceCodes, ...deviceUserNames]));

    const tokens = await ApiAccessToken.find({ owner: req.user._id }).select('_id');
    const tokenIds = tokens.map(t => t._id);

    const match = { verify: true };
    if (tokenIds.length) {
      match.apiAccessToken = { $in: tokenIds };
    } else if (identifierSet.length || deviceNames.length) {
      match.$or = [];
      if (identifierSet.length) match.$or.push({ deviceId: { $in: identifierSet } });
      if (deviceNames.length) match.$or.push({ deviceName: { $in: deviceNames } });
    } else {
      // No identifiers and no tokens → no data for this user
      return res.json({ success: true, data: [], page: Number(page), total: 0 });
    }

    if (provider) {
      match.$or = [
        { title: new RegExp(provider, 'i') },
        { fullMessage: new RegExp(provider, 'i') },
        { masking: new RegExp(provider, 'i') },
      ];
    }

    if (min != null || max != null) {
      match.amount = {};
      const minNum = Number(min);
      const maxNum = Number(max);
      if (Number.isFinite(minNum)) match.amount.$gte = minNum;
      if (Number.isFinite(maxNum)) match.amount.$lte = maxNum;
      if (!Object.keys(match.amount).length) delete match.amount;
    }

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

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));

    const [items, total] = await Promise.all([
      PaymentMessage.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .select('trxID amount title deviceName deviceId createdAt verify fullMessage')
        .lean(),
      PaymentMessage.countDocuments(match)
    ]);

    return res.json({ success: true, data: items, page: Number(page), total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});


// NEW: Get ALL Payment Messages (Raw History)
// GET /api/dashboard/payment-messages
router.get('/payment-messages', auth, async (req, res) => {
  try {
    const {
      provider,
      search,
      from,
      to,
      min,
      max,
      page = 1,
      limit = 20,
    } = req.query;

    // Filter by User's Devices Only
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceUserName deviceCode');
    const deviceIds = [];
    const deviceCodes = [];
    const deviceUserNames = [];
    const deviceNames = [];
    devices.forEach((d) => {
      deviceIds.push(String(d._id));
      if (d.deviceCode) deviceCodes.push(String(d.deviceCode));
      if (d.deviceUserName) deviceUserNames.push(String(d.deviceUserName));
      if (d.deviceName) deviceNames.push(String(d.deviceName));
    });
    const identifierSet = Array.from(new Set([...deviceIds, ...deviceCodes, ...deviceUserNames]));

    // Base MATCH: Filter by user's devices + Verified only
    const deviceConditions = [];
    if (identifierSet.length) deviceConditions.push({ deviceId: { $in: identifierSet } });
    if (deviceNames.length) deviceConditions.push({ deviceName: { $in: deviceNames } });

    if (!deviceConditions.length) {
       return res.json({ success: true, data: [], page: Number(page), total: 0 });
    }

    const andConditions = [];
    andConditions.push({ $or: deviceConditions });
    andConditions.push({ verify: true }); // Only show verified messages as per user request

    // 1. Provider Filter (Strict)
    if (provider && provider !== 'all') {
      andConditions.push({ title: new RegExp(provider, 'i') });
    }

    // 2. Search Filter (TrxID OR Message)
    if (search) {
      andConditions.push({
        $or: [
          { trxID: new RegExp(search, 'i') },
          { fullMessage: new RegExp(search, 'i') },
          { masking: new RegExp(search, 'i') },
          // { accountNumber: new RegExp(search, 'i') } // Optional if needed
        ]
      });
    }

    // 3. Amount Range
    if (min != null || max != null) {
      const amountMatch = {};
      const minNum = Number(min);
      const maxNum = Number(max);
      if (Number.isFinite(minNum)) amountMatch.$gte = minNum;
      if (Number.isFinite(maxNum)) amountMatch.$lte = maxNum;
      if (Object.keys(amountMatch).length) andConditions.push({ amount: amountMatch });
    }

    // 4. Date Range
    if (from || to) {
      const dateMatch = {};
      if (from) {
        const f = new Date(from);
        if (!isNaN(f)) dateMatch.$gte = f;
      }
      if (to) {
        const t = new Date(to);
        if (!isNaN(t)) dateMatch.$lte = t;
      }
      if (Object.keys(dateMatch).length) andConditions.push({ createdAt: dateMatch });
    }

    const finalMatch = andConditions.length ? { $and: andConditions } : {};

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));

    const [items, total] = await Promise.all([
      PaymentMessage.find(finalMatch)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('paymentSession', 'footprintUrlNonMask') // Populate session data
        .lean(),
      PaymentMessage.countDocuments(finalMatch)
    ]);

    return res.json({ success: true, data: items, page: Number(page), total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;
