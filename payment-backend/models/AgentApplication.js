const mongoose = require('mongoose');

const AgentApplicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    required: true
  },
  upazila: {
    type: String,
    required: true
  },
  nidFront: {
    type: String,
    required: true // URL
  },
  nidBack: {
    type: String,
    required: true // URL
  },
  photo: {
    type: String,
    required: true // URL
  },
  hasBkash: {
    type: String, // 'Yes' or 'No'
    default: 'No'
  },
  hasNagad: {
    type: String,
    default: 'No'
  },
  hasUpay: {
    type: String,
    default: 'No'
  },
  wantBankAgent: {
    type: String,
    default: 'No'
  },
  canBankTrx: {
    type: String,
    default: 'No'
  },
  reason: {
    type: String
  },
  experience: {
    type: String
  },
  initialAmount: {
    type: String // User input might be text or number, keeping string for flexibility or Number if strict
  },
  canTopupMin: {
    type: String // "Yes"/"No"
  },
  isCorrectInfo: {
    type: Boolean,
    default: false
  },
  serviceType: {
    type: String,
    enum: [
      'Mobile Banking', 'Bank Transfer', 'Crypto', 'General',
      'মোবাইল ব্যাংকিং', 'ব্যাংক ট্রান্সফার', 'কিপ্টো এক্সচেঞ্জ'
    ],
    default: 'General'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AgentApplication', AgentApplicationSchema);
