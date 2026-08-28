const mongoose = require('mongoose');

const OpayBusinessPackageSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Lifetime Activation Package' },
    amount: { type: Number, default: 5000 }, // Default BDT fee
    offerDetails: { type: String, default: 'এককালীন ফি প্রদান করে আজীবন আনলিমিটেড পেমেন্ট লিংক তৈরি করুন।' },
    features: { type: [String], default: [
      'লাইফটাইম আনলিমিটেড পেমেন্ট লিংক তৈরি',
      '০% অতিরিক্ত হিডেন চার্জ',
      'রিয়েল-টাইম ট্রানজ্যাকশন মনিটরিং ড্যাশবোর্ড',
      'গ্রাহকদের জন্য প্রিমিয়াম সাকসেস ল্যান্ডিং পেইজ',
      '২৪/৭ মার্চেন্ট ও কাস্টমার সাপোর্ট সার্ভিস'
    ]},
    isActive: { type: Boolean, default: true },
    packageType: { type: String, enum: ['deposit', 'withdrawal', 'both'], default: 'both' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OpayBusinessPackage', OpayBusinessPackageSchema);
