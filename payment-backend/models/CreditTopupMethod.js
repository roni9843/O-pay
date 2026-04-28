const mongoose = require('mongoose');

const CreditTopupMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  image: {
    type: String // URL
  },
  details: {
    type: String // Bank Details / Instructions
  },
  fields: [{
    label: String,
    inputType: {
      type: String,
      enum: ['text', 'number', 'file'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('CreditTopupMethod', CreditTopupMethodSchema);
