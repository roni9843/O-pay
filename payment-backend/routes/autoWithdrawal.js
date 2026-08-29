const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const AutoWithdrawalRequest = require('../models/AutoWithdrawalRequest');
const User = require('../models/User');
const OpayBusiness = require('../models/OpayBusiness');
const OpayBusinessPaymentSession = require('../models/OpayBusinessPaymentSession');
const MerchantWithdrawal = require('../models/MerchantWithdrawal');
const axios = require('axios');

// Get all pending and agent's active auto-withdrawals
router.get('/pending', auth, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const userId = req.user.id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    
    // Find requests that are pending
    const pendingRequests = await AutoWithdrawalRequest.find({
      status: 'pending'
    }).populate('merchant', 'name logo').lean();

    // Find request currently booked by this user (if any)
    const activeBooking = await AutoWithdrawalRequest.findOne({
      status: 'booked',
      bookedBy: userObjectId
    }).populate('merchant', 'name logo').lean();

    return res.json({
      success: true,
      pending: pendingRequests,
      active: activeBooking
    });
  } catch (err) {
    console.error('Error fetching pending auto withdrawals:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Book a withdrawal request
router.post('/:id/book', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if user already has an active booking
    const existingBooking = await AutoWithdrawalRequest.findOne({
      status: 'booked',
      bookedBy: userId
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, message: 'You already have an active booked request. Complete or reject it first.' });
    }

    const request = await AutoWithdrawalRequest.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { 
        $set: { 
          status: 'booked', 
          bookedBy: userId, 
          bookedAt: new Date() 
        } 
      },
      { new: true }
    );

    if (!request) {
      return res.status(400).json({ success: false, message: 'Request is no longer available.' });
    }

    // Broadcast to other agents to remove this from their pending list
    const io = req.app.get('socketio');
    if (io) {
      io.emit('auto_withdrawal_booked', { id: request._id, bookedBy: userId });
    }

    // Send Webhook to Merchant
    if (request.callbackUrl) {
      const axios = require('axios');
      axios.post(request.callbackUrl, {
        status: 'PROCESSING',
        withdrawal_id: request._id,
        amount: request.amount,
        payment_method: request.paymentMethod,
        user_identity_address: request.userIdentityAddress,
        account_number: request.accountNumber,
        checkout_items: request.checkoutItems
      }).catch(err => console.error('Book webhook failed:', err.message));
    }

    // Timer logic: Auto-reject after 10 minutes if still booked
    setTimeout(async () => {
      try {
        const checkRequest = await AutoWithdrawalRequest.findById(request._id);
        if (checkRequest && checkRequest.status === 'booked' && checkRequest.bookedBy.toString() === userId) {
          // Auto reject
          checkRequest.status = 'pending';
          checkRequest.bookedBy = null;
          checkRequest.bookedAt = null;
          checkRequest.rejectedBy.push(userId); // Prevent this user from booking it again
          if (!checkRequest.agentRejections) checkRequest.agentRejections = [];
          checkRequest.agentRejections.push({
            agent: userId,
            reason: 'Auto-rejected due to 10-minute timeout',
            rejectedAt: new Date()
          });
          await checkRequest.save();

          if (io) {
            // Tell this user it was auto-rejected
            io.to(`user_${userId}`).emit('auto_withdrawal_timeout', { id: checkRequest._id });
            // Re-broadcast to others
            io.emit('new_auto_withdrawal', checkRequest);
          }
          console.log(`AutoWithdrawal ${checkRequest._id} auto-rejected due to timeout`);
        }
      } catch (e) {
        console.error('Timeout reject error:', e);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return res.json({ success: true, data: request });
  } catch (err) {
    console.error('Error booking auto withdrawal:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reject a booked request
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const request = await AutoWithdrawalRequest.findOne({ _id: id });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (request.status === 'pending') {
      // User just clicked 'Hide' from the dashboard queue
      // Since the new requirement is to NOT hide it and keep it pending for everyone (including this user),
      // we don't actually need to do anything to the database here.
      // But we can still record that they 'ignored' it if needed. For now, just do nothing so it stays pending.
    } else if (request.status === 'booked' && request.bookedBy.toString() === userId) {
      // Unbook and release it back to the global queue
      request.status = 'pending';
      request.bookedBy = null;
      request.bookedAt = null;
      
      const { reason } = req.body;
      if (reason) {
        request.rejectReason = reason;
      }

      if (!request.agentRejections) request.agentRejections = [];
      request.agentRejections.push({
        agent: userId,
        reason: reason || 'Cancelled/Released by agent',
        rejectedAt: new Date()
      });

      if (!request.rejectedBy) request.rejectedBy = [];
      if (!request.rejectedBy.includes(userId)) {
        request.rejectedBy.push(userId);
      }
      
      await request.save();
      
      const io = req.app.get('socketio');
      if (io) {
        io.emit('new_auto_withdrawal', request);
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid state or not authorized' });
    }

    return res.json({ success: true, message: 'Request rejected successfully' });
  } catch (err) {
    console.error('Error rejecting auto withdrawal:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Complete a request with proofs
router.post('/:id/complete', auth, upload.array('proofs', 5), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const request = await AutoWithdrawalRequest.findOne({ _id: id, status: 'booked', bookedBy: userId });
    
    if (!request) {
      return res.status(400).json({ success: false, message: 'Request is not currently booked by you or already completed.' });
    }

    const proofImages = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    
    if (proofImages.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one proof screenshot is required' });
    }

    // Calculate Agent Auto Withdrawal Commission (agent.credit does NOT increase)
    const agent = await User.findById(userId);
    const agentCreditBefore = agent.credit || 0;
    const agentCreditAfter = agentCreditBefore; // Credit remains unaffected
    const agentCommissionRate = agent.autoWithdrawalCommissionRate || 0;
    const agentCommissionAmount = (request.amount * agentCommissionRate) / 100;
    
    // Add Commission + Bonus to agent's autoWithdrawalCommission card balance
    agent.autoWithdrawalCommission = (agent.autoWithdrawalCommission || 0) + agentCommissionAmount;
    agent.autoWithdrawalVolume = (agent.autoWithdrawalVolume || 0) + (request.amount || 0);
    agent.autoWithdrawalCompletedCount = (agent.autoWithdrawalCompletedCount || 0) + 1;
    await agent.save();

    // The merchant balance doesn't actually get deducted from an explicit 'balance' field in OpayBusiness
    // It's calculated dynamically. However, since we track `balanceAdjustment`, we can record the snapshot 
    // to match how regular withdrawals work, OR simply since it's an auto-withdrawal, it will naturally decrease 
    // the available balance if we consider AutoWithdrawalRequest in the sum (which we did in opayBusinessExternal API).
    // Let's record the snapshot.
    
    // We already added AutoWithdrawalRequests to the availableBalance calculation globally.
    // So by completing this, the merchant's available balance is permanently reduced.
    const merchant = await OpayBusiness.findById(request.merchant);
    
    // Calculate precise snapshot
    const sessions = await OpayBusinessPaymentSession.find({ business: merchant._id, status: 'paid' }).select('amount').lean();
    const totalSuccessAmount = sessions.reduce((sum, s) => sum + (s.amount || 0), 0);
    
    const withdrawals = await MerchantWithdrawal.find({ merchantId: merchant._id, status: { $in: ['approved', 'pending'] } }).select('amount').lean();
    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    
    const autoWithdrawals = await AutoWithdrawalRequest.find({ merchant: merchant._id, status: { $in: ['pending', 'booked', 'completed'] } }).select('amount deductedAmount').lean();
    const totalAutoWithdrawalAmount = autoWithdrawals.reduce((sum, w) => sum + (w.deductedAmount ?? w.amount ?? 0), 0);
    
    const availableBalance = totalSuccessAmount - totalWithdrawalAmount - totalAutoWithdrawalAmount + (merchant.balanceAdjustment || 0);
    
    request.status = 'completed';
    request.proofImages = proofImages;
    request.agentCreditBefore = agentCreditBefore;
    request.agentCreditAfter = agentCreditAfter;
    request.agentCommissionRate = agentCommissionRate;
    request.agentCommissionAmount = agentCommissionAmount;
    // Since availableBalance already subtracted this request's amount (because it was booked), we add it back for 'Before'
    request.merchantBalanceBefore = availableBalance + (request.deductedAmount ?? request.amount); 
    request.merchantBalanceAfter = availableBalance;
    
    // Send Callback
    try {
      const baseUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      const fullProofImages = proofImages.map(img => {
        if (/^https?:\/\//i.test(img)) return img;
        const cleanPath = img.startsWith('/') ? img : `/${img}`;
        return `${baseUrl}${cleanPath}`;
      });

      const payload = {
        status: 'COMPLETED',
        withdrawal_id: request._id,
        date_and_time: new Date().toISOString(),
        amount: request.amount,
        payment_method: request.paymentMethod,
        user_identity_address: request.userIdentityAddress,
        account_number: request.accountNumber,
        checkout_items: request.checkoutItems,
        proof_images: fullProofImages
      };
      
      const cbRes = await axios.post(request.callbackUrl, payload, { timeout: 10000 });
      request.callbackResult = {
        success: true,
        statusCode: cbRes.status,
        data: cbRes.data
      };
    } catch (cbErr) {
      request.callbackResult = {
        success: false,
        error: cbErr.message
      };
    }

    await request.save();

    // Broadcast completion to admin if needed
    const io = req.app.get('socketio');
    if (io) {
      io.emit('auto_withdrawal_completed', { id: request._id, merchant: request.merchant });
    }

    return res.json({ success: true, message: 'Withdrawal completed successfully', data: request });
  } catch (err) {
    console.error('Error completing auto withdrawal:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Dedicated Agent Stats Endpoint
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const completedRequests = await AutoWithdrawalRequest.find({ 
      bookedBy: { $in: [userId, userObjectId] }, 
      status: 'completed'
    }).select('amount agentCommissionAmount').lean();

    const user = await User.findById(userId).select('autoWithdrawalCommission autoWithdrawalBonus autoWithdrawalCommissionRate autoWithdrawalVolume autoWithdrawalCompletedCount').lean();
    const commRate = user?.autoWithdrawalCommissionRate || 3;

    const calculatedVolume = completedRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const completedCount = completedRequests.length > 0 ? completedRequests.length : (user?.autoWithdrawalCompletedCount || 0);
    
    const calculatedCommission = completedRequests.reduce((sum, r) => {
      const comm = r.agentCommissionAmount !== undefined && r.agentCommissionAmount > 0 
        ? r.agentCommissionAmount 
        : (Number(r.amount || 0) * commRate) / 100;
      return sum + comm;
    }, 0);

    const userCommission = (user?.autoWithdrawalCommission || 0) + (user?.autoWithdrawalBonus || 0);
    const totalVolume = calculatedVolume + (user?.autoWithdrawalVolume || 0);
    const totalCommission = userCommission > 0 ? userCommission : calculatedCommission;

    return res.json({
      success: true,
      data: {
        totalVolume,
        completedCount,
        totalCommission,
        commissionRate: commRate
      }
    });
  } catch (err) {
    console.error('Error fetching agent stats:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Agent History
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const history = await AutoWithdrawalRequest.find({ 
      bookedBy: { $in: [userId, userObjectId] }, 
      status: { $in: ['completed', 'failed'] } 
    })
    .sort({ createdAt: -1 })
    .populate('merchant', 'name logo')
    .lean();

    const completed = history.filter(h => h.status === 'completed');
    const totalCompletedVolume = completed.reduce((sum, h) => sum + (h.amount || 0), 0);
    const totalCompletedCount = completed.length;

    return res.json({ 
      success: true, 
      data: history,
      totalCompletedVolume,
      totalCompletedCount
    });
  } catch (err) {
    console.error('Error fetching history:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router;
