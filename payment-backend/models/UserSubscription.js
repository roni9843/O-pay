const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  startDate: { type: Date, default: Date.now },
  durationMonths: { type: Number, required: true },
  endDate: { type: Date, required: true },
  purchasePrice: { type: Number, required: true },
  domains: [{ type: String }],
  featuresSnapshot: { type: mongoose.Schema.Types.Mixed },
  pricingSnapshot: { type: mongoose.Schema.Types.Mixed },
  active: { type: Boolean, default: true },
  // Per-subscription API key (plain string). Default null until user generates.
  // NOTE: For production security, store only a hash & show key once at creation.
  apiKey: { type: String, default: null },
  // Whether the apiKey is currently active (usable). Separate from subscription active lifecycle.
  apiKeyActive: { type: Boolean, default: true },
  // Callback URL where client wants to receive server-to-server notifications
  apiCallbackUrl: { type: String, default: null, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
