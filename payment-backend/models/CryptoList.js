const mongoose = require('mongoose');

const CryptoListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true },
    logo: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    currency: { type: String, required: true, trim: true, default: 'USDT' },
    rate: { type: Number, required: true, default: 1 }, // 1 Crypto unit = X BDT
    chargePercent: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    bgColor: { type: String, trim: true, default: '#0f172a' },
    textColor: { type: String, trim: true, default: '#ffffff' },
    labelColor: { type: String, trim: true, default: '#94a3b8' },
    instructions: { type: String, trim: true, default: '' },
    minAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CryptoList', CryptoListSchema);
