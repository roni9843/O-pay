const express = require("express");
const router = express.Router();
const SubscriptionPlan = require("../models/SubscriptionPlan");
const authMiddleware = require("../middleware/auth");

// Get all subscription plans
router.get("/", async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new subscription plan (protected route)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const plan = new SubscriptionPlan(req.body);
    const newPlan = await plan.save();
    res.status(201).json(newPlan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Seed subscription plans (protected route)
router.post("/seed", async (req, res) => {
  try {
    const seedData = [
      {
        name: "Basic Plan",
        color: "green",
        features: {
          domain: 1,
          devices: "1",
          brand: 1,
          simNumbers: "1",
          uniqueIDs: "1",
          paymentMethods: ["bKash", "Rocket", "Nagad", "Upay"],
        },
        pricing: {
          monthly: 25,
          sixMonths: { price: 130, save: 20 },
          yearly: { price: 240, save: 60 },
        },
      },
      {
        name: "Standard Plan",
        color: "blue",
        features: {
          domain: 1,
          devices: "1",
          brand: 1,
          simNumbers: "2",
          uniqueIDs: "2",
          paymentMethods: ["bKash", "Rocket", "Nagad", "Upay"],
        },
        pricing: {
          monthly: 30,
          sixMonths: { price: 160, save: 20 },
          yearly: { price: 300, save: 60 },
        },
      },
      {
        name: "Premium Plan",
        color: "red",
        features: {
          domain: 1,
          devices: "Unlimited",
          brand: 1,
          simNumbers: "Unlimited",
          uniqueIDs: "Unlimited",
          paymentMethods: ["bKash", "Rocket", "Nagad", "Upay"],
        },
        pricing: {
          monthly: 50,
          sixMonths: { price: 250, save: 50 },
          yearly: { price: 480, save: 120 },
        },
      },
      {
        name: "Wallet Agent",
        color: "red",
        features: {
          domain: 0, // 0 will mean unlimited in UI logic if you want; here we keep simple
          devices: "Unlimited",
          brand: 1,
          simNumbers: "Unlimited",
          uniqueIDs: "Unlimited",
          paymentMethods: ["bKash", "Rocket", "Nagad", "Upay"],
        },
        pricing: {
          monthly: 500,
          sixMonths: { price: 2500, save: 500 },
          yearly: { price: 4800, save: 1200 },
        },
      },
    ];

    await SubscriptionPlan.deleteMany({}); // Clear existing plans
    const plans = await SubscriptionPlan.insertMany(seedData);
    res.status(201).json(plans);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;