const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Device = require('../models/Device');

// Admin only check middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
};

// GET global status message
router.get('/global', auth, adminOnly, async (req, res) => {
  try {
    const s = await Setting.findOne({ key: 'global_status_message' });
    res.json({ success: true, data: s?.value || { title: '', subtitle: '', icon: '', active: false } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST global status message
router.post('/global', auth, adminOnly, async (req, res) => {
  try {
    const { title, subtitle, icon, active } = req.body;
    const s = await Setting.findOneAndUpdate(
      { key: 'global_status_message' },
      { $set: { value: { title, subtitle, icon, active: Boolean(active) } } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: s.value });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST user-specific status message
router.post('/user', auth, adminOnly, async (req, res) => {
  try {
    const { userId, phone, title, subtitle, icon, active } = req.body;
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (phone) {
      user = await User.findOne({ phone });
    }

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.statusTitle = title;
    user.statusSubtitle = subtitle;
    user.statusIcon = icon;
    user.showStatus = Boolean(active);
    await user.save();

    res.json({ success: true, message: 'User status updated', user: { _id: user._id, name: user.name, showStatus: user.showStatus } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all users with their status (for list/search)
router.get('/users-with-status', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('name phone role statusTitle statusSubtitle statusIcon showStatus')
      .lean();

    const onlineDevices = req.app.get('onlineDevices'); // Map of deviceId -> { active, ... }
    const deviceList = await Device.find({ owner: { $in: users.map(u => u._id) } }).select('owner deviceCode').lean();

    const usersWithOnlineStatus = users.map(user => {
      const userDevices = deviceList.filter(d => d.owner.toString() === user._id.toString());
      const devices = userDevices.map(d => {
        const presence = onlineDevices?.get(String(d.deviceCode));
        return {
          code: d.deviceCode,
          isOnline: !!(presence && presence.active)
        };
      });
      const isOnline = devices.some(d => d.isOnline);
      return { 
        ...user, 
        isOnline, 
        deviceCount: devices.length,
        devices 
      };
    });

    res.json({ success: true, users: usersWithOnlineStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST trigger emergency alarm on user devices
router.post('/alarm', auth, adminOnly, async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ success: false, message: 'Missing userId or message' });
    }

    const devices = await Device.find({ owner: userId }).select('deviceCode').lean();
    const onlineDevices = req.app.get('onlineDevices'); // Map of deviceCode -> { socketId, active, ... }
    const io = req.app.get('io');

    let triggeredCount = 0;
    devices.forEach(device => {
      const presence = onlineDevices?.get(String(device.deviceCode));
      console.log(`[Alarm] Device ${device.deviceCode}: active=${presence?.active}, socketId=${presence?.socketId}`);
      if (presence && presence.active && presence.socketId) {
        io.to(presence.socketId).emit('user:alarm', { message });
        triggeredCount++;
      }
    });

    console.log(`[Alarm] Total triggered: ${triggeredCount} for user ${userId}`);

    res.json({ 
      success: true, 
      message: `Alarm triggered on ${triggeredCount} active devices`,
      triggeredCount 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
