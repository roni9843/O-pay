const express = require('express');
const router = express.Router();
const CreditPlan = require('../models/CreditPlan');
const auth = require('../middleware/auth');

// Middleware to check if user is admin (if not in adminAuth)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
};

// @route   GET /api/credit-plans
// @desc    Get all credit plans
// @access  Public (or Admin/User depending on need, let's keep it open for now or protected)
router.get('/', async (req, res) => {
  try {
    // If used by agents to buy, maybe filter by isActive: true
    // For admin, show all.
    // Let's support a query param ?active=true
    const query = {};
    if (req.query.active === 'true') {
      query.isActive = true;
    }
    const plans = await CreditPlan.find(query).sort({ creditAmount: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/credit-plans
// @desc    Create a new credit plan
// @access  Admin only
router.post('/', [auth, isAdmin], async (req, res) => {
  try {
    const { name, creditAmount, minimumCredit, commission, commissionType, autoWithdrawalCommission, description, details, isActive, isOneTime } = req.body;

    const newPlan = new CreditPlan({
      name,
      creditAmount,
      minimumCredit,
      commission,
      commissionType: commissionType || 'fixed',
      autoWithdrawalCommission: Number(autoWithdrawalCommission) || 0,
      description,
      details: details || [],
      isActive: isActive !== undefined ? isActive : true,
      isOneTime: Boolean(isOneTime)
    });

    const savedPlan = await newPlan.save();
    res.json({ success: true, data: savedPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   POST /api/credit-plans/assign-to-agent
// @desc    Admin directly assigns a Credit Plan to a Wallet Agent
// @access  Admin only
router.post('/assign-to-agent', [auth, isAdmin], async (req, res) => {
  try {
    const { userId, planId } = req.body;
    if (!userId || !planId) {
      return res.status(400).json({ success: false, message: 'userId and planId are required' });
    }

    const User = require('../models/User');
    const CreditTopupRequest = require('../models/CreditTopupRequest');

    const agent = await User.findById(userId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const plan = await CreditPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Credit plan not found' });
    }

    // Calculate commission
    let commissionAmount = 0;
    if (plan.commissionType === 'percentage') {
      commissionAmount = (plan.creditAmount * plan.commission) / 100;
    } else {
      commissionAmount = plan.commission || 0;
    }

    const totalCreditToAdd = plan.creditAmount + commissionAmount;
    agent.credit = (agent.credit || 0) + totalCreditToAdd;

    if (plan.minimumCredit) {
      agent.minimumCredit = (agent.minimumCredit || 0) + plan.minimumCredit;
    }

    if (plan.autoWithdrawalCommission !== undefined) {
      agent.autoWithdrawalCommissionRate = Number(plan.autoWithdrawalCommission) || 0;
    }

    await agent.save();

    // Create an approved topup request record for history tracking
    await CreditTopupRequest.create({
      userId: agent._id,
      planId: plan._id,
      methodName: 'Direct Admin Assignment',
      status: 'approved',
      submissionData: { note: `Assigned directly by Admin` }
    });

    return res.json({
      success: true,
      message: `Plan "${plan.name}" successfully assigned to agent ${agent.name || agent.email}!`,
      agent: {
        _id: agent._id,
        name: agent.name,
        credit: agent.credit,
        minimumCredit: agent.minimumCredit,
        autoWithdrawalCommissionRate: agent.autoWithdrawalCommissionRate
      }
    });
  } catch (err) {
    console.error('Assign credit plan error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   PUT /api/credit-plans/:id
// @desc    Update a credit plan
// @access  Admin only
router.put('/:id', [auth, isAdmin], async (req, res) => {
  try {
    const plan = await CreditPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      plan[key] = updates[key];
    });

    const updatedPlan = await plan.save();
    res.json({ success: true, data: updatedPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   DELETE /api/credit-plans/:id
// @desc    Delete a credit plan
// @access  Admin only
router.delete('/:id', [auth, isAdmin], async (req, res) => {
  try {
    const plan = await CreditPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    await plan.deleteOne();
    res.json({ success: true, message: 'Plan removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;
