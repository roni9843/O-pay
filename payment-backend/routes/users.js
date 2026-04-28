const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Update profile (name, backgroundColor)
// Body: { name?: string, backgroundColor?: string }
// Update profile (name, backgroundColor, supportNumber)
// Body: { name?: string, backgroundColor?: string, supportNumber?: string }
router.patch("/profile", auth, async (req, res) => {
  try {
    const { name, backgroundColor, supportNumber } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof backgroundColor === "string") user.backgroundColor = backgroundColor;
    if (typeof supportNumber === 'string' && supportNumber.trim()) {
      user.supportNumber = supportNumber.trim();
    }

    await user.save();
    const resp = await User.findById(user._id).select("-password");
    res.json({ message: "Profile updated", user: resp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Change password
// Body: { currentPassword: string, newPassword: string }
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Add balance to authenticated user's account
// Body: { amount: Number }
router.post("/add-balance", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    if (num < 25) {
      return res
        .status(400)
        .json({ message: "Minimum amount is 25" });
    }

    // req.user is set by auth middleware (without password)
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.balance = (user.balance || 0) + num;
    await user.save();

    // return user without password
    const resp = await User.findById(user._id).select("-password");
    res.json({ message: "Balance updated", user: resp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

module.exports = router;
