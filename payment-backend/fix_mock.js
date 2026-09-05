const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Session = require('./models/OpayBusinessPaymentSession');
  const sessions = await Session.find({});
  let updated = 0;
  
  for (let s of sessions) {
    let changed = false;
    const str = JSON.stringify(s.toObject());
    if (str.includes('mock_agent_id') || str.includes('mock_bank_account_id')) {
      console.log('Found mock session:', s.code);
      
      if (s.bankDetails) {
        if (s.bankDetails.agentId === 'mock_agent_id') {
          s.bankDetails.agentId = '600000000000000000000001';
          changed = true;
        }
        if (s.bankDetails.bankAccountId === 'mock_bank_account_id') {
          s.bankDetails.bankAccountId = '600000000000000000000002';
          changed = true;
        }
        if (s.bankDetails.agentAccount) {
          if (s.bankDetails.agentAccount.agentId === 'mock_agent_id') {
            s.bankDetails.agentAccount.agentId = '600000000000000000000001';
            changed = true;
          }
          if (s.bankDetails.agentAccount.bankAccountId === 'mock_bank_account_id') {
            s.bankDetails.agentAccount.bankAccountId = '600000000000000000000002';
            changed = true;
          }
        }
      }
      
      if (changed) {
        await s.save();
        updated++;
      }
    }
  }
  
  console.log('Cleaned up ' + updated + ' old mock sessions');
  process.exit(0);
}).catch(console.error);
