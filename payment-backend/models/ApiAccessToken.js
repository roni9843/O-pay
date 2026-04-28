const mongoose = require('mongoose');

const apiAccessTokenSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSubscription', required: true, index: true },
  methods: [{ type: String, enum: ['bkash','rocket','nagad','upay'], required: true }],
  token: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  // Token expiry time; set by generator (e.g., now + 20 minutes)
  expiresAt: { type: Date, required: true },
  // Client-supplied identifier/address for payer/user (required by generator API)
  userIdentifyAddress: { type: String, required: true, trim: true },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// TTL index to auto-remove expired documents
apiAccessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ApiAccessToken', apiAccessTokenSchema);