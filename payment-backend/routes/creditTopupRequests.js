const express = require('express');
const router = express.Router();
const CreditTopupRequest = require('../models/CreditTopupRequest');
const CreditPlan = require('../models/CreditPlan');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Middleware
const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ success: false, message: 'Access denied' });
};

// @route   POST /api/credit-topup-requests
// @desc    Submit a request
// @access  Private (Wallet Agent)
router.post('/', auth, async (req, res) => {
  try {
    const { planId, methodId, methodName, submissionData } = req.body;
    
    const request = new CreditTopupRequest({
      userId: req.user.id,
      planId,
      methodId,
      methodName,
      submissionData
    });
    
    await request.save();
    res.json({ success: true, message: 'Request submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/credit-topup-requests/my
// @desc    List my requests
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    const requests = await CreditTopupRequest.find({ userId: req.user.id })
      .populate('planId', 'name creditAmount')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/credit-topup-requests
// @desc    List all requests
// @access  Admin
router.get('/', [auth, ensureAdmin], async (req, res) => {
  try {
    const requests = await CreditTopupRequest.find()
      .populate('userId', 'name mobile email credit minimumCredit')
      .populate('planId', 'name creditAmount minimumCredit commission commissionType')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PATCH /api/credit-topup-requests/:id/status
// @desc    Approve/Reject
// @access  Admin
router.patch('/:id/status', [auth, ensureAdmin], async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const request = await CreditTopupRequest.findById(req.params.id)
       .populate('planId')
       .populate('userId'); // Need user to update credit

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });

    request.status = status;
    if (status === 'rejected') {
      request.rejectionReason = rejectionReason;
    } else if (status === 'approved') {
      const plan = request.planId;
      const user = request.userId;
      
      if (!plan || !user) return res.status(400).json({ success: false, message: 'Invalid Plan or User data' });

      // 1. Update User Credit
      // Credit to add = Plan Credit Amount + Commission (if applicable? User said commission auto add)
      // Usually commission is deducted or added. If user said "credit er sathe fix or percentage commition auto add hoye jabe"
      // it means they get the Bonus credit? Or is it a cost?
      // Assuming "Commission" on a Topup Plan is a BONUS given to the agent.
      // If Plan says "Credit: 10000, Commission: 2%", then Agent gets 10000 + 200 = 10200?
      // Or they Pay less? "Credit Topup" implies buying credit.
      // Let's assume Commission is EXTRA credit added to balance.
      
      let commissionAmount = 0;
      if (plan.commissionType === 'percentage') {
        commissionAmount = (plan.creditAmount * plan.commission) / 100;
      } else {
        commissionAmount = plan.commission || 0;
      }
      
      const totalCreditToAdd = plan.creditAmount + commissionAmount;
      
      user.credit = (user.credit || 0) + totalCreditToAdd;
      
      // 2. Update Minimum Credit (Additive)
      if (plan.minimumCredit) {
         user.minimumCredit = (user.minimumCredit || 0) + plan.minimumCredit;
      }

      await user.save();
    }

    await request.save();
    res.json({ success: true, message: `Request ${status}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
