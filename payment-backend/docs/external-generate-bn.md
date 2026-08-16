# Generate (সংক্ষিপ্ত)

`GET` বা `POST` `/api/external/generate`

টোকেন ও পেমেন্ট পেজ URL তৈরি করে (২০ মিনিটের জন্য বৈধ)।

হেডার:
- `X-API-Key`: আপনার সাবস্ক্রিপশনের API key

কুয়েরি বা JSON বডি (Payload):
- `method` (আবশ্যক): যেকোনো একটি (যেমন: `bkash`, `nagad`, `rocket`, `upay`)
- `amount` (আবশ্যক): পজিটিভ সংখ্যা
- `userIdentifyAddress` (আবশ্যক): ইউজার/অর্ডার আইডেন্টিফায়ার

সফল রেসপন্স উদাহরণ:
```json
{
  "success": true,
  "payment_page_url": "https://api.oraclepay.org/bkash/2f3c9f4b1a2c7d4e8f0a12cd",
  "amount": 200,
  "userIdentifyAddress": "ORDER-2025-0001",
  "expiresAt": "2025-12-15T14:20:00.000Z",
  "expiresInSeconds": 1200,
  "method": "bkash",
  "callbackUrl": "https://merchant.example.com/webhook/payment-verified"
}
```

ত্রুটি (উদাহরণ):
- 400: `Missing X-API-Key header` / `method required` / `amount... must be > 0` / `userIdentifyAddress query required` / `No callback URL configured...`
- 401: `Invalid API key`
- 403: `API key inactive` / `Subscription expired; API key deactivated.`
- 400: ডিভাইস/মেথড নেই, বা রিকোয়েস্টেড মেথড প্ল্যানে নেই

ফ্লো:
1) `/generate` কল করুন → `payment_page_url` ও টোকেন নিন
2) আপনার পেজে রিডাইরেক্ট করুন → ভিতরে `/resolve/:provider/:token` কল করুন
3) ইউজার পেমেন্ট করার পর `trxid` নিয়ে `/verify/:provider/:token` কল করুন
4) আপনার `callbackUrl`-এ ওয়েবহুক রিসিভ করুন

উদাহরণ (curl POST):
```bash
curl -X POST "https://api.oraclepay.org/api/external/generate" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"method": "bkash", "amount": 350, "userIdentifyAddress": "ORDER-2025-0001"}'
```

উদাহরণ (JavaScript fetch):
```js
async function generateToken() {
  const url = "https://api.oraclepay.org/api/external/generate";
  const res = await fetch(url, { 
    method: "POST",
    headers: { 
      "X-API-Key": "YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      method: "bkash",
      amount: 350,
      userIdentifyAddress: "ORDER-2025-0001"
    })
  });
  const data = await res.json();
  // data.payment_page_url, data.method, data.expiresAt
  console.log(data);
}
```
