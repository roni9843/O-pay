const mongoose = require('mongoose');

const CreditPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  creditAmount: {
    type: Number,
    required: true,
    min: 0
  },
  minimumCredit: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  commission: {
    type: Number,
    required: true,
    min: 0
  },
  commissionType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  autoWithdrawalCommission: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOneTime: {
    type: Boolean,
    default: false
  },
  details: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CreditPlan', CreditPlanSchema);
