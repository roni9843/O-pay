const express = require('express');
const router = express.Router();
const CreditTopupMethod = require('../models/CreditTopupMethod');
const auth = require('../middleware/auth');


// Middleware to check admin if not global
const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ success: false, message: 'Access denied' });
};

// @route   POST /api/credit-topup-methods
// @desc    Create a method
// @access  Admin
router.post('/', [auth, ensureAdmin], async (req, res) => {
  try {
    const method = new CreditTopupMethod(req.body);
    await method.save();
    res.json({ success: true, data: method });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/credit-topup-methods
// @desc    Get all methods
// @access  Public/Auth
router.get('/', async (req, res) => {
  try {
    const query = req.query.active === 'true' ? { isActive: true } : {};
    const methods = await CreditTopupMethod.find(query);
    res.json({ success: true, data: methods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/credit-topup-methods/:id
// @desc    Delete
// @access  Admin
router.delete('/:id', [auth, ensureAdmin], async (req, res) => {
  try {
    await CreditTopupMethod.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
