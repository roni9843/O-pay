import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import {
  Wallet, Copy, CheckCheck, Play, Loader2, CheckCircle,
  AlertCircle, ChevronDown, ChevronRight, ExternalLink, Terminal, Code2, Globe, ArrowUpRight, Zap, ShieldCheck
} from 'lucide-react';

const API_ROOT = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_BASE = `${API_ROOT}/opay-business`;

const codeExamples = {
  curl: (token) => `curl -X POST "${API_BASE}/auto-withdraw" \\
  -H "Content-Type: application/json" \\
  -H "X-Opay-Business-Token: ${token || 'YOUR_BUSINESS_API_TOKEN'}" \\
  -d '{
    "amount": 1000,
    "payment_method": "bkash",
    "user_identity_address": "017XXXXXXXX",
    "account_number": "017XXXXXXXX",
    "callback_url": "https://your-server.com/auto-withdraw-webhook",
    "checkout_items": [
      { "userId": "9992" },
      { "withdrawal_type": "affiliate" }
    ]
  }'`,

  javascript: (token) => `const axios = require('axios');

async function createWithdrawal() {
  const response = await axios.post('${API_BASE}/auto-withdraw', {
    amount: 1000,
    payment_method: 'bkash',
    user_identity_address: '017XXXXXXXX',
    account_number: '017XXXXXXXX',
    callback_url: 'https://your-server.com/auto-withdraw-webhook',
    checkout_items: [
      { userId: "9992" },
      { withdrawal_type: "affiliate" }
    ]
  }, {
    headers: { 'X-Opay-Business-Token': '${token || 'YOUR_BUSINESS_API_TOKEN'}' }
  });

  if (response.data.success) {
    console.log('Withdrawal Requested ID:', response.data.data.withdrawal_id);
  }
}`,

  php: (token) => `<?php
$token = "${token || 'YOUR_BUSINESS_API_TOKEN'}";
$url   = "${API_BASE}/auto-withdraw";

$payload = json_encode([
  "amount"                => 1000,
  "payment_method"        => "bkash",
  "user_identity_address" => "017XXXXXXXX",
  "account_number"        => "017XXXXXXXX",
  "callback_url"          => "https://your-server.com/auto-withdraw-webhook",
  "checkout_items"        => [
    ["userId" => "9992"],
    ["withdrawal_type" => "affiliate"]
  ]
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => $payload,
  CURLOPT_HTTPHEADER     => [
    "Content-Type: application/json",
    "X-Opay-Business-Token: $token"
  ]
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);
print_r($response);
?>`,
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700/60 hover:bg-slate-600/80 text-slate-200 transition-all"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code, lang }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900 shadow-xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-5 text-xs sm:text-sm font-mono text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

const params = [
  { name: 'amount', type: 'number', required: true, desc: 'উইথড্রয়াল বা পেআউটের টাকার পরিমাণ (BDT)।' },
  { name: 'payment_method', type: 'string', required: true, desc: 'মোবাইল ওয়ালেট মেথড ("bkash", "nagad", "rocket", "upay")' },
  { name: 'user_identity_address', type: 'string', required: true, desc: 'প্রাপকের ওয়ালেট নম্বর (যেমন: 017XXXXXXXX)' },
  { name: 'account_number', type: 'string', required: true, desc: 'প্রাপকের মোবাইল ব্যাংকিং নম্বর (এজেন্ট প্রসেসিংয়ের জন্য)' },
  { name: 'callback_url', type: 'string', required: true, desc: 'পেআউট Booked, Completed বা Rejected হলে Webhook পাওয়ার HTTPS URL' },
  { name: 'checkout_items', type: 'array', required: false, desc: 'আপনার সিস্টেমে ট্র্যাকিংয়ের কাস্টম অবজেক্ট অ্যারে (User ID, Type ইত্যাদি)' },
];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/50 transition-colors"
      >
        <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
          {title}
        </h2>
        {open ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6 space-y-4">{children}</div>}
    </div>
  );
}

export default function AutoWithdrawalDocs() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('curl');

  // Live Test State
  const [testAmount, setTestAmount] = useState('100');
  const [testMethod, setTestMethod] = useState('bkash');
  const [testNumber, setTestNumber] = useState('01700000000');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const handleLiveTest = async (e) => {
    e.preventDefault();
    setTestLoading(true);
    setTestError('');
    setTestResult(null);
    try {
      const response = await axios.post(`${API_BASE}/auto-withdraw`, {
        amount: Number(testAmount),
        payment_method: testMethod,
        user_identity_address: testNumber,
        account_number: testNumber,
        callback_url: `https://webhook.cool/auto-withdraw-test`,
        checkout_items: [
          { userId: "TEST_999" },
          { withdrawal_type: "test" }
        ]
      }, {
        headers: { 'X-Opay-Business-Token': user?.apiToken }
      });

      if (response.data.success) {
        setTestResult(response.data);
      } else {
        setTestError(response.data.message || 'Request failed');
      }
    } catch (err) {
      setTestError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setTestLoading(false);
    }
  };

  const tabs = [
    { key: 'curl', label: 'cURL', icon: Terminal },
    { key: 'javascript', label: 'Node.js', icon: Code2 },
    { key: 'php', label: 'PHP', icon: Globe },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      {/* Header Banner */}
      <header className="relative bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-10 border border-emerald-900/40 shadow-2xl overflow-hidden text-white">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Auto Withdrawal & Payout API</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Auto Withdrawal API Documentation
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">
            আপনার প্ল্যাটফর্ম থেকে গ্রাহকদের অটোমেটিক পেআউট ও ক্যাশ-আউট পাঠানোর জন্য OraclePay Auto Withdrawal API গাইড।
          </p>

          {user?.apiToken && (
            <div className="pt-3">
              <div className="inline-flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Your Business API Token:</span>
                <code className="text-xs font-mono font-bold text-emerald-400">{user.apiToken}</code>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Endpoint URL Badge */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 bg-white/20 rounded-lg text-xs font-black font-mono uppercase tracking-widest">POST</span>
          <code className="text-xs sm:text-sm font-mono font-bold text-white break-all">
            {API_BASE}/auto-withdraw
          </code>
        </div>
        <p className="text-xs text-emerald-100 font-medium pt-1">
          Auth Header: <code className="bg-black/20 px-2 py-0.5 rounded font-mono">X-Opay-Business-Token: YOUR_BUSINESS_API_TOKEN</code>
        </p>
      </div>

      {/* Request Parameters */}
      <Section title="📋 Request Parameters">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Parameter</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Required</th>
                <th className="py-3 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {params.map(p => (
                <tr key={p.name} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700 bg-emerald-50/50 rounded">{p.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">{p.type}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${p.required ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                      {p.required ? 'Required' : 'Optional'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Code Examples */}
      <Section title="💻 Integration Code Examples">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <CodeBlock code={codeExamples[activeTab](user?.apiToken)} lang={tabs.find(t => t.key === activeTab)?.label} />
      </Section>

      {/* API Response Specification */}
      <Section title="📨 API Response Format (200 OK)">
        <div className="space-y-3">
          <p className="text-xs text-slate-600 font-medium">
            রিকোয়েস্ট পাঠানোর পর সিস্টেম থেকে প্রাপ্ত রেসপন্স ফরম্যাট:
          </p>
          <CodeBlock code={`{
  "success": true,
  "message": "Auto withdrawal request created",
  "data": {
    "withdrawal_id": "6a9123cc5c451c86f49e36fc",
    "merchant_id": "69764a8c6e27387edce2cfdd",
    "amount": 1000,
    "fee_percentage": 6,
    "fee_amount": 60,
    "deducted_amount": 1060,
    "payment_method": "bkash",
    "user_identity_address": "017XXXXXXXX",
    "account_number": "017XXXXXXXX",
    "callback_url": "https://your-server.com/auto-withdraw-webhook",
    "checkout_items": [
      { "userId": "9992" },
      { "withdrawal_type": "affiliate" }
    ],
    "status": "pending",
    "created_at": "2026-08-28T12:00:00.000Z"
  }
}`} lang="JSON Response" />
        </div>
      </Section>

      {/* Webhook Events & Payloads */}
      <Section title="⚡ Webhook Events & Payloads (3 Events)">
        <div className="space-y-6">
          <p className="text-xs text-slate-600 font-medium">
            আপনার দেওয়া <code className="bg-slate-100 px-2 py-1 rounded text-emerald-700 font-mono font-bold">callback_url</code>-এ মোট ৩টি ভিন্ন ইভেন্টে Webhook POST রিকোয়েস্ট পাঠানো হবে:
          </p>

          {/* Webhook 1: PROCESSING */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">Event 1</span>
              <h4 className="text-xs font-bold text-amber-700">PROCESSING (যখন কোনো এজেন্ট ক্যাশ-আউট প্রসেস করতে একসেপ্ট করে)</h4>
            </div>
            <CodeBlock code={`{
  "status": "PROCESSING",
  "withdrawal_id": "6a9123cc5c451c86f49e36fc",
  "amount": 1000,
  "payment_method": "bkash",
  "user_identity_address": "017XXXXXXXX",
  "account_number": "017XXXXXXXX",
  "checkout_items": [
    { "userId": "9992" },
    { "withdrawal_type": "affiliate" }
  ]
}`} lang="JSON Webhook (PROCESSING)" />
          </div>

          {/* Webhook 2: COMPLETED */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">Event 2</span>
              <h4 className="text-xs font-bold text-emerald-700">COMPLETED (যখন সফলভাবে ক্যাশ-আউট প্রসেস সম্পন্ন হয় এবং প্রুফ জমা পড়ে)</h4>
            </div>
            <CodeBlock code={`{
  "status": "COMPLETED",
  "withdrawal_id": "6a9123cc5c451c86f49e36fc",
  "date_and_time": "2026-08-28T12:05:00.000Z",
  "amount": 1000,
  "payment_method": "bkash",
  "user_identity_address": "017XXXXXXXX",
  "account_number": "017XXXXXXXX",
  "checkout_items": [
    { "userId": "9992" },
    { "withdrawal_type": "affiliate" }
  ],
  "proof_images": [
    "http://api.oraclepay.org/uploads/proof-16900012.png"
  ]
}`} lang="JSON Webhook (COMPLETED)" />
          </div>

          {/* Webhook 3: REJECTED */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">Event 3</span>
              <h4 className="text-xs font-bold text-rose-700">REJECTED (যখন রিকোয়েস্ট রিজেক্ট বা বাতিল হয় এবং ব্যালেন্স রিফান্ড হয়)</h4>
            </div>
            <CodeBlock code={`{
  "status": "REJECTED",
  "withdrawal_id": "6a9123cc5c451c86f49e36fc",
  "amount": 1000,
  "payment_method": "bkash",
  "user_identity_address": "017XXXXXXXX",
  "account_number": "017XXXXXXXX",
  "checkout_items": [
    { "userId": "9992" },
    { "withdrawal_type": "affiliate" }
  ],
  "reason": "Rejected by administrator"
}`} lang="JSON Webhook (REJECTED)" />
          </div>

          {/* Server Handler Code Example */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-indigo-600" /> Webhook Handling Example (Node.js / Express)
            </h4>
            <CodeBlock code={`app.post('/auto-withdraw-webhook', (req, res) => {
  const data = req.body;
  
  if (data.status === 'PROCESSING') {
     console.log(\`[PROCESSING] Agent has booked withdrawal ID: \${data.withdrawal_id}\`);
  } 
  else if (data.status === 'COMPLETED') {
     console.log(\`[COMPLETED] Payout of ৳\${data.amount} to \${data.account_number} was successful!\`);
     console.log(\`Proof URLs:\`, data.proof_images);
  } 
  else if (data.status === 'REJECTED') {
     console.log(\`[REJECTED] Withdrawal ID: \${data.withdrawal_id} rejected. Reason: \${data.reason}\`);
  }

  res.status(200).send('OK'); 
});`} lang="Express Webhook Handler" />
          </div>
        </div>
      </Section>
    </div>
  );
}
