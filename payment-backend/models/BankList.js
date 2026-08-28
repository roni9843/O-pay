const mongoose = require('mongoose');

const BankListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true },
    logo: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    sortOrder: { type: Number, default: 0 },
    bgColor: { type: String, trim: true, default: '#ffffff' },
    textColor: { type: String, trim: true, default: '#1e293b' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankList', BankListSchema);
