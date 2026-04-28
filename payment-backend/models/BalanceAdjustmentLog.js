const mongoose = require('mongoose');

const BalanceAdjustmentLogSchema = new mongoose.Schema(
  {
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    walletAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OpayBusiness',
      default: null,
    },
    targetType: {
      type: String,
      enum: ['wallet_agent', 'merchant', 'paired'],
      required: true,
    },
    action: {
      type: String,
      enum: ['plus', 'minus'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    walletCreditDelta: {
      type: Number,
      required: true,
    },
    merchantBalanceDelta: {
      type: Number,
      required: true,
    },
    walletCreditBefore: {
      type: Number,
      required: true,
    },
    walletCreditAfter: {
      type: Number,
      required: true,
    },
    merchantBalanceBefore: {
      type: Number,
      required: true,
    },
    merchantBalanceAfter: {
      type: Number,
      required: true,
    },
    merchantWalletBefore: {
      type: Number,
      default: 0,
    },
    merchantWalletAfter: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

BalanceAdjustmentLogSchema.index({ createdAt: -1 });
BalanceAdjustmentLogSchema.index({ walletAgent: 1, merchant: 1, createdAt: -1 });

module.exports = mongoose.model('BalanceAdjustmentLog', BalanceAdjustmentLogSchema);
