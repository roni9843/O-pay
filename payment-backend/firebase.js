const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

let isFirebaseInitialized = false;

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully.');
  } catch (err) {
    console.error('[Firebase] Failed to initialize Admin SDK:', err);
  }
} else {
  console.log('[Firebase] serviceAccountKey.json not found. Push notifications will be disabled.');
}

module.exports = {
  admin,
  isFirebaseInitialized
};
