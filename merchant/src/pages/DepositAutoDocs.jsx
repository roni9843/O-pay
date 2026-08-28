import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import {
  BookOpen, Copy, CheckCheck, Play, Loader2, CheckCircle,
  AlertCircle, ChevronDown, ChevronRight, ExternalLink, Terminal, Code2, Globe, CreditCard, ShieldCheck, Zap
} from 'lucide-react';

const API_ROOT = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_BASE = `${API_ROOT}/opay-business`;

// Code Examples for Deposit
const codeExamples = {
  curl: (token) => `curl -X POST "${API_BASE}/generate-payment-page" \\
  -H "Content-Type: application/json" \\
  -H "X-Opay-Business-Token: ${token || 'YOUR_API_TOKEN'}" \\
  -d '{
    "payment_amount": 500,
    "user_identity_address": "customer@example.com",
    "callback_url": "https://yourdomain.com/payment/callback",
    "success_redirect_url": "https://yourdomain.com/payment/success",
    "invoice_number": "INV-001",
    "checkout_items": {
      "type": "Deposit Payment",
      "initiator": "My Store"
    }
  }'`,

  javascript: (token) => `const response = await fetch("${API_BASE}/generate-payment-page", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Opay-Business-Token": "${token || 'YOUR_API_TOKEN'}"
  },
  body: JSON.stringify({
    payment_amount: 500,
    user_identity_address: "customer@example.com",
    callback_url: "https://yourdomain.com/payment/callback",
    success_redirect_url: "https://yourdomain.com/payment/success",
    invoice_number: "INV-001",
    checkout_items: {
      type: "Deposit Payment",
      initiator: "My Store"
    }
  })
});

const data = await response.json();

if (data.success) {
  // Redirect customer to payment gateway checkout
  window.location.href = data.payment_page_url;
}`,

  php: (token) => `<?php
$token = "${token || 'YOUR_API_TOKEN'}";
$url   = "${API_BASE}/generate-payment-page";

$payload = json_encode([
  "payment_amount"        => 500,
  "user_identity_address" => "customer@example.com",
  "callback_url"          => "https://yourdomain.com/payment/callback",
  "success_redirect_url"  => "https://yourdomain.com/payment/success",
  "invoice_number"        => "INV-001",
  "checkout_items"        => [
    "type"      => "Deposit Payment",
    "initiator" => "My Store"
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

if (!empty($response['success'])) {
  header("Location: " . $response['payment_page_url']);
  exit;
}
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
  { name: 'payment_amount', type: 'integer', required: true, desc: 'টাকার পরিমাণ (BDT) - সর্বনিম্ন ৫ টাকা (Integer, e.g. 500)' },
  { name: 'user_identity_address', type: 'string', required: true, desc: 'গ্রাহকের অনন্য পরিচয়পত্র (যেমন: ইমেইল বা ফোন নম্বর)' },
  { name: 'callback_url', type: 'string', required: true, desc: 'পেমেন্ট সম্পন্ন হলে আপনার সার্ভারে Webhook স্ট্যাটাস পাঠানোর URL (https://...)' },
  { name: 'success_redirect_url', type: 'string', required: true, desc: 'পেমেন্ট শেষে গ্রাহককে যে পেজে রিডাইরেক্ট করা হবে (বা "AUTO_SUCCESS_PAGE")' },
  { name: 'invoice_number', type: 'string', required: false, desc: 'আপনার সিস্টেমের ইউনিক ইনভয়েস বা অর্ডার নম্বর (যেমন: INV-001)' },
  { name: 'checkout_items', type: 'object', required: false, desc: 'অর্ডারের সাথে যুক্ত অতিরিক্ত অবজেক্ট/মেটাডাটা' },
  { name: 'expiry_minutes', type: 'integer', required: false, desc: 'পেমেন্ট লিংকের মেয়াদ (মিনিটে, ডিফল্ট ৩০ মিনিট)' },
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

export default function DepositAutoDocs() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('curl');

  // Live Test State
  const [testAmount, setTestAmount] = useState('500');
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const handleLiveTest = async (e) => {
    e.preventDefault();
    setTestLoading(true);
    setTestError('');
    setTestResult(null);
    try {
      const response = await axios.post(`${API_BASE}/generate-payment-page`, {
        payment_amount: Number(testAmount),
        user_identity_address: testEmail || user?.email || 'customer@example.com',
        callback_url: `${window.location.origin}/payment/callback`,
        success_redirect_url: `${window.location.origin}/payment/success`,
        invoice_number: `DEP-TEST-${Date.now()}`,
        checkout_items: { type: 'Auto Deposit Test', initiator: 'Merchant Portal' }
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
    { key: 'javascript', label: 'JavaScript', icon: Code2 },
    { key: 'php', label: 'PHP', icon: Globe },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      {/* Header Banner */}
      <header className="relative bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-10 border border-blue-900/40 shadow-2xl overflow-hidden text-white">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span>Payment Gateway & Auto Deposit API</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Auto Deposit API Documentation
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">
            আপনার ওয়েবসাইটে বিকাশ, নগদ, রকেট ইত্যাদির মাধ্যমে অটোমেটিক পেমেন্ট রিসিভ করার জন্য Opay Business API ইন্টিগ্রেশন নির্দেশিকা।
          </p>

          {user?.apiToken && (
            <div className="pt-3">
              <div className="inline-flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Your API Token:</span>
                <code className="text-xs font-mono font-bold text-emerald-400">{user.apiToken}</code>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Endpoint URL Badge */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 bg-white/20 rounded-lg text-xs font-black font-mono uppercase tracking-widest">POST</span>
          <code className="text-xs sm:text-sm font-mono font-bold text-white break-all">
            {API_BASE}/generate-payment-page
          </code>
        </div>
        <p className="text-xs text-blue-100 font-medium pt-1">
          Auth Header: <code className="bg-black/20 px-2 py-0.5 rounded font-mono">X-Opay-Business-Token: YOUR_API_TOKEN</code>
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
                  <td className="py-3 px-3 font-mono font-bold text-blue-600 bg-blue-50/50 rounded">{p.name}</td>
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
                  activeTab === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
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

      {/* Response Structure */}
      <Section title="📨 Response & Webhook Payload Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Success API Response (200 OK)
            </h4>
            <CodeBlock code={`{
  "success": true,
  "payment_page_url": "https://pay.opay.com/payment/shortCode123",
  "short_code": "shortCode123",
  "amount": 500,
  "user_identity_address": "customer@example.com",
  "callback_url": "https://yourdomain.com/payment/callback",
  "success_redirect_url": "https://yourdomain.com/payment/success",
  "invoice_number": "INV-001",
  "checkout_items": {
    "type": "Deposit Payment",
    "initiator": "My Store"
  },
  "expires_at": "2026-08-17T21:35:00.000Z"
}`} lang="JSON Response" />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Incoming Webhook Payload (POST)
            </h4>
            <CodeBlock code={`{
  "status": "COMPLETED",
  "amount": 500,
  "transaction_id": "9B0K21XL",
  "invoice_number": "INV-001",
  "session_code": "shortCode123",
  "user_identity": "customer@example.com",
  "checkout_items": {
    "type": "Deposit Payment",
    "initiator": "My Store"
  },
  "bank": "bkash",
  "footprint": "https://pay.opay.com/payment/shortCode123/mask/footprint"
}`} lang="JSON Webhook" />
          </div>
        </div>
      </Section>

      {/* Live Test */}
      <Section title="🧪 Live Deposit API Test">
        <form onSubmit={handleLiveTest} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount (BDT)</label>
            <input
              type="number"
              value={testAmount}
              onChange={e => setTestAmount(e.target.value)}
              required min="5" max="250000"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Customer Email / Identity</label>
            <input
              type="text"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={testLoading || !user?.apiToken}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
            >
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              Execute API Request
            </button>
          </div>
        </form>

        {testResult && (
          <div className="mt-4 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Payment Link Generated Successfully!
            </div>
            <a 
              href={testResult.payment_page_url} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs font-mono text-blue-600 underline block break-all"
            >
              {testResult.payment_page_url}
            </a>
          </div>
        )}

        {testError && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold">
            {testError}
          </div>
        )}
      </Section>
    </div>
  );
}
