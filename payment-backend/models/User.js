const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, sparse: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "wallet_agent", "user"],
      default: "user",
    },
    balance: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    minimumCredit: { type: Number, default: 0 },
    backgroundColor: { type: String, default: null },
    supportNumber: { type: String, default: null },
    statusTitle: { type: String, default: null },
    statusSubtitle: { type: String, default: "" },
    statusIcon: { type: String, default: "" },
    showStatus: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
