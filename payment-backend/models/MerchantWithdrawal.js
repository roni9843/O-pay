const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const merchantWithdrawalSchema = new Schema({
    merchantId: {
        type: Schema.Types.ObjectId,
        ref: 'OpayBusiness',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    commissionPercent: {
        type: Number,
        default: 0
    },
    commissionAmount: {
        type: Number,
        default: 0
    },
    receiveAmount: {
        type: Number,
        default: 0
    },
    method: {
        // e.g. { type: 'MFS', provider: 'bKash', number: '01711223344' } or { type: 'Bank', bankName: 'DBBL', accountNo: '123' }
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectReason: {
        type: String,
        default: null
    },
    proofImages: {
        type: [String],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model('MerchantWithdrawal', merchantWithdrawalSchema);
