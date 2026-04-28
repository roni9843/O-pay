# OraclePay Business API

Integrate **OraclePay** in just **2 simple steps**.

---

## 🚀 Step 1: Create a Payment Link
When a user clicks "Pay", send a request to our API to get a payment link.

**Required Header:**
`X-Opay-Business-Token: YOUR_BUSINESS_API_TOKEN`

**Request:**
`POST https://api.oraclepay.org/api/opay-business/generate-payment-page`

```javascript
// Node.js (Axios) Example
const axios = require('axios');

async function createPayment() {
  const response = await axios.post('https://api.oraclepay.org/api/opay-business/generate-payment-page', {
    payment_amount: 500,                    // init must
    user_identity_address: 'user@example.com', // must
    callback_url: 'https://your-site.com/webhook', // must
    success_redirect_url: 'https://your-site.com/success', // must
    checkout_items: {                       // your wish (e.g. address, product info, etc.) 
      product: "Test Order",
      qty: 1,
      address: "Dhaka, Bangladesh"
    },
    invoice_number: 'INV-12345'             // your wish 
  }, {
    headers: { 'X-Opay-Business-Token': 'YOUR_BUSINESS_API_TOKEN' }
  });

  if (response.data.success) {
    // Redirect user to this URL to pay
    console.log('Redirect User To:', response.data.payment_page_url);
  }
}
```

---

## 🚀 Step 2: Receive Payment Notification (Webhook)
When the payment is successful, we will instantly notify your `callback_url`.

**We send you this JSON:**
```json
{
  "status": "COMPLETED",
  "invoice_number": "INV-12345",
  "amount": 500,
  "transaction_id": "XY123AB", 
  "session_code": "60df****f6",
  "user_identity": "user@example.com",
  "checkout_items": {
    "product": "Test Order",
    "qty": 1,
    "address": "Dhaka, Bangladesh"
  },
  "footprint": "https://secure.oraclepay.org/payment/60df****f6/mask/footprint",
  "bank": "bkash"
}
```

**You handle it like this (Node.js/Express):**
```javascript
app.post('/api/payment/callback', (req, res) => {
  const data = req.body;
  
  if (data.status === 'COMPLETED') {
     console.log(`Payment Received: ${data.amount} via ${data.bank}`);
     // TODO: Update your database (Mark order as PAID)
  }

  res.send('OK'); // Always reply 'OK'
});
```

---

## Full API Reference (Detailed)

### 1. `POST /generate-payment-page` Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `payment_amount` | `number` | **Yes** | The amount you want to charge. Must be at least **5**. |
| `user_identity_address` | `string` | **Yes** | Your user's unique identifier (e.g., User ID, Email, or Wallet Address). This helps you track who made the payment. |
| `callback_url` | `string` | **Yes** | A valid secure URL (https) on your server. We will send a `POST` request here when payment is successful. |
| `success_redirect_url` | `string` | **Yes** | Where should we redirect the user after they successfully pay? (e.g. "Thank you" page). |
| `checkout_items` | `object` | No | Optional JSON object to pass **any extra info** (Address, Product ID, etc.). We do not process this, just return it back to you in the webhook. |
| `invoice_number` | `string` | No | Your system's generic Invoice ID or Order ID. We return this back in the webhook. |

### 2. Webhook Payload Fields
When a payment is completed, we will POST this data to your `callback_url`:

| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | The status of the transaction. Look for **"COMPLETED"**. |
| `transaction_id` | `string` | The unique Transaction ID (TrxID) provided by the wallet provider (e.g., the actual bKash/Nagad TrxID). |
| `session_code` | `string` | The unique OraclePay session code for this payment. |
| `amount` | `number` | The actual amount received. |
| `bank` | `string` | The provider used for payment. Possible values: `bkash`, `nagad`, `rocket`, `upay`. |
| `footprint` | `string` | A detailed video-like record of the user's clicks and interactions on the payment page (Security Proof). |
| `user_identity` | `string` | The `user_identity_address` you passed in the initial request. |
| `checkout_items` | `object` | The `checkout_items` object you passed in the request. |
| `invoice_number` | `string` | The `invoice_number` you passed in the initial request. |
