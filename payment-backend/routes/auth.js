const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const UserSubscription = require("../models/UserSubscription");
const Otp = require("../models/Otp");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Missing fields" });
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already in use" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    // Check for subscription (unlikely for new user but good practice)
    const sub = await UserSubscription.findOne({ user: user._id, active: true, endDate: { $gt: new Date() } }).sort({ endDate: -1 });
    const userObj = user.toObject();
    if (sub) {
      userObj.subscription = {
        planId: sub.plan,
        expiryDate: sub.endDate,
      };
    }

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, ...userObj },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Send OTP
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone number required" });
  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) return res.status(400).json({ message: "Phone number already in use" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await Otp.deleteMany({ phone });
    await Otp.create({ phone, otp });

    const formattedPhone = phone.startsWith("88") ? phone : (phone.startsWith("0") ? "88" + phone : "880" + phone);

    const response = await fetch("https://api.o-sms.com/api/service/send-single", {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 4cd4c55e26d7571c49f553efba7890db14dadbd3b260a6d39a75ea1373f0b316',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: formattedPhone,
        message: `Your Wallet Agent Registration OTP is: ${otp}`
      })
    });

    const data = await response.json();
    if (!data.success) {
      console.error("SMS sending failed:", data);
      return res.status(500).json({ message: "Failed to send OTP SMS" });
    }

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while sending OTP" });
  }
});

// Verify OTP and Register
router.post("/verify-otp-and-register", async (req, res) => {
  const { name, email, phone, password, otp } = req.body;
  if (!name || !email || !phone || !password || !otp) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const validOtp = await Otp.findOne({ phone, otp });
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Email already in use" });

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) return res.status(400).json({ message: "Phone already in use" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({ 
      name, 
      email, 
      phone, 
      password: hashed,
      role: "wallet_agent" 
    });

    await Otp.deleteMany({ phone });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    const userObj = user.toObject();
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, ...userObj },
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during registration" });
  }
});

// login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Missing fields" });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    // Fetch active subscription
    const sub = await UserSubscription.findOne({ user: user._id, active: true, endDate: { $gt: new Date() } }).sort({ endDate: -1 });
    const userObj = user.toObject();
    if (sub) {
      userObj.subscription = {
        planId: sub.plan,
        expiryDate: sub.endDate,
      };
    }

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, ...userObj },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// get current user (uses auth middleware below)
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;
    const sub = await UserSubscription.findOne({ user: user._id, active: true, endDate: { $gt: new Date() } }).sort({ endDate: -1 });
    const userObj = user.toObject();
    if (sub) {
      userObj.subscription = {
        planId: sub.plan,
        expiryDate: sub.endDate,
      };
    }
    return res.json(userObj);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
