const express = require('express');
const router = express.Router();
const FAQ = require('../models/FAQ');
const SiteSetting = require('../models/SiteSetting');
const auth = require('../middleware/auth');

// Admin Middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ message: 'Access denied' });
};

// --- PUBLIC ROUTES (For Client) ---

// Get all active FAQs (sorted by order)
router.get('/faqs', async (req, res) => {
  try {
    const faqs = await FAQ.find({ isActive: true }).sort('order');
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific setting by key
// Get all settings (Public)
router.get('/settings/all', async (req, res) => {
  try {
    const settings = await SiteSetting.find({});
    // Convert array to object { key: value }
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsMap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific setting by key
router.get('/settings/:key', async (req, res) => {
  try {
    const setting = await SiteSetting.findOne({ key: req.params.key });
    // Return default if not found, or null
    res.json(setting ? setting.value : null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk update settings (Admin)
router.post('/settings/bulk', auth, admin, async (req, res) => {
  try {
    const { settings } = req.body; // Expects array of { key, value, description }
    
    const operations = settings.map(setting => ({
      updateOne: {
        filter: { key: setting.key },
        update: { $set: { value: setting.value, description: setting.description } },
        upsert: true
      }
    }));

    await SiteSetting.bulkWrite(operations);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// --- ADMIN ROUTES ---

// 1. Manage FAQs
router.post('/faqs', auth, admin, async (req, res) => {
  try {
    const faq = new FAQ(req.body);
    const savedFaq = await faq.save();
    res.status(201).json(savedFaq);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/faqs/:id', auth, admin, async (req, res) => {
  try {
    const updatedFaq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedFaq);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/faqs/:id', auth, admin, async (req, res) => {
  try {
    await FAQ.findByIdAndDelete(req.params.id);
    res.json({ message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/admin/faqs', auth, admin, async (req, res) => {
  try {
    // Admin sees all, active or not
    const faqs = await FAQ.find().sort('order');
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// 2. Manage Settings (Video, etc)
router.post('/settings', auth, admin, async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    // Upsert (Update if exists, Insert if not)
    const setting = await SiteSetting.findOneAndUpdate(
      { key },
      { value, description },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    
    res.json(setting);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
