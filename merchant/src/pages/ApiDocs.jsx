import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import {
    BookOpen, Copy, CheckCheck, Play, Loader2, CheckCircle,
    AlertCircle, ChevronDown, ChevronRight, ExternalLink, Terminal, Code2, Globe
} from 'lucide-react';

const API_ROOT = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_BASE = `${API_ROOT}/opay-business`;

// ─── Code Examples ────────────────────────────────────────────────────────────
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
      "type": "Product Purchase",
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
      type: "Product Purchase",
      initiator: "My Store"
    }
  })
});

const data = await response.json();

if (data.success) {
  // Redirect customer to the payment page
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
    "type"      => "Product Purchase",
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

if ($response['success']) {
  header("Location: " . $response['payment_page_url']);
}
?>`,
};

const successResponseExample = `{
  "success": true,
  "payment_page_url": "https://pay.opay.com/checkout/abc123xyz",
  "invoice_number": "INV-001",
  "amount": 500,
  "currency": "BDT"
}`;

const errorResponseExample = `{
  "success": false,
  "message": "Invalid or missing API token",
  "code": 401
}`;

// ─── Small Copy Button ─────────────────────────────────────────────────────────
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

// ─── Code Block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
    return (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{lang}</span>
                <CopyButton text={code} />
            </div>
            <pre className="p-5 text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre">
                {code}
            </pre>
        </div>
    );
}

// ─── Params Table ─────────────────────────────────────────────────────────────
const params = [
    { name: 'payment_amount', type: 'number', required: true, desc: 'Payment amount in BDT (min: 10, max: 25,000)' },
    { name: 'user_identity_address', type: 'string', required: true, desc: 'Customer email or phone number' },
    { name: 'callback_url', type: 'string', required: true, desc: 'Your server URL to receive payment status (POST webhook)' },
    { name: 'success_redirect_url', type: 'string', required: true, desc: 'URL to redirect customer after successful payment' },
    { name: 'invoice_number', type: 'string', required: true, desc: 'Your unique invoice/order ID' },
    { name: 'checkout_items', type: 'object', required: false, desc: 'Optional metadata about the order (type, initiator, etc.)' },
];

// ─── Section Component (must be OUTSIDE ApiDocs to avoid remount on every render) ──
function Section({ sectionKey, title, children, expanded, onToggle }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={() => onToggle(sectionKey)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/50 transition-colors"
            >
                <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                {expanded
                    ? <ChevronDown className="w-5 h-5 text-slate-400" />
                    : <ChevronRight className="w-5 h-5 text-slate-400" />
                }
            </button>
            {expanded && (
                <div className="px-6 pb-6">{children}</div>
            )}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ApiDocs() {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('curl');
    const [expandSection, setExpandSection] = useState({ params: true, codes: true, response: true, test: true, guide: false, webhook: false });
    const [mdContent, setMdContent] = useState('');
    const [loadingMd, setLoadingMd] = useState(true);

    useEffect(() => {
        axios.get('https://api.oraclepay.org/uploads/api_business_docs.md')
            .then(res => {
                setMdContent(res.data);
                setLoadingMd(false);
            })
            .catch(() => setLoadingMd(false));
    }, []);

    // Live Test State
    const [testAmount, setTestAmount] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [testError, setTestError] = useState('');

    const toggleSection = (key) => setExpandSection(prev => ({ ...prev, [key]: !prev[key] }));

    const handleLiveTest = async (e) => {
        e.preventDefault();
        setTestLoading(true);
        setTestError('');
        setTestResult(null);
        try {
            const response = await axios.post(`${API_BASE}/generate-payment-page`, {
                payment_amount: Number(testAmount),
                user_identity_address: testEmail || user?.email,
                callback_url: `${window.location.origin}/payment/callback`,
                success_redirect_url: `${window.location.origin}/payment/success`,
                invoice_number: `API-TEST-${Date.now()}`,
                checkout_items: { type: 'API Docs Test', initiator: 'Merchant Dashboard' }
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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Header */}
            <header>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-violet-100 rounded-xl">
                        <BookOpen className="w-6 h-6 text-violet-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-brand-primary">API Documentation</h1>
                </div>
                <p className="text-slate-500 ml-[52px]">
                    Payment link generate করার জন্য Opay Business API integration guide।
                </p>
            </header>

            {/* Video Tutorial */}
            <div className="rounded-[2.5rem] border border-slate-200 overflow-hidden bg-white shadow-xl shadow-slate-200/50 mb-8 group transition-all hover:shadow-2xl hover:shadow-violet-200/40">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-slate-50">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
                            <div className="p-1.5 bg-violet-500 rounded-lg group-hover:scale-110 transition-transform">
                                <Play className="w-4 h-4 text-white fill-current" />
                            </div>
                            Integration Video Tutorial
                        </h2>
                        <p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-[0.2em] ml-10">
                            Watch this guide to integrate Opay Business API in 2 minutes.
                        </p>
                    </div>
                </div>
                <div className="aspect-video bg-slate-900 relative">
                    <video
                        className="w-full h-full"
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        src="https://api.oraclepay.org/uploads/OPAY_API_BUSINESS_DOCS_VIDEO.mp4"
                    />
                </div>
            </div>

            {/* Official Guide (from MD) */}
            <Section
                sectionKey="guide"
                title="📖 Full Integration Guide"
                expanded={expandSection.guide}
                onToggle={toggleSection}
            >
                {loadingMd ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                    </div>
                ) : (
                    <div className="prose prose-slate max-w-none">
                        <div className="p-8 bg-[#0a0a0f] rounded-[2rem] border border-white/5 font-mono text-[13px] text-sky-200/80 whitespace-pre-wrap leading-relaxed shadow-2xl">
                            <div className="flex items-center gap-2 mb-6 p-2.5 bg-white/5 rounded-xl w-fit border border-white/5">
                                <div className="p-1 bg-violet-500/20 rounded shadow-inner">
                                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Official MD Repository Document</span>
                            </div>
                            {mdContent}
                        </div>
                    </div>
                )}
            </Section>

            {/* Endpoint Info */}
            <div className="bg-gradient-to-r from-violet-600 to-brand-primary rounded-3xl p-6 text-white shadow-md">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-bold font-mono tracking-wide">POST</span>
                        <code className="text-sm font-mono text-white/90 break-all">
                            {API_BASE}/generate-payment-page
                        </code>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-white/80">
                        <span className="font-bold text-white/60 flex-shrink-0">Auth Header:</span>
                        <code className="font-mono text-white/90">X-Opay-Business-Token: YOUR_API_TOKEN</code>
                    </div>
                    {user?.apiToken && (
                        <div className="mt-2 p-3 bg-white/10 rounded-xl border border-white/10 flex items-start gap-2">
                            <span className="text-xs text-white/60 flex-shrink-0 pt-0.5 font-bold uppercase tracking-wider">Your Token:</span>
                            <code className="text-xs font-mono text-emerald-300 break-all">{user.apiToken}</code>
                        </div>
                    )}
                </div>
            </div>

            {/* Request Parameters */}
            <Section sectionKey="params" title="📋 Request Parameters" expanded={expandSection.params} onToggle={toggleSection}>
                <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Parameter</th>
                                <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Type</th>
                                <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Required</th>
                                <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {params.map(p => (
                                <tr key={p.name} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 px-3">
                                        <code className="text-violet-700 font-mono text-xs bg-violet-50 px-2 py-0.5 rounded-md">{p.name}</code>
                                    </td>
                                    <td className="py-3 px-3">
                                        <span className="text-blue-600 font-mono text-xs">{p.type}</span>
                                    </td>
                                    <td className="py-3 px-3">
                                        {p.required
                                            ? <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full uppercase">Required</span>
                                            : <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase">Optional</span>
                                        }
                                    </td>
                                    <td className="py-3 px-3 text-slate-600 text-xs leading-relaxed">{p.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* Code Examples */}
            <Section sectionKey="codes" title="💻 Code Examples" expanded={expandSection.codes} onToggle={toggleSection}>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.key
                                    ? 'bg-white text-brand-primary shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <CodeBlock
                    code={codeExamples[activeTab](user?.apiToken)}
                    lang={tabs.find(t => t.key === activeTab)?.label}
                />
            </Section>

            {/* Response Structure */}
            <Section sectionKey="response" title="📨 Response Structure" expanded={expandSection.response} onToggle={toggleSection}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-700">Success Response</span>
                        </div>
                        <CodeBlock code={successResponseExample} lang="JSON" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            <span className="text-sm font-bold text-rose-700">Error Response</span>
                        </div>
                        <CodeBlock code={errorResponseExample} lang="JSON" />
                    </div>
                </div>
                <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
                    <strong>⚡ Integration Tip:</strong> সফল response-এ <code className="font-mono bg-amber-100 px-1 rounded">payment_page_url</code> পেলে তোমার customer কে ওই URL-এ redirect করো।
                </div>
            </Section>

            {/* Webhook Section */}
            <Section sectionKey="webhook" title="🔗 Webhook (Asynchronous Notifications)" expanded={expandSection.webhook} onToggle={toggleSection}>
                <div className="space-y-6">
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Payment সফল হওয়ার সাথে সাথে আমাদের সার্ভার থেকে তোমার <code className="font-mono bg-slate-100 px-1 rounded">callback_url</code>-এ একটি <span className="font-bold text-slate-800">POST</span> request পাঠানো হবে। নিচের ডাটাগুলো Webhook-এ পাওয়া যাবে:
                    </p>

                    <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Field</th>
                                    <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Type</th>
                                    <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {[
                                    { name: 'status', type: 'string', desc: 'পেমেন্ট স্ট্যাটাস (COMPLETED)' },
                                    { name: 'amount', type: 'number', desc: 'সফলভাবে রিসিভ হওয়া টাকার পরিমাণ' },
                                    { name: 'transaction_id', type: 'string', desc: 'মোবাইল ওয়ালেটের আসল TrxID' },
                                    { name: 'invoice_number', type: 'string', desc: 'তোমার পাঠানো অরিজিনাল Invoice ID' },
                                    { name: 'session_code', type: 'string', desc: 'OraclePay সিস্টেমের ইউনিক সেশন কোড' },
                                    { name: 'bank', type: 'string', desc: 'পেমেন্ট মেথড (যেমন: bkash, nagad, rocket)' },
                                    { name: 'footprint', type: 'string', desc: 'সিকিউরিটি প্রুফ লিঙ্ক (ভিডিও ক্যাপচার)' },
                                ].map(f => (
                                    <tr key={f.name} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 px-3 font-mono text-xs font-bold text-violet-700">{f.name}</td>
                                        <td className="py-3 px-3 font-mono text-xs text-blue-600">{f.type}</td>
                                        <td className="py-3 px-3 text-xs text-slate-600">{f.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Webhook JSON Example</p>
                            <CodeBlock
                                lang="JSON"
                                code={`{
  "status": "COMPLETED",
  "invoice_number": "OR-99238",
  "amount": 500,
  "transaction_id": "9B0K21XL",
  "session_code": "65b2...f9a",
  "bank": "bkash",
  "footprint": "https://secure.oraclepay.org/p/65b2...f9a/mask"
}`}
                            />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Example Webhook Handling (Node.js)</p>
                            <CodeBlock
                                lang="JavaScript"
                                code={`app.post('/api/payment/callback', (req, res) => {
  const data = req.body; // রিকোয়েস্ট বডি পার্স করুন
  
  if (data.status === 'COMPLETED') {
     console.log(\`Received \${data.amount} BDT via \${data.bank}\`);
     // গুরুত্বপূর্ণ: এখানে তোমার ডাটাবেজে স্ট্যাটাস আপডেট করো
  }

  res.status(200).send('OK'); 
});`}
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl text-[11px] text-violet-700">
                        <strong>💡 ওরালকপে টিপস:</strong> Webhook সব সময় <code className="font-mono bg-violet-100 px-1 rounded">POST</code> রিকোয়েস্ট হিসেবে পাঠানো হবে এবং এর <code className="font-mono bg-violet-100 px-1 rounded">Content-Type</code> হবে <code className="font-mono bg-violet-100 px-1 rounded">application/json</code>।
                    </div>
                </div>
            </Section>

            {/* Live Test */}
            <Section sectionKey="test" title="🧪 Live API Test" expanded={expandSection.test} onToggle={toggleSection}>
                <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
                    তোমার real API token দিয়ে এখানে সরাসরি test করো — redirect হবে না, শুধু API response এবং Webhook workflow দেখতে পাবে।
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Test Form */}
                    <div className="space-y-6">
                        <form onSubmit={handleLiveTest} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Code2 className="w-4 h-4 text-brand-primary" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Request Configuration</span>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Payment Amount (BDT)</label>
                                <input
                                    type="number"
                                    value={testAmount}
                                    onChange={e => setTestAmount(e.target.value)}
                                    placeholder="e.g. 500"
                                    min="10" max="25000" required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-mono text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    Customer Identity
                                    <span className="ml-2 font-normal text-slate-400 text-xs">(email or phone)</span>
                                </label>
                                <input
                                    type="text"
                                    value={testEmail}
                                    onChange={e => setTestEmail(e.target.value)}
                                    placeholder={user?.email || 'customer@example.com'}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-sm bg-white"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={testLoading || !user?.apiToken}
                                className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black text-sm hover:bg-violet-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-200"
                            >
                                {testLoading
                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Fetching Response...</>
                                    : <><Play className="w-5 h-5 fill-current" /> Execute API Call</>
                                }
                            </button>
                            {!user?.apiToken && (
                                <p className="text-[10px] text-rose-500 text-center font-bold uppercase tracking-wider">KYC verified নয়, তাই API Token পাওয়া যায়নি।</p>
                            )}
                        </form>

                        {/* Request Summary (Appears after test) */}
                        {(testResult || testError) && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Outgoing Request Data</span>
                                </div>
                                <CodeBlock
                                    lang="JSON (Request Payload)"
                                    code={JSON.stringify({
                                        payment_amount: Number(testAmount),
                                        user_identity_address: testEmail || user?.email,
                                        callback_url: `${window.location.origin}/payment/callback`,
                                        success_redirect_url: `${window.location.origin}/payment/success`,
                                        invoice_number: `API-TEST-${Date.now()}`,
                                        checkout_items: { type: 'API Docs Test' }
                                    }, null, 2)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Result Area */}
                    <div className="space-y-6">
                        {!testResult && !testError && (
                            <div className="h-full min-h-[400px] rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 gap-4 bg-slate-50/30">
                                <div className="p-4 bg-white rounded-full shadow-sm">
                                    <Play className="w-10 h-10 opacity-20 text-violet-600" />
                                </div>
                                <div className="text-center">
                                    <span className="text-sm font-bold block mb-1 text-slate-400">Awaiting Interaction</span>
                                    <p className="text-[10px] uppercase tracking-widest font-black opacity-60">Response will appear here</p>
                                </div>
                            </div>
                        )}

                        {testError && (
                            <div className="p-6 bg-rose-50 border border-rose-100 rounded-[2rem] space-y-4 animate-in zoom-in-95">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-500 rounded-xl">
                                        <AlertCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="font-black text-rose-900 tracking-tight">API Execution Failed</span>
                                </div>
                                <p className="text-xs text-rose-700 font-medium leading-relaxed">{testError}</p>
                                <CodeBlock code={`{ "success": false, "message": "${testError}" }`} lang="JSON Response" />
                            </div>
                        )}

                        {testResult && (
                            <div className="space-y-6 animate-in zoom-in-95">
                                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-200">
                                            <CheckCircle className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <span className="font-black text-emerald-900 tracking-tight block">Success! URL Generated</span>
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">HTTP 200 OK</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-emerald-700/50 uppercase tracking-widest ml-1">Payment Checkout URL</p>
                                        <a
                                            href={testResult.payment_page_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-emerald-200 text-emerald-700 text-xs font-mono break-all hover:border-emerald-500 transition-all group shadow-sm"
                                        >
                                            <span className="truncate">{testResult.payment_page_url}</span>
                                            <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all text-emerald-600" />
                                        </a>
                                    </div>

                                    <CodeBlock
                                        code={JSON.stringify(testResult, null, 2)}
                                        lang="Full API Response"
                                    />
                                </div>

                                {/* Flow Simulation */}
                                <div className="p-6 bg-violet-50/50 border border-violet-100 rounded-[2.5rem] space-y-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <Globe className="w-20 h-20 text-violet-600" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-violet-600 rounded-xl shadow-lg shadow-violet-200">
                                            <Terminal className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <span className="font-black text-violet-900 tracking-tight block">Expected Webhook Workflow</span>
                                            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Next Step in Lifecycle</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-violet-700 font-medium leading-relaxed">
                                        যখন কাস্টমার পেমেন্ট সম্পন্ন করবে, আমাদের সার্ভার নিচের মত একটি <span className="font-black">POST</span> রিকোয়েস্ট তোমার <span className="font-black underline italic">callback_url</span>-এ পাঠাবে:
                                    </p>
                                    <CodeBlock
                                        lang="Simulated Success Webhook"
                                        code={JSON.stringify({
                                            status: "COMPLETED",
                                            amount: Number(testAmount),
                                            transaction_id: "T240319" + Math.random().toString(36).substring(7).toUpperCase(),
                                            invoice_number: `API-TEST-XXX`,
                                            session_code: "OPX_" + Math.random().toString(36).substring(4).toUpperCase(),
                                            bank: "bkash",
                                            footprint: "https://secure.oraclepay.org/proof/test"
                                        }, null, 2)}
                                    />
                                    <div className="flex items-start gap-2 text-[10px] text-violet-400 font-bold uppercase tracking-wider bg-white/50 p-3 rounded-xl">
                                        <span className="flex-shrink-0 mt-0.5">⚠️</span>
                                        <span>এই ডাটাটি তোমার ডাটাবেজে রেকর্ড আপডেট করতে এবং কাস্টমারকে সার্ভিস প্রদান করতে ব্যবহার করো।</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Section>
        </div>
    );
}
