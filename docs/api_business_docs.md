# OraclePay Business API

Welcome to the OraclePay Business API documentation. We provide two main services for our business partners:
1. **Business Payment API:** Accept payments directly from your users via our secure payment gateway.
2. **Auto Withdrawal API:** Programmatically send money to your users/agents automatically via our Wallet Agents network.

---

# Part 1: Business Payment API (Accept Payments)

Integrate OraclePay to receive payments in just **2 simple steps**.

## 🚀 Step 1: Create a Payment Link
When a user clicks "Pay", send a request to our API to get a unique payment link.

**Required Header:**
`X-Opay-Business-Token: YOUR_BUSINESS_API_TOKEN`

**Request:**
`POST https://api.oraclepay.org/api/opay-business/generate-payment-page`

```javascript
// Node.js (Axios) Example
const axios = require('axios');

async function createPayment() {
  const response = await axios.post('https://api.oraclepay.org/api/opay-business/generate-payment-page', {
    payment_amount: 500,                       // required (Minimum 5 BDT)
    user_identity_address: 'user@example.com', // required (User ID, Email, etc.)
    callback_url: 'https://your-site.com/webhook', // required (Where we send the webhook)
    success_redirect_url: 'https://your-site.com/success', // required (Where user goes after paying)
    checkout_items: {                          // optional (Custom JSON data)
      product: "Premium Subscription",
      qty: 1,
      address: "Dhaka, Bangladesh"
    },
    invoice_number: 'INV-12345'                // optional (Your system's order ID)
  }, {
    headers: { 'X-Opay-Business-Token': 'YOUR_BUSINESS_API_TOKEN' }
  });

  if (response.data.success) {
    // Redirect user to this URL to pay
    console.log('Redirect User To:', response.data.payment_page_url);
  }
}
```

### 1.1 Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `payment_amount` | `number` | **Yes** | The amount you want to charge. Must be at least **5**. |
| `user_identity_address` | `string` | **Yes** | Your user's unique identifier. Helps you track who made the payment. |
| `callback_url` | `string` | **Yes** | A valid secure URL (https) on your server. We will send a `POST` webhook here. |
| `success_redirect_url` | `string` | **Yes** | Where should we redirect the user after they successfully pay? |
| `checkout_items` | `object` | No | Optional JSON object to pass **any extra info**. We return this back in the webhook. |
| `invoice_number` | `string` | No | Your system's Invoice ID or Order ID. We return this back in the webhook. |

---

## 🚀 Step 2: Receive Payment Notification (Webhook)
When the payment is successfully processed, our server will instantly send an HTTP `POST` request to the `callback_url` you provided.

**We will send you this exact JSON format in the body:**
```json
{
  "status": "COMPLETED",
  "invoice_number": "INV-12345",
  "amount": 500,
  "transaction_id": "8K2H3AB", 
  "session_code": "60df****f6",
  "user_identity": "user@example.com",
  "checkout_items": {
    "product": "Premium Subscription",
    "qty": 1,
    "address": "Dhaka, Bangladesh"
  },
  "footprint": "https://secure.oraclepay.org/payment/60df****f6/mask/footprint",
  "bank": "bkash"
}
```

### 2.1 Webhook Payload Fields Explained
| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | The status of the transaction. Look for **"COMPLETED"**. |
| `transaction_id` | `string` | The unique Transaction ID (TrxID) provided by the wallet (e.g., bKash/Nagad TrxID). |
| `session_code` | `string` | The unique OraclePay session code generated for this payment. |
| `amount` | `number` | The actual amount received. |
| `bank` | `string` | The payment method used by the user (`bkash`, `nagad`, `rocket`, `upay`). |
| `footprint` | `string` | A detailed video-like security record of the user's interactions on the payment page. |
| `user_identity` | `string` | The exact `user_identity_address` you passed in step 1. |
| `checkout_items` | `object` | The exact `checkout_items` JSON object you passed in step 1. |
| `invoice_number` | `string` | The exact `invoice_number` you passed in step 1. |

**How you should handle it (Node.js/Express Example):**
```javascript
app.post('/api/payment/callback', (req, res) => {
  const data = req.body;
  
  if (data.status === 'COMPLETED') {
     console.log(`Payment Received: ${data.amount} via ${data.bank}`);
     // TODO: Find order by data.invoice_number or data.user_identity
     // TODO: Mark the order/user as PAID in your database
  }

  // VERY IMPORTANT: Always reply with 200 OK so we know you received it
  res.status(200).send('OK'); 
});
```

---
<br/><br/>

# Part 2: Auto Withdrawal API (Send Money)

Automate cashouts, vendor payouts, or user withdrawals. You request a withdrawal, and our decentralized Wallet Agents instantly execute the transfer to your target user.

## 🚀 Step 1: Request an Auto Withdrawal

**Required Header:**
`X-Opay-Business-Token: YOUR_BUSINESS_API_TOKEN`

**Request:**
`POST https://api.oraclepay.org/api/opay-business/auto-withdraw`

```javascript
// Node.js (Axios) Example
const axios = require('axios');

async function createWithdrawal() {
  const response = await axios.post('https://api.oraclepay.org/api/opay-business/auto-withdraw', {
    amount: 1000, 
    payment_method: 'bkash',
    user_identity_address: '017XXXXXXXX', // Target Account Number
    account_number: '017XXXXXXXX',        // Target Account Number (Required)
    callback_url: 'https://your-server.com/auto-withdraw-webhook', // required (Where we send completion data)
    checkout_items: [                       // optional array for extra references
      { "userId": "9992" },
      { "withdrawal_type": "affiliate" }
    ]
  }, {
    headers: { 'X-Opay-Business-Token': 'YOUR_BUSINESS_API_TOKEN' }
  });

  if (response.data.success) {
    console.log('Withdrawal Requested:', response.data.data._id);
  }
}
```

### 1.1 Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `amount` | `number` | **Yes** | The amount you want to send. Automatically deducted from your available balance. |
| `payment_method` | `string` | **Yes** | The receiving wallet type (e.g. `bkash`, `nagad`, `rocket`, `upay`). |
| `user_identity_address` | `string` | **Yes** | The target Mobile Banking Account Number where the money should be sent. |
| `account_number` | `string` | **Yes** | The target Mobile Banking Account Number (used by agents for processing). |
| `callback_url` | `string` | **Yes** | A secure URL (https). We will send a `POST` webhook here when an agent confirms the transfer. |
| `checkout_items` | `array` | No | Optional array containing any custom JSON objects (e.g., user ids, labels). |

---

## 🚀 Step 2: Receive Auto Withdrawal Notifications (Webhooks)
There are **two** events that trigger a webhook to your `callback_url`:
1. **PROCESSING (Booked):** A Wallet Agent has started processing your request.
2. **COMPLETED (Success):** The Wallet Agent has successfully transferred the money.

### 2.1 When an Agent Books (Starts Processing)
```json
{
  "status": "PROCESSING",
  "withdrawal_id": "64d0b1a2f1c8e9...",
  "amount": 1000,
  "payment_method": "bkash",
  "user_identity_address": "017XXXXXXXX",
  "checkout_items": [
    { "userId": "9992" },
    { "withdrawal_type": "affiliate" }
  ]
}
```

### 2.2 When an Agent Completes (Success)
**We will send you this exact JSON format in the body:**
```json
{
  "status": "COMPLETED",
  "withdrawal_id": "64d0b1a2f1c8e9...",
  "amount": 1000,
  "payment_method": "bkash",
  "user_identity_address": "017XXXXXXXX",
  "account_number": "017XXXXXXXX",
  "checkout_items": [
    { "userId": "9992" },
    { "withdrawal_type": "affiliate" }
  ],
  "proof_images": [
    "https://api.oraclepay.org/uploads/proofs/1690001234-proof1.png",
    "https://api.oraclepay.org/uploads/proofs/1690001234-proof2.png"
  ],
  "date_and_time": "2023-08-04T12:00:00Z"
}
```

### 2.1 Webhook Payload Fields Explained
| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | Will be **"COMPLETED"** when successful. |
| `withdrawal_id` | `string` | Our internal database ID for this specific withdrawal request. |
| `amount` | `number` | The amount that was successfully transferred. |
| `payment_method` | `string` | The method used (e.g., `bkash`). |
| `user_identity_address` | `string` | The exact `user_identity_address` you passed in step 1. |
| `account_number` | `string` | The exact `account_number` you passed in step 1. |
| `checkout_items` | `array` | The exact array of custom objects you passed in step 1. |
| `proof_images` | `array of strings` | URLs to screenshot proofs uploaded by the Wallet Agent verifying the successful transfer. |
| `date_and_time` | `string` | The ISO timestamp of when the transfer was completed. |

**How you should handle it (Node.js/Express Example):**
```javascript
app.post('/api/withdraw-webhook', (req, res) => {
  const data = req.body;
  
  if (data.status === 'COMPLETED') {
     console.log(`Withdrawal of ${data.amount} to ${data.account_number} is complete!`);
     console.log(`Proof URLs:`, data.proof_images);
     
     // TODO: Parse your checkout_items to find the specific user
     // TODO: Update the user's withdrawal status to "SUCCESS" in your DB
  }

  // VERY IMPORTANT: Always reply with 200 OK so we know you received it
  res.status(200).send('OK'); 
});
```

---

## 🚀 Step 3: Cancel a Pending Auto Withdrawal (Optional)
If a request is still **pending** (not yet booked by an agent), you can cancel it programmatically. 

**Required Header:**
`X-Opay-Business-Token: YOUR_BUSINESS_API_TOKEN`

**Request:**
`POST https://api.oraclepay.org/api/opay-business/auto-withdraw/cancel`

```javascript
// Node.js (Axios) Example
const axios = require('axios');

async function cancelWithdrawal(withdrawalId) {
  try {
    const response = await axios.post('https://api.oraclepay.org/api/opay-business/auto-withdraw/cancel', {
      withdrawal_id: withdrawalId // The ID returned when you created it
    }, {
      headers: { 'X-Opay-Business-Token': 'YOUR_BUSINESS_API_TOKEN' }
    });

    if (response.data.success) {
      console.log('Withdrawal Cancelled successfully!');
    }
  } catch (error) {
    console.error('Failed to cancel:', error.response?.data?.message);
  }
}
```

### 3.1 Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `withdrawal_id` | `string` | **Yes** | The database ID of the pending withdrawal. |

> **Note:** If an agent has already booked the request (status is `PROCESSING`), you cannot cancel it anymore. It will return a `400 Bad Request` error.
