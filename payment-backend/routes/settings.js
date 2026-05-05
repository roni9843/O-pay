const express = require('express');
const auth = require('../middleware/auth');
const Setting = require('../models/Setting');

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

module.exports = router;
