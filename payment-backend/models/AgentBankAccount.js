const mongoose = require('mongoose');

const AgentBankAccountSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    division: {
      type: String,
      trim: true,
      default: '',
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    upazilaThana: {
      type: String,
      trim: true,
      default: '',
    },
    routingNumber: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    minAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AgentBankAccount', AgentBankAccountSchema);
