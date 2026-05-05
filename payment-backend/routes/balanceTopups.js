const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');
const BalanceTopUp = require('../models/BalanceTopUp');
const User = require('../models/User');
const Setting = require('../models/Setting');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'balance-topups');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `topup_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (allowed.includes(ext)) cb(null, true); else cb(new Error('Only image files are allowed'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Create a pending top-up (user)
router.post('/', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Screenshot required' });
    }
    const relPath = `/uploads/balance-topups/${req.file.filename}`;
    const doc = await BalanceTopUp.create({
      user: req.user._id,
      amount,
      screenshotUrl: relPath,
      status: 'pending'
    });

    // Send SMS Notification to Admins
    try {
      const setting = await Setting.findOne({ key: 'admin_notification_numbers' });
      let adminNumbers = [];
      if (setting && Array.isArray(setting.value)) adminNumbers = setting.value;
      else if (setting && typeof setting.value === 'string') adminNumbers = setting.value.split(',').map(n => n.trim()).filter(n => n);

      if (adminNumbers.length > 0) {
        const user = await User.findById(req.user._id);
        const userName = user ? user.name : 'A Merchant';

        const msgText = `New Balance Topup Request!\nMerchant: ${userName}\nAmount: ${amount} BDT\nPlease check Admin Panel.`;
        
        for (const num of adminNumbers) {
          const formattedPhone = num.startsWith("88") ? num : (num.startsWith("0") ? "88" + num : "880" + num);
          await fetch("https://api.o-sms.com/api/service/send-single", {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient: formattedPhone, message: msgText })
          }).catch(e => console.error("Failed to send admin notification:", e.message));
        }
      }
    } catch (notifyErr) {
      console.error("Notification Error:", notifyErr.message);
    }

    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List pending top-ups (admin only)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));
    const [items, total] = await Promise.all([
      BalanceTopUp.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('user', 'name email balance')
        .lean(),
      BalanceTopUp.countDocuments({ status: 'pending' })
    ]);
    return res.json({ success: true, data: items, total, page: Number(page) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// List current user's top-ups (pending or recent)
router.get('/mine', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const lim = Math.max(1, Math.min(100, Number(limit)));
    const match = { user: req.user._id };
    if (status) match.status = status;
    const [items, total] = await Promise.all([
      BalanceTopUp.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      BalanceTopUp.countDocuments(match)
    ]);
    return res.json({ success: true, data: items, total, page: Number(page) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Approve a top-up (admin)
router.post('/approve/:id', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const doc = await BalanceTopUp.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    if (doc.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });
    const user = await User.findById(doc.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.balance = Number(user.balance || 0) + Number(doc.amount || 0);
    await user.save();
    await user.save();
    doc.status = 'approved';
    await doc.save();

    // Send SMS to Merchant
    try {
      if (user && user.phone) {
        const msgText = `Congratulations ${user.name}!\nYour Balance Topup Request for ${doc.amount} BDT has been APPROVED.\nYour new balance is ${user.balance} BDT.\nThank you!`;
        const formattedPhone = user.phone.startsWith("88") ? user.phone : (user.phone.startsWith("0") ? "88" + user.phone : "880" + user.phone);
        await fetch("https://api.o-sms.com/api/service/send-single", {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient: formattedPhone, message: msgText })
        }).catch(e => console.error("Failed to send merchant notification:", e.message));
      }
    } catch (notifyErr) {
      console.error("Merchant SMS Error:", notifyErr.message);
    }

    return res.json({ success: true, message: 'Approved', user: { _id: user._id, balance: user.balance } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;
