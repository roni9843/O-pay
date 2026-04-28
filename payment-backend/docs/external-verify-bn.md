
## Webhook (Callback)
- সফল ভেরিফাই হলে আপনার `callbackUrl`-এ `POST` যায় (JSON)
- টাইমআউট: ৫ সেকেন্ড; ব্যর্থ হলে শুধু লগ হয়, রিট্রাই নেই
- পে-লোড:
```json
{
  "success": true,
  "userIdentifyAddress": "ORDER-2025-0001",
  "time": "2025-12-15T14:22:10.123Z",
  "method": "bkash",
  "token": "2f3c9f4b1a2c7d4e8f0a12cd",
  "amount": 350,
  "from": "017XXXXXXXX",
  "trxid": "BKA123456789",
  "deviceName": "Device A",
  "deviceId": "65f...",
  "bdTimeZone": "GMT+6"
}
```
নোট:
- শুধু `VERIFIED` হলে কলব্যাক পাঠানো হয়
- সিগনেচার/সিক্রেট নেই; চাইলে নিজস্ব সিক্রেট হেডার/পাথ দিয়ে ভ্যালিডেট করুন
