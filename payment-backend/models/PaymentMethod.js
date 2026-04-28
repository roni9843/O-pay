const mongoose = require("mongoose");

const PAYMENT_PROVIDERS = ["bkash", "rocket", "nagad", "upay"]; // upay for upay
const PAYMENT_GATEWAYS = ["personal", "merchant"];
const PAYMENT_STATUS = ["active", "inactive"];

const PaymentMethodSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^01[3-9]\d{8}$/,
    },
    gateway: {
      type: String,
      enum: PAYMENT_GATEWAYS,
      default: "personal", // Default personal
    },
    simIndex: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS,
      default: "active",
    },
  },
  { timestamps: true }
);

// Unique per device + provider + accountNumber
PaymentMethodSchema.index({ device: 1, provider: 1, accountNumber: 1 }, { unique: true });

module.exports = mongoose.model("PaymentMethod", PaymentMethodSchema);