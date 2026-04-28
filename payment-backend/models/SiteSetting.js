const mongoose = require('mongoose');

const siteSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed, // Can be string, object, number etc.
    required: true
  },
  description: String
}, { timestamps: true });

module.exports = mongoose.model('SiteSetting', siteSettingSchema);
