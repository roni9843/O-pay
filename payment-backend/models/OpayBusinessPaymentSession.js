const mongoose = require('mongoose');

const OpayBusinessPaymentSessionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'OpayBusiness', required: true, index: true },
    amount: { type: Number, required: true },
    userIdentityAddress: { type: String, required: true },
    callbackUrl: { type: String, required: true },
    successRedirectUrl: { type: String, required: true },
    invoiceNumber: { type: String },
    checkoutItems: { type: mongoose.Schema.Types.Mixed },
    // Request/source metadata for abuse detection & analytics
    requestIp: { type: String, index: true },
    forwardedFor: { type: String },
    userAgent: { type: String },
    origin: { type: String },
    referer: { type: String },
    requestHost: { type: String },
    requestHeaders: { type: mongoose.Schema.Types.Mixed }, // sanitized subset
    approxLocation: { type: mongoose.Schema.Types.Mixed }, // IP-based geo (if resolved)
    ipRequestCountLastHour: { type: Number, default: 0 },
    // Timeline of user actions on the payment page (for footprint/debugging)
    events: [
      {
        type: { type: String, required: true },
        at: { type: Date, default: Date.now },
        meta: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    firstOpenedAt: { type: Date },
    lastActivityAt: { type: Date },
    status: { type: String, enum: ['pending', 'paid', 'expired', 'cancelled'], default: 'pending', index: true },
    expiresAt: { type: Date },
    verificationAttempts: [
      {
        at: { type: Date, default: Date.now },
        trxid: { type: String },
        provider: { type: String },
        agentAccountNumber: { type: String },
        success: { type: Boolean, default: false },
        reasonCode: { type: String },
        reasonMessage: { type: String },
        matchedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMessage' },
        messageAmount: { type: Number },
        sessionAmount: { type: Number },
        messageCreatedAt: { type: Date },
        linkStaySeconds: { type: Number, default: 0 },
      },
    ],
    lastVerificationFailure: {
      code: { type: String },
      message: { type: String },
      at: { type: Date },
      trxid: { type: String },
      provider: { type: String },
      agentAccountNumber: { type: String },
      linkStaySeconds: { type: Number, default: 0 },
    },
    lastVerificationSuccessAt: { type: Date },
    // Footprint data (Full & Masked)
    verificationFootprint: { type: mongoose.Schema.Types.Mixed },
    verificationFootprintMasked: { type: mongoose.Schema.Types.Mixed },
    footprintUrl: { type: String },
    footprintUrlNonMask: { type: String },
    
    // Linked Payment Message
    paymentMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMessage' },
    
    // AI Verification and Callback Details
    aiVerification: { type: mongoose.Schema.Types.Mixed },
    callbackResult: { type: mongoose.Schema.Types.Mixed },

    // Credit & Balance Snapshot at time of payment success
    walletAgentSnapshot: {
      agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      agentName: { type: String },
      creditBefore: { type: Number },
      creditAfter: { type: Number },
      creditDeducted: { type: Number },
    },
    merchantSnapshot: {
      businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'OpayBusiness' },
      businessName: { type: String },
      balanceBefore: { type: Number },
      balanceAfter: { type: Number },
      balanceAdded: { type: Number },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OpayBusinessPaymentSession', OpayBusinessPaymentSessionSchema);
