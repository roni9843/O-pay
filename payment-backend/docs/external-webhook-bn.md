# পেমেন্ট সাকসেস ওয়েবহুক (Payment Webhook)

পেমেন্ট সফল হলে আপনার সেট করা **Webhook Callback URL**-এ একটি `POST` রিকোয়েস্ট পাঠানো হবে।

### Endpoint
```http
POST YOUR_CALLBACK_URL
Content-Type: application/json
```

### JSON Payload Structure

```json
{
  "success": true, 
  "userIdentifyAddress": "ORDER-2025-0001",
  "time": "2026-08-05T15:30:00.000Z",
  "method": "bkash",
  "token": "e4bca712b2b6496c4d46594c",
  "amount": 150,
  "from": "017XXXXXXXX",
  "trxid": "86SZ64ZY",
  "deviceName": "Samsung Galaxy A54",
  "deviceId": "dev_abc12345xyz",
  "bdTimeZone": "Asia/Dhaka"
}
```

### ডেটা টাইপের বিবরণ

| ফিল্ডের নাম | ডেটা টাইপ (Type) | বিবরণ |
| :--- | :--- | :--- |
| `success` | **Boolean** | এটি সবসময় `true` হবে। |
| `userIdentifyAddress` | **String** / `null` | লিংক জেনারেট করার সময় দেওয়া টেক্সট বা অর্ডার আইডি। |
| `time` | **String** | পেমেন্ট রিসিভ হওয়ার সময় (ISO Date format)। |
| `method` | **String** / `null` | পেমেন্ট মেথড (যেমন: `bkash`, `nagad`, `rocket`, `upay`)। |
| `token` | **String** | পেমেন্ট সেশনের ইউনিক টোকেন। |
| `amount` | **Number** | পেমেন্টের পরিমাণ। |
| `from` | **String** / `null` | কাস্টমারের মোবাইল নম্বর। |
| `trxid` | **String** | সফল পেমেন্টের ট্রান্সজেকশন আইডি (TrxID)। |
| `deviceName` | **String** / `null` | পেমেন্ট রিসিভার ডিভাইসের নাম। |
| `deviceId` | **String** / `null` | ঐ ডিভাইসের আইডি। |
| `bdTimeZone` | **String** / `null` | টাইমজোন। |

### Example - Node.js (Express)
```javascript
app.post('/webhook/payment-verified', (req, res) => {
  const paymentData = req.body;
  if (paymentData.success) {
    console.log(`Order ${paymentData.userIdentifyAddress} paid amount: ${paymentData.amount}`);
    // Update your database here
  }
  res.status(200).send('OK');
});
```

### Example - PHP
```php
<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    $paymentData = json_decode($json, true);

    if ($paymentData && $paymentData['success']) {
        $orderId = $paymentData['userIdentifyAddress'];
        $amount = $paymentData['amount'];
        $trxId = $paymentData['trxid'];
        
        // Update your database here
        
        http_response_code(200);
        echo "OK";
    }
}
?>
```
