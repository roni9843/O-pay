const mongoose = require('mongoose');

const pushLogSchema = new mongoose.Schema({
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  type: {
    type: String,
    enum: ['notification', 'alarm'],
    required: true
  },
  title: {
    type: String
  },
  message: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'delivered'],
    default: 'sent'
  },
  deliveredAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('PushLog', pushLogSchema);
