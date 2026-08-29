const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const router = express.Router();

// Flexible auth middleware to allow both standard users (admin/wallet agents) and merchants (OpayBusiness)
const flexibleAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return res.status(401).json({ message: "Invalid token" });
  const token = parts[1];

  try {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Try User
    const User = require("../models/User");
    let user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
      return next();
    }

    // Try OpayBusiness
    const OpayBusiness = require("../models/OpayBusiness");
    let business = await OpayBusiness.findById(decoded.id).select("-passwordHash");
    if (business) {
      req.user = business;
      return next();
    }

    return res.status(401).json({ message: "User not found" });
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, base + '-' + unique + ext);
  }
});

// File filter (allow images only)
function fileFilter(req, file, cb) {
  const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Helper to construct full public URL with domain fallback
function getPublicUrl(req, filename) {
  const host = req.get('host') || 'localhost:5000';
  const protocol = req.protocol === 'https' ? 'https' : 'http';
  const baseUrl = (process.env.BACKEND_URL || `${protocol}://${host}`).replace(/\/+$/, '');
  return `${baseUrl}/uploads/${filename}`;
}

// POST /api/uploads/payment-page-image
// Upload a single image file; returns its public URL
router.post('/payment-page-image', flexibleAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Construct public URL
    const url = getPublicUrl(req, req.file.filename);
    return res.status(201).json({ success: true, url });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

// POST /api/uploads/bank-proof
// Public upload endpoint for customers submitting bank transfer proof images (single or multiple)
router.post('/bank-proof', upload.array('proofs', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No proof files uploaded' });
    }
    const urls = req.files.map(f => getPublicUrl(req, f.filename));
    return res.status(201).json({ success: true, urls, url: urls[0] });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Proof upload failed' });
  }
});

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, base + '-' + unique + ext);
  }
});

function videoFileFilter(req, file, cb) {
  const allowed = ['.mp4', '.webm', '.ogg', '.mov'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only video files are allowed'), false);
  }
  cb(null, true);
}

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// POST /api/uploads/landing-video
router.post('/landing-video', auth, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const url = getPublicUrl(req, req.file.filename);
    return res.status(201).json({ success: true, url });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Video upload failed' });
  }
});

// POST /api/uploads/withdrawal-proof
// Multiple images; Returns an array of URLs
router.post('/withdrawal-proof', auth, upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const urls = req.files.map(f => getPublicUrl(req, f.filename));
        return res.status(201).json({ success: true, urls });
    } catch (err) {
        return res.status(400).json({ error: err.message || 'Upload failed' });
    }
});

module.exports = router;
