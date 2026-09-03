require('dotenv').config();
const mongoose = require('mongoose');
const BankList = require('./models/BankList'); // Ensure path is correct relative to payment-backend

const bankNames = [
  "AB Bank Ltd", "Agrani Bank Ltd", "Bangladesh Commerce Bank Ltd",
  "Bangladesh Development Bank Ltd", "Bangladesh Krishi Bank",
  "Bangladesh Samabaya Bank Ltd", "Bangladesh Shilpa Rin Sangstha",
  "Bank Al-Falah Ltd", "Bank Asia Ltd", "Basic Bank Ltd",
  "Bengal Commercial Bank Limited", "Brac Bank Ltd", "Citi Bank N.A",
  "Citizens Bank PLC", "Commercial Bank of Ceylon", "Community Bank",
  "Dhaka Bank Ltd", "Dutch Bangla Bank Ltd", "Eastern Bank Ltd",
  "Exim Bank Ltd", "First Security Islami Bank Ltd", "Global Islami Bank Ltd",
  "Habib Bank Ltd", "HSBC", "ICB Islamic Bank Ltd", "Ific Bank Ltd",
  "Islami Bank Bangladesh Ltd", "Jamuna Bank Ltd", "Janata Bank Ltd",
  "Meghna Bank Ltd", "Mercantile Bank Ltd", "Midland Bank Ltd",
  "Modhumoti Bank Ltd", "Mutual Trust Bank Ltd", "National Bank Ltd",
  "National Bank of Pakistan", "NCC Bank Ltd", "NRB Bank Ltd",
  "NRB Commercial Bank Ltd", "One Bank Ltd", "Padma Bank Ltd",
  "Prime Bank Ltd", "Pubali Bank Ltd", "Rakub (Rajshahi Krishi Unnayan Bank)",
  "Rupali Bank Ltd", "SBAC Bank Ltd", "Shahjalal Islami Bank Ltd",
  "Shimanto Bank Ltd", "Social Islami Bank Ltd", "Sonali Bank Ltd",
  "Southeast Bank Ltd", "St. Chartered Bank (Standard Chartered Bank)",
  "Standard Bank Ltd", "State Bank of India", "The City Bank Ltd",
  "The Premier Bank Ltd", "Trust Bank Ltd", "Union Bank Ltd",
  "United Commercial Bank Ltd", "Uttara Bank Ltd", "Woori Bank Ltd"
];

async function seedBanks() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("MONGO_URI is missing in .env");
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log("Connected to DB, seeding banks...");

    for (let i = 0; i < bankNames.length; i++) {
      const name = bankNames[i];
      // Check if it already exists
      const exists = await BankList.findOne({ name });
      if (!exists) {
        await BankList.create({
          name: name,
          status: 'active',
          sortOrder: i + 1
        });
        console.log(`Inserted: ${name}`);
      } else {
        console.log(`Already exists: ${name}`);
      }
    }
    
    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding banks:", err);
    process.exit(1);
  }
}

seedBanks();
