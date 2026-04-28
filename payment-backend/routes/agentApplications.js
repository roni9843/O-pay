
const express = require('express');
const router = express.Router();
const AgentApplication = require('../models/AgentApplication');
const auth = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
};

// @route   POST /api/agent-applications
// @desc    Submit a new application (Public)
// @access  Public
const fs = require('fs').promises;
const path = require('path');

// Helper to save base64 image
const saveBase64Image = async (base64String, folder) => {
  if (!base64String || !base64String.startsWith('data:image')) return base64String;

  try {
    const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const ext = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filepath = path.join(__dirname, '..', 'uploads', folder, filename);

    await fs.writeFile(filepath, buffer);
    return `/uploads/${folder}/${filename}`;
  } catch (err) {
    console.error('Error saving base64 image:', err);
    return base64String; // Fallback to original string if save fails
  }
};

// @route   POST /api/agent-applications
// @desc    Submit a new application (Public)
// @access  Public
router.post('/', async (req, res) => {
  try {
    const appData = { ...req.body };

    // Save images to disk
    if (appData.nidFront) appData.nidFront = await saveBase64Image(appData.nidFront, 'agent-applications');
    if (appData.nidBack) appData.nidBack = await saveBase64Image(appData.nidBack, 'agent-applications');
    if (appData.photo) appData.photo = await saveBase64Image(appData.photo, 'agent-applications');

    const newApp = new AgentApplication(appData);
    await newApp.save();
    res.json({ success: true, message: 'Application submitted successfully!', data: newApp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   GET /api/agent-applications
// @desc    Get all applications
// @access  Admin
router.get('/', [auth, isAdmin], async (req, res) => {
  try {
    const apps = await AgentApplication.find().select('-nidFront -nidBack -photo').sort({ submittedAt: -1 });
    res.json({ success: true, data: apps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/agent-applications/:id
// @desc    Get single application
// @access  Admin
router.get('/:id', [auth, isAdmin], async (req, res) => {
  try {
    const app = await AgentApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PATCH /api/agent-applications/:id/status
// @desc    Update application status
// @access  Admin
router.patch('/:id/status', [auth, isAdmin], async (req, res) => {
  try {
    const { status } = req.body; // pending, approved, rejected
    const app = await AgentApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    app.status = status;
    await app.save();
    res.json({ success: true, data: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/agent-applications/:id
// @desc    Delete application
// @access  Admin
router.delete('/:id', [auth, isAdmin], async (req, res) => {
  try {
    const app = await AgentApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    await app.deleteOne();
    res.json({ success: true, message: 'Application deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
