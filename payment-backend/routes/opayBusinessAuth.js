const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OpayBusiness = require('../models/OpayBusiness');

// POST /api/opay-business/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existing = await OpayBusiness.findOne({ email: email.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const apiToken = require('crypto').randomBytes(24).toString('hex');
    
    // Generate placeholder data
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const defaultName = `Merchant ${email.split('@')[0]}`;
    // Using a temp- domain to satisfy unique constraint without user input
    const defaultDomain = `temp-${timestamp}-${randomSuffix}.opay`;

    const business = await OpayBusiness.create({
      name: defaultName,
      domain: defaultDomain,
      email: email.trim(),
      passwordHash,
      apiToken,
      enabled: true
    });

    const token = jwt.sign(
      { id: business._id, role: 'opay_business' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: business._id,
        name: business.name,
        email: business.email,
        domain: business.domain,
        apiToken: business.apiToken,
        enabled: business.enabled,
        kycStatus: business.kycStatus
      },
      message: 'Registration successful'
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/opay-business/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const business = await OpayBusiness.findOne({ email: email.trim() });
    if (!business) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!business.enabled) {
        return res.status(403).json({ success: false, message: 'Account is disabled' });
    }

    const isMatch = await bcrypt.compare(password, business.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: business._id, role: 'opay_business' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: business._id,
        name: business.name,
        email: business.email,
        domain: business.domain,
        apiToken: business.apiToken,
        enabled: business.enabled,
        kycStatus: business.kycStatus
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/opay-business/auth/me
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if(!token) return res.status(401).json({success: false, message: 'No token'});

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const business = await OpayBusiness.findById(decoded.id).select('-passwordHash');

        if(!business) return res.status(404).json({success: false, message: 'User not found'});
        
        return res.json({
            success: true,
            user: {
                id: business._id,
                name: business.name,
                email: business.email,
                domain: business.domain,
                apiToken: business.apiToken,
                enabled: business.enabled,
                kycStatus: business.kycStatus
            }
        });

    } catch(err) {
        console.error('Me error:', err);
        return res.status(401).json({success: false, message: 'Invalid token'});
    }
});

module.exports = router;
