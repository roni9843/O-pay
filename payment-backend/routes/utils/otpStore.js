// In-memory OTP store (Production-এ Redis ব্যবহার করো)
const otpStore = new Map(); // key: `${provider}-${accountNumber}-${simIndex}`

module.exports = otpStore;