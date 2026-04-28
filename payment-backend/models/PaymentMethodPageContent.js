const mongoose = require("mongoose");

const DEPOSIT_METHODS = ["bkash", "rocket", "nagad", "upay"];

const PaymentMethodPageContentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // If true, this page was created/managed by admin and is read-only for the owner
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    details: {
      type: [String],
      default: [],
    },
    paymentMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentMethod",
      required: true,
    },
    methodName: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    importantNote: {
      type: String,
      default: "",
      trim: true,
    },
    depositMethod: {
      type: String,
      enum: DEPOSIT_METHODS,
      required: true,
    },
    color: {
      type: String,
      default: "",
      trim: true,
    },
    bgColor: {
      type: String,
      default: "",
      trim: true,
    },
    buttonText: {
      type: String,
      default: "",
      trim: true,
    },
    buttonTextColor: {
      type: String,
      default: "",
      trim: true,
    },
    buttonTextBgColor: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);
// Prevent duplicate page per (owner, paymentMethod)
PaymentMethodPageContentSchema.index({ owner: 1, paymentMethod: 1 }, { unique: true });

module.exports = mongoose.model("PaymentMethodPageContent", PaymentMethodPageContentSchema);
