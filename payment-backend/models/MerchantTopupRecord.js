const mongoose = require('mongoose');

const MerchantTopupRecordSchema = new mongoose.Schema(
  {
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'OpayBusiness', required: true },
    trxId: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    baseAmount: { type: Number },
    feeAmount: { type: Number },
    previousBalance: { type: Number },
    newBalance: { type: Number },
    method: { type: String },
    from: { type: String },
    paymentToken: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MerchantTopupRecord', MerchantTopupRecordSchema);
