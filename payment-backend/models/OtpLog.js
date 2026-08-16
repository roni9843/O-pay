const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  accountNumber: { type: String, required: true },
  simIndex: { type: Number, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  otp: { type: String, required: true },
  gateway: { type: String, default: 'personal' },
  expiresAt: { type: Date, required: true }
});

// Auto-delete expired OTPs
otpLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpLog', otpLogSchema);
