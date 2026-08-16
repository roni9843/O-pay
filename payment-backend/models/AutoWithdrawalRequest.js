const mongoose = require('mongoose');

const autoWithdrawalRequestSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OpayBusiness',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  userIdentityAddress: {
    type: String,
    required: true,
  },
  accountNumber: {
    type: String,
    required: true,
  },
  callbackUrl: {
    type: String,
    required: true,
  },
  checkoutItems: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  status: {
    type: String,
    enum: ['pending', 'booked', 'completed', 'failed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Wallet Agent
    default: null
  },
  bookedAt: {
    type: Date,
    default: null
  },
  proofImages: [{
    type: String
  }],
  rejectedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rejectReason: {
    type: String,
    default: ''
  },
  // Snapshot balances for record keeping
  merchantBalanceBefore: {
    type: Number,
    default: null
  },
  merchantBalanceAfter: {
    type: Number,
    default: null
  },
  agentCreditBefore: {
    type: Number,
    default: null
  },
  agentCreditAfter: {
    type: Number,
    default: null
  },
  callbackResult: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { timestamps: true });

// Pre-save hook or methods can be added here if needed

module.exports = mongoose.model('AutoWithdrawalRequest', autoWithdrawalRequestSchema);
