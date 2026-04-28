const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const UserSubscription = require("../models/UserSubscription");

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
