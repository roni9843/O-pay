import os
path = r'e:\MY Aplication\3rd Step\88-website\opay-client\src\PaymentPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace message
content = content.replace(
    '{checkoutItems?.customSuccess?.message || "মার্চেন্টে রিডাইরেক্ট করা হচ্ছে..."}',
    '{paymentSuccessType === \\\'manual\\\' ? "আপনার পেমেন্টটি যাচাই করতে ৫ মিনিট থেকে ১ ঘণ্টা সময় লাগতে পারে। ৮ সেকেন্ড পর স্বয়ংক্রিয়ভাবে রিডাইরেক্ট হবে।" : (checkoutItems?.customSuccess?.message || "মার্চেন্টে রিডাইরেক্ট করা হচ্ছে...")}'
)

# Replace link text
content = content.replace(
    'এগিয়ে যেতে এখানে ক্লিক করুন',
    '{paymentSuccessType === \\\'manual\\\' ? "মার্চেন্ট ওয়েবসাইটে ফিরে যান" : "এগিয়ে যেতে এখানে ক্লিক করুন"}'
)

# Remove isPendingBank UI
if 'if (isPendingBank) {' in content:
    idx1 = content.find('if (isPendingBank) {')
    idx2 = content.find('if (showBankModal && selectedAccount) {', idx1)
    if idx2 != -1:
        content = content[:idx1] + content[idx2:]

# Remove isPendingCrypto UI
if 'if (isPendingCrypto) {' in content:
    idx1 = content.find('if (isPendingCrypto) {')
    idx2 = content.find('if (showCryptoModal && selectedAccount) {', idx1)
    if idx2 != -1:
        content = content[:idx1] + content[idx2:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
