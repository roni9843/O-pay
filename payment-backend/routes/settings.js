const express = require('express');
const auth = require('../middleware/auth');
const Setting = require('../models/Setting');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Public: get Binance address
router.get('/binance-address', async (req, res) => {
  try {
    const s = await Setting.findOne({ key: 'binance_address' });
    return res.json({ success: true, address: s?.value || '' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: set Binance address
router.post('/binance-address', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { address } = req.body || {};
    if (!address || typeof address !== 'string' || address.length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid address' });
    }
    const s = await Setting.findOneAndUpdate(
      { key: 'binance_address' },
      { $set: { value: address } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, address: s.value });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: get notification numbers
router.get('/notification-numbers', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const s = await Setting.findOne({ key: 'admin_notification_numbers' });
    let numbers = [];
    if (s && Array.isArray(s.value)) numbers = s.value;
    else if (s && typeof s.value === 'string') numbers = s.value.split(',').map(n => n.trim()).filter(n => n);
    return res.json({ success: true, numbers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: set notification numbers
router.post('/notification-numbers', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { numbers } = req.body || {};
    if (!Array.isArray(numbers)) {
      return res.status(400).json({ success: false, message: 'Invalid numbers format (must be array)' });
    }
    const s = await Setting.findOneAndUpdate(
      { key: 'admin_notification_numbers' },
      { $set: { value: numbers } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, numbers: s.value });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: get auto withdrawal min balance
router.get('/auto-withdrawal-min-balance', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const s = await Setting.findOne({ key: 'merchant_auto_withdraw_min_balance' });
    return res.json({ success: true, balance: Number(s?.value || 0) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: set auto withdrawal min balance
router.post('/auto-withdrawal-min-balance', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { balance } = req.body || {};
    if (balance === undefined || isNaN(balance)) {
      return res.status(400).json({ success: false, message: 'Invalid balance amount' });
    }
    const s = await Setting.findOneAndUpdate(
      { key: 'merchant_auto_withdraw_min_balance' },
      { $set: { value: Number(balance) } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, balance: Number(s.value) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: get auto withdrawal fee
router.get('/auto-withdrawal-fee', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const s = await Setting.findOne({ key: 'merchant_auto_withdraw_fee_percentage' });
    return res.json({ success: true, percentage: Number(s?.value || 0) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: set auto withdrawal fee
router.post('/auto-withdrawal-fee', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { percentage } = req.body || {};
    if (percentage === undefined || isNaN(percentage) || Number(percentage) < 0 || Number(percentage) > 100) {
      return res.status(400).json({ success: false, message: 'Invalid percentage' });
    }
    const s = await Setting.findOneAndUpdate(
      { key: 'merchant_auto_withdraw_fee_percentage' },
      { $set: { value: Number(percentage) } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, percentage: Number(s.value) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});


// Admin: get merchant topup fee
router.get('/merchant-topup-fee', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const sType = await Setting.findOne({ key: 'merchant_topup_fee_type' });
    const sValue = await Setting.findOne({ key: 'merchant_topup_fee_value' });
    return res.json({ 
      success: true, 
      type: sType?.value || 'percentage',
      value: Number(sValue?.value || 0)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: set merchant topup fee
router.post('/merchant-topup-fee', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { type, value } = req.body || {};
    if (type !== 'percentage' && type !== 'fixed') {
      return res.status(400).json({ success: false, message: 'Invalid fee type' });
    }
    if (value === undefined || isNaN(value) || Number(value) < 0) {
      return res.status(400).json({ success: false, message: 'Invalid fee value' });
    }
    
    await Setting.findOneAndUpdate(
      { key: 'merchant_topup_fee_type' },
      { $set: { value: type } },
      { upsert: true }
    );
    await Setting.findOneAndUpdate(
      { key: 'merchant_topup_fee_value' },
      { $set: { value: Number(value) } },
      { upsert: true }
    );

    return res.json({ success: true, type, value: Number(value) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Admin: update admin credentials (email, name, password)
router.post('/admin-profile', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const { email, password, name } = req.body || {};
    const admin = await User.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    if (email && email.trim() !== admin.email) {
      const emailExists = await User.findOne({ email: email.trim() });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
      admin.email = email.trim();
    }

    if (name && name.trim()) {
      admin.name = name.trim();
    }

    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password.trim(), salt);
    }

    await admin.save();
    return res.json({
      success: true,
      message: 'Admin profile updated successfully',
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;
