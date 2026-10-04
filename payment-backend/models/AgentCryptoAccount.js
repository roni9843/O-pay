const mongoose = require('mongoose');

const AgentCryptoAccountSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cryptoName: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      trim: true,
      default: '',
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    accountHolderName: {
      type: String,
      trim: true,
      default: '',
    },
    qrCodeLogo: {
      type: String,
      trim: true,
      default: '',
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

module.exports = mongoose.model('AgentCryptoAccount', AgentCryptoAccountSchema);
