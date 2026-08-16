const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');
const OpayBusinessPaymentSession = require('./models/OpayBusinessPaymentSession');

async function run() {
    await connectDB();
    // Find a session that is paid
    const session = await OpayBusinessPaymentSession.findOne({ status: 'paid' }).sort({ createdAt: -1 });
    if (session) {
        console.log('FOUND_PAID_SESSION_CODE:', session.code);
    } else {
        console.log('NO_PAID_SESSION_FOUND');
        // Let's print any session to see what we have
        const anySession = await OpayBusinessPaymentSession.findOne().sort({ createdAt: -1 });
        if (anySession) {
            console.log('FOUND_ANY_SESSION_CODE:', anySession.code, 'STATUS:', anySession.status);
        } else {
            console.log('NO_SESSIONS_IN_DB_AT_ALL');
        }
    }
    await mongoose.connection.close();
}

run();
