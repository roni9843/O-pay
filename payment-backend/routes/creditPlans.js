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
    const { name, creditAmount, minimumCredit, commission, commissionType, description } = req.body;

    const newPlan = new CreditPlan({
      name,
      creditAmount,
      minimumCredit,
      commission,
      commissionType: commissionType || 'fixed',
      description
    });

    const savedPlan = await newPlan.save();
    res.json({ success: true, data: savedPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
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
