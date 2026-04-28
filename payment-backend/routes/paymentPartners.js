const express = require('express');
const router = express.Router();
const PaymentPartner = require('../models/PaymentPartner');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');


// Public: Get all active partners
router.get('/', async (req, res) => {
  try {
    const partners = await PaymentPartner.find({ isActive: true }).sort({ order: 1 });
    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all (including inactive)
router.get('/admin', protect, admin, async (req, res) => {
  try {
    const partners = await PaymentPartner.find({}).sort({ order: 1 });
    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Create
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, logoUrl, order } = req.body;
    const partner = await PaymentPartner.create({ name, logoUrl, order });
    res.status(201).json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Update
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const partner = await PaymentPartner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Delete
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await PaymentPartner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Partner removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
