// models/Transaction.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  fullMessage: {
    type: String,
    required: true,
  },
  masking: {
    type: String,
    default: "null",
  },
  from: {
    type: String,
    default: "null",
  },
  trxID: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: String,
   default: "null",
  },
  time: {
    type: String,
    default: "null",
  },
  deviceName: {
    type: String,
    default: "unknown_device",
  },
  deviceId: {
    type: String,
    default: "unknown_device",
  },
  deviceTime: {
    type: String,
    default: "null",
  },
  type: {
    type: String,
    default: "unknown",
  },
  title: {
    type: String,
    default: "Unknown",
  },
  BDTimeZone: {
    type: String,
    default: () => moment.tz("Asia/Dhaka").format()
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Verification flags
  verify: {
    type: Boolean,
    default: false,
    index: true,
  },
  apiAccessToken: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiAccessToken',
    default: null,
    index: true,
  },
  // Link to the session where this payment was verified
  paymentSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OpayBusinessPaymentSession',
    default: null,
    index: true,
  },
});

module.exports = mongoose.model("PaymentMessage", transactionSchema);
