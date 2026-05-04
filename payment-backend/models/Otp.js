const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, expires: '5m', default: Date.now } // Expires in 5 minutes
});

module.exports = mongoose.model('Otp', otpSchema);
