const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    deviceUserName: { 
      type: String, 
      required: true, 
      trim: true
    },
    deviceName: { 
      type: String, 
      default: null 
    },
    deviceCode: { 
      type: String, 
      default: null,
      unique: true,
      sparse: true
    },
    deviceModelName: { 
      type: String, 
      default: null 
    },
    activationId: {
      type: String,
      default: null
    },
    activationTime: {
      type: Date,
      default: null
    },
    endActivationTime: {
      type: Date,
      default: null
    },
    state: {
      type: Boolean,
      default: false
    },
    subscriptionStartDate: {
      type: Date,
      required: true
    },
    subscriptionEndDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,  // duration in months
      required: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserSubscription',
      required: true
    },
  },
  { timestamps: true }
);

// Optional: you can enforce unique deviceId if required:
// DeviceSchema.index({ deviceId: 1 }, { unique: true, sparse: true });
// Ensure deviceUserName is unique per owner
DeviceSchema.index({ owner: 1, deviceUserName: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Device', DeviceSchema);