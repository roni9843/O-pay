import os

path = r'e:\MY Aplication\3rd Step\88-website\payment-backend\routes\opayBusinessExternal.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'const devices = await Device.find({ fcmToken: { $ne: null } }).select' in line and i > 3000 and not skip:
        new_lines.append('''      const agentDevices = session.cryptoDetails?.agentId 
        ? await Device.find({ owner: session.cryptoDetails.agentId, fcmToken: { $ne: null } }).select('_id fcmToken').lean() 
        : [];
      const tokens = agentDevices.map(d => d.fcmToken).filter(Boolean);

      if (isFirebaseInitialized && firebaseAdmin && tokens.length > 0) {
        const payload = {
          data: {
            type: "notification",
            title: `ক্রিপ্টো পেমেন্ট প্রুফ (৳${amountFormatted})`,
            message: `${cryptoName || 'Crypto'} এর মাধ্যমে একটি পেমেন্ট এসেছে। দয়া করে যাচাই করুন।`,
            sessionId: session._id.toString(),
            paymentType: "crypto_payment_proof"
          },
          android: {
            priority: "high"
          }
        };\n''')
        skip = True
    elif skip:
        if 'priority: "high"' in line:
            skip = False
            # We also need to skip the closing braces
            lines_to_skip = 2
    else:
        if 'lines_to_skip' in locals() and lines_to_skip > 0:
            lines_to_skip -= 1
        else:
            new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Done!')
