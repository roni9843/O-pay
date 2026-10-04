const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET /api/notifications - Get all active notifications (Public or authenticated)
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin routes below (require admin authentication)
// Since other admin routes use simple auth and check role, we'll use auth middleware and role check

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Admin access required' });
  }
};

// GET /api/notifications/admin/all - Get all notifications (Admin)
router.get('/admin/all', auth, isAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications/admin - Create a notification
router.post('/admin', auth, isAdmin, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }
    const notification = await Notification.create({ title, message });
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/notifications/admin/:id/status - Toggle active status
router.put('/admin/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/notifications/admin/:id - Delete notification
router.delete('/admin/:id', auth, isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
