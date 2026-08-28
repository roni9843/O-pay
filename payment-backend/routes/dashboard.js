const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Device = require('../models/Device');
const PaymentMessage = require('../models/PaymentMessage');
const ApiAccessToken = require('../models/ApiAccessToken');

router.get('/overview', auth, async (req, res) => {
  try {
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceUserName deviceCode online lastSeen subscriptionEndDate');

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
        online: Boolean(device.online),
        lastSeen: device.lastSeen || null,
        subscriptionEndDate: device.subscriptionEndDate || null
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

    const startOfToday = require('moment-timezone')().tz('Asia/Dhaka').startOf('day').toDate();

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

    const processedDeviceIds = new Set();
    const devicesBreakdown = (agg?.byDevice || []).map((item) => {
      const info = deviceMap.get(String(item._id)) || deviceMap.get(String(item.fallbackName)) || {
        deviceId: String(item._id),
        deviceName: item.fallbackName || 'Unknown device',
        deviceUserName: null,
        deviceCode: null,
        online: false
      };
      if (info.deviceId) processedDeviceIds.add(info.deviceId);
      return {
        ...info,
        totalTransactions: item.totalTransactions,
        totalAmount: item.totalAmount,
        lastMessageAt: item.lastMessageAt,
        lastTrxID: item.lastTrxID,
        provider: item.provider || null,
      };
    });

    devices.forEach(d => {
      const dId = String(d._id);
      if (!processedDeviceIds.has(dId)) {
        devicesBreakdown.push({
          deviceId: dId,
          deviceName: d.deviceName || d.deviceUserName || 'Unnamed Device',
          deviceUserName: d.deviceUserName || null,
          deviceCode: d.deviceCode || null,
          online: Boolean(d.online),
          lastSeen: d.lastSeen || null,
          totalTransactions: 0,
          totalAmount: 0
        });
      }
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

// GET /api/dashboard/pending-nagad
// Returns pending Nagad sessions matching this agent's accounts or devices
router.get('/pending-nagad', auth, async (req, res) => {
  try {
    const PaymentMethod = require('../models/PaymentMethod');
    const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
    const Device = require('../models/Device');

    // 1. Get active Nagad payment methods of this agent
    const methods = await PaymentMethod.find({ owner: req.user._id, provider: 'nagad' }).select('accountNumber').lean();
    const accountNumbers = methods.map(m => m.accountNumber).filter(Boolean);

    // 2. Get devices owned by this agent
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceCode deviceUserName').lean();
    const deviceIdentifiers = [];
    devices.forEach(d => {
      deviceIdentifiers.push(String(d._id));
      if (d.deviceName) deviceIdentifiers.push(d.deviceName);
      if (d.deviceCode) deviceIdentifiers.push(d.deviceCode);
      if (d.deviceUserName) deviceIdentifiers.push(d.deviceUserName);
    });

    // 3. Find OpayBusinessPaymentSession where status is 'pending_nagad'
    const sessions = await OpayBusinessPaymentSession.find({ status: 'pending_nagad' })
      .populate('paymentMessage')
      .sort({ updatedAt: -1 })
      .lean();

    const filtered = sessions.filter(session => {
      // Check verification attempts
      const attempts = Array.isArray(session.verificationAttempts) ? session.verificationAttempts : [];
      const hasMatchingAttempt = attempts.some(att => accountNumbers.includes(att.agentAccountNumber));
      if (hasMatchingAttempt) return true;

      // Check paymentMessage device
      if (session.paymentMessage) {
        const msgDevice = session.paymentMessage.deviceId || session.paymentMessage.deviceName;
        if (msgDevice && deviceIdentifiers.includes(String(msgDevice))) {
          return true;
        }
      }
      return false;
    });

    return res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('Agent pending Nagad fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve a pending Nagad session by Wallet Agent
router.post('/pending-nagad/accept', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
    const PaymentMessage = require('../models/PaymentMessage');
    const PaymentMethod = require('../models/PaymentMethod');
    const User = require('../models/User');
    const OpayBusiness = require('../models/OpayBusiness');
    const Device = require('../models/Device');

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_nagad' }).populate('business');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending session not found' });
    }

    // Verify ownership
    const methods = await PaymentMethod.find({ owner: req.user._id, provider: 'nagad' }).select('accountNumber').lean();
    const accountNumbers = methods.map(m => m.accountNumber).filter(Boolean);
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceCode deviceUserName').lean();
    const deviceIdentifiers = [];
    devices.forEach(d => {
      deviceIdentifiers.push(String(d._id));
      if (d.deviceName) deviceIdentifiers.push(d.deviceName);
      if (d.deviceCode) deviceIdentifiers.push(d.deviceCode);
      if (d.deviceUserName) deviceIdentifiers.push(d.deviceUserName);
    });

    let isOwner = false;
    const attempts = Array.isArray(session.verificationAttempts) ? session.verificationAttempts : [];
    if (attempts.some(att => accountNumbers.includes(att.agentAccountNumber))) {
      isOwner = true;
    }

    let matchedMessage = null;
    if (session.paymentMessage) {
      matchedMessage = await PaymentMessage.findById(session.paymentMessage);
      if (matchedMessage) {
        const msgDevice = matchedMessage.deviceId || matchedMessage.deviceName;
        if (msgDevice && deviceIdentifiers.includes(String(msgDevice))) {
          isOwner = true;
        }
      }
    }

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You are not authorized to approve this session' });
    }
    
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

    // Agent is the current user
    const agentUser = await User.findById(req.user._id).select('name credit minimumCredit');
    const paymentAmount = Number(session.amount) || 0;
    
    if (agentUser) {
      const creditBefore = agentUser.credit || 0;
      const creditAfter = Math.max(0, creditBefore - paymentAmount);
      agentUser.credit = creditAfter;
      await agentUser.save();

      session.walletAgentSnapshot = {
        agentId: agentUser._id,
        agentName: agentUser.name || 'Unknown Agent',
        creditBefore,
        creditAfter,
        creditDeducted: paymentAmount,
      };
      
      const { updateAgentMethodsStatus } = require('./admin'); // Or move to a shared utility
      try {
        if (typeof updateAgentMethodsStatus === 'function') {
           await updateAgentMethodsStatus(agentUser._id);
        }
      } catch (e) {}
    }

    // Merchant Balance Snapshot
    try {
      const business = await OpayBusiness.findById(session.business._id || session.business).select('name balanceAdjustment');
      if (business) {
        const previousPaidTotal = await OpayBusinessPaymentSession.aggregate([
          { $match: { business: business._id, status: 'paid', _id: { $ne: session._id } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const balanceBefore = (previousPaidTotal[0]?.total || 0) + (business.balanceAdjustment || 0);
        const balanceAfter = balanceBefore + paymentAmount;

        session.merchantSnapshot = {
          businessId: business._id,
          businessName: business.name || 'Unknown Merchant',
          balanceBefore,
          balanceAfter,
          balanceAdded: paymentAmount,
        };
      }
    } catch (balErr) {}

    await session.save();

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
        }
      } catch (activationErr) {}
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
        axios.post(callbackUrl, payload, { timeout: 5000 }).then(async (res) => {
          session.callbackResult = { success: true, statusCode: res.status, payloadSent: payload, responseReceived: res.data };
          await session.save();
        }).catch(async (err) => {
          session.callbackResult = { success: false, error: err?.message || 'Unknown error', payloadSent: payload, responseReceived: err?.response?.data || null };
          await session.save();
        });
      }
    } catch (cbErr) {}

    return res.json({ success: true, message: 'Payment approved successfully' });
  } catch (err) {
    console.error('Error approving pending Nagad session (Agent):', err);
    return res.status(500).json({ success: false, message: 'Server error during approval' });
  }
});

// Reject a pending Nagad session by Wallet Agent
router.post('/pending-nagad/reject', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
    const PaymentMethod = require('../models/PaymentMethod');
    const Device = require('../models/Device');

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_nagad' });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending session not found' });
    }

    // Verify ownership
    const methods = await PaymentMethod.find({ owner: req.user._id, provider: 'nagad' }).select('accountNumber').lean();
    const accountNumbers = methods.map(m => m.accountNumber).filter(Boolean);
    const devices = await Device.find({ owner: req.user._id }).select('_id deviceName deviceCode deviceUserName').lean();
    const deviceIdentifiers = [];
    devices.forEach(d => {
      deviceIdentifiers.push(String(d._id));
      if (d.deviceName) deviceIdentifiers.push(d.deviceName);
      if (d.deviceCode) deviceIdentifiers.push(d.deviceCode);
      if (d.deviceUserName) deviceIdentifiers.push(d.deviceUserName);
    });

    let isOwner = false;
    const attempts = Array.isArray(session.verificationAttempts) ? session.verificationAttempts : [];
    if (attempts.some(att => accountNumbers.includes(att.agentAccountNumber))) {
      isOwner = true;
    }

    if (session.paymentMessage) {
      const PaymentMessage = require('../models/PaymentMessage');
      const matchedMessage = await PaymentMessage.findById(session.paymentMessage);
      if (matchedMessage) {
        const msgDevice = matchedMessage.deviceId || matchedMessage.deviceName;
        if (msgDevice && deviceIdentifiers.includes(String(msgDevice))) {
          isOwner = true;
        }
      }
    }

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You are not authorized to reject this session' });
    }

    session.status = 'cancelled';
    await session.save();

    return res.json({ success: true, message: 'Payment session cancelled successfully' });
  } catch (err) {
    console.error('Error rejecting pending Nagad session (Agent):', err);
    return res.status(500).json({ success: false, message: 'Server error during rejection' });
  }
});

// --- WALLET AGENT BANK ACCOUNTS MANAGEMENT ---
router.get('/bank-accounts', auth, async (req, res) => {
  try {
    const AgentBankAccount = require('../models/AgentBankAccount');
    const accounts = await AgentBankAccount.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: accounts });
  } catch (err) {
    console.error('Error fetching agent bank accounts:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/bank-accounts', auth, async (req, res) => {
  try {
    const AgentBankAccount = require('../models/AgentBankAccount');
    const {
      bankName,
      accountHolderName,
      accountNumber,
      branchName,
      division,
      district,
      upazilaThana,
      routingNumber,
      status,
    } = req.body;

    if (!bankName || !accountHolderName || !accountNumber || !branchName || !division || !district || !upazilaThana || !routingNumber) {
      return res.status(400).json({ success: false, message: 'All bank details fields are required' });
    }

    const newAcc = await AgentBankAccount.create({
      owner: req.user._id,
      bankName: bankName.trim(),
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      branchName: branchName.trim(),
      division: division.trim(),
      district: district.trim(),
      upazilaThana: upazilaThana.trim(),
      routingNumber: routingNumber.trim(),
      status: status === 'inactive' ? 'inactive' : 'active',
    });

    return res.json({ success: true, data: newAcc });
  } catch (err) {
    console.error('Error adding agent bank account:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/bank-accounts/:id', auth, async (req, res) => {
  try {
    const AgentBankAccount = require('../models/AgentBankAccount');
    await AgentBankAccount.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    return res.json({ success: true, message: 'Bank account deleted' });
  } catch (err) {
    console.error('Error deleting agent bank account:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- WALLET AGENT PENDING BANK PAYMENTS ---
router.get('/pending-bank-payments', auth, async (req, res) => {
  try {
    const AgentBankAccount = require('../models/AgentBankAccount');
    const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');

    // 1. Get bank account IDs / numbers of this agent
    const bankAccounts = await AgentBankAccount.find({ owner: req.user._id }).select('_id accountNumber').lean();
    const bankAccIds = bankAccounts.map(b => String(b._id));

    // 2. Fetch all sessions with status 'pending_bank'
    const sessions = await OpayBusinessPaymentSession.find({ status: 'pending_bank' })
      .populate('business')
      .sort({ updatedAt: -1 })
      .lean();

    // 3. Filter sessions matching this agent's bank accounts
    const filtered = sessions.filter(session => {
      const targetAgentId = session.bankDetails?.agentId || session.bankDetails?.bankAccountId;
      return targetAgentId && (String(targetAgentId) === String(req.user._id) || bankAccIds.includes(String(targetAgentId)));
    });

    return res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('Error fetching agent pending bank payments:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/pending-bank-payments/accept', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
    const User = require('../models/User');
    const OpayBusiness = require('../models/OpayBusiness');

    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_bank' }).populate('business');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending bank session not found' });
    }

    session.status = 'paid';
    session.lastVerificationSuccessAt = new Date();

    // Deduct Agent Credit
    const agentUser = await User.findById(req.user._id).select('name credit minimumCredit');
    const paymentAmount = Number(session.amount) || 0;

    if (agentUser) {
      const creditBefore = agentUser.credit || 0;
      const creditAfter = Math.max(0, creditBefore - paymentAmount);
      agentUser.credit = creditAfter;
      await agentUser.save();

      session.walletAgentSnapshot = {
        agentId: agentUser._id,
        agentName: agentUser.name || 'Unknown Agent',
        creditBefore,
        creditAfter,
        creditDeducted: paymentAmount,
      };
    }

    // Merchant Balance Snapshot
    try {
      const business = await OpayBusiness.findById(session.business._id || session.business).select('name balanceAdjustment');
      if (business) {
        const previousPaidTotal = await OpayBusinessPaymentSession.aggregate([
          { $match: { business: business._id, status: 'paid', _id: { $ne: session._id } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const balanceBefore = (previousPaidTotal[0]?.total || 0) + (business.balanceAdjustment || 0);
        const balanceAfter = balanceBefore + paymentAmount;

        session.merchantSnapshot = {
          businessId: business._id,
          businessName: business.name || 'Unknown Merchant',
          balanceBefore,
          balanceAfter,
          balanceAdded: paymentAmount,
        };
      }
    } catch (balErr) {}

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

    return res.json({ success: true, message: 'Bank payment approved successfully' });
  } catch (err) {
    console.error('Error approving bank payment (Agent):', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/pending-bank-payments/reject', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
    const session = await OpayBusinessPaymentSession.findOne({ code, status: 'pending_bank' });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Pending bank session not found' });
    }

    session.status = 'cancelled';
    await session.save();

    return res.json({ success: true, message: 'Bank payment rejected' });
  } catch (err) {
    console.error('Error rejecting bank payment (Agent):', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
