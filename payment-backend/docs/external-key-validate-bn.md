# Key Validate (বাংলা সংক্ষিপ্ত)

`GET /api/external/key/validate`

সাবস্ক্রিপশন ও API key ঠিক আছে কিনা, সক্রিয় ডিভাইস ও নম্বর আছে কিনা — দ্রুত যাচাই করে।

হেডার:
- `X-API-Key` (আবশ্যক)

যাচাই করে:
- API key বৈধ, active
- সাবস্ক্রিপশন active ও এখনও expire হয়নি
- ইউজার আছে
- active ডিভাইস আছে
- active পেমেন্ট নম্বর আছে (device-এ attached `PaymentMethod`)

সফল রেসপন্স (উদাহরণ):
```json
{
  "success": true,
  "valid": true,
  "subscriptionId": "676...",
  "endDate": "2026-01-15T00:00:00.000Z",
  "latestEndDate": "2026-02-01T00:00:00.000Z",
  "domains": ["merchant.example.com"],
  "primaryDomain": "merchant.example.com",
  "deviceCount": 2,
  "activeNumberCount": 3,
  "plan": { "id": "645...", "name": "Pro" }
}
```

ত্রুটি (উদাহরণ):
- 400: `{ "success": false, "valid": false, "reason": "MISSING_API_KEY" }`
- 401: `{ "success": false, "valid": false, "reason": "INVALID_API_KEY" }`
- 403: `{ "success": false, "valid": false, "reason": "API_KEY_INACTIVE" }`
- 404: `{ "success": false, "valid": false, "reason": "USER_NOT_FOUND" }`
- 200: `{ "success": false, "valid": false, "reason": "SUBSCRIPTION_EXPIRED_OR_INACTIVE" }`
- 200: `{ "success": false, "valid": false, "reason": "NO_ACTIVE_DEVICES" }`
- 200: `{ "success": false, "valid": false, "reason": "NO_ACTIVE_DEVICE_NUMBERS" }`
- 500: `{ "success": false, "valid": false, "reason": "SERVER_ERROR" }`

উদাহরণ (curl):
```bash
curl -X GET "https://api.oraclepay.org/api/external/key/validate" \
  -H "X-API-Key: YOUR_API_KEY"
```
