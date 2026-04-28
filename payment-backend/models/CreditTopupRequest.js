const mongoose = require('mongoose');

const CreditTopupRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreditPlan',
    required: true
  },
  methodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreditTopupMethod',
    required: false // Optional in case method is deleted later, but good to keep snapshot
  },
  methodName: String, // Snapshot
  submissionData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed // For file URLs or text
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('CreditTopupRequest', CreditTopupRequestSchema);
