const mongoose = require("mongoose");

const TEMPLATE_PROVIDERS = ["bkash", "rocket", "nagad", "upay"];
const TEMPLATE_GATEWAYS = ["personal", "merchant"];

const WalletAgentPaymentTemplateSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: TEMPLATE_PROVIDERS,
      required: true,
    },
    gateway: {
      type: String,
      enum: TEMPLATE_GATEWAYS,
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
    importantNote: {
      type: String,
      default: "",
      trim: true,
    },
    details: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      default: "",
      trim: true,
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

WalletAgentPaymentTemplateSchema.index({ provider: 1, gateway: 1 }, { unique: true });

module.exports = mongoose.model("WalletAgentPaymentTemplate", WalletAgentPaymentTemplateSchema);
