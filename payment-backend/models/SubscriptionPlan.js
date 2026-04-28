const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["Basic Plan", "Standard Plan", "Premium Plan", "Wallet Agent"],
    },
    color: {
      type: String,
      enum: ["green", "blue", "red"],
      required: true,
    },
    features: {
      domain: {
        type: Number,
        required: true,
        default: 1,
      },
      devices: {
        type: String,
        required: true,
      },
      brand: {
        type: Number,
        required: true,
        default: 1,
      },
      simNumbers: {
        type: String,
        required: true,
      },
      uniqueIDs: {
        type: String,
        default: "1",
      },
      paymentMethods: [
        {
          type: String,
          enum: ["bKash", "Rocket", "Nagad", "Upay"],
        },
      ],
    },
    pricing: {
      monthly: {
        type: Number,
        required: true,
      },
      sixMonths: {
        price: { type: Number, required: true },
        save: { type: Number, default: 0 },
      },
      yearly: {
        price: { type: Number, required: true },
        save: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);