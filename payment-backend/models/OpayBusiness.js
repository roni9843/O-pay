const mongoose = require('mongoose');

const OpayBusinessSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    domain: { type: String, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    apiToken: { type: String, required: true, unique: true },
    balanceAdjustment: { type: Number, default: 0 },
    kycStatus: { 
      type: String, 
      enum: ['not_submitted', 'pending', 'approved', 'rejected'], 
      default: 'not_submitted' 
    },
    kycMessage: {
      type: String,
      default: ''
    },
    kycData: {
      company: {
        name: String,
        mdName: String,
        profilePic: String, // path to file
        mdMobile: String,
        dob: String, // or Date
        nidNo: String,
        nidFront: String, // path
        nidBack: String, // path
        tradeLicenseNo: String,
        tradeLicenseAttachment: String, // path
        address: {
          division: String,
          district: String,
          thana: String,
          details: String
        }
      },
      primaryContact: {
        isSameAsMD: Boolean,
        name: String,
        phone: String,
        email: String
        // Removed dob, nidNo, nidFront, nidBack
      },
      banking: [{
        bankName: String,
        branchName: String,
        accountName: String,
        accountNo: String,
        routingNo: String,
        isDefault: Boolean
      }],
      mfs: [{
        provider: String, // "MFS Name"
        type: { type: String, enum: ['Personal', 'Agent'], default: 'Personal' },
        number: String,
        isDefault: Boolean
      }],
      site: {
        url: String
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OpayBusiness', OpayBusinessSchema);
