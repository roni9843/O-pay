import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2, CreditCard, ArrowRight, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';

export default function PaymentTest() {
    const { user } = useAuthStore();
    const [amount, setAmount] = useState('');
    // const [customerNumber, setCustomerNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleTestPayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            // Note: In a real scenario, this request should be made from the backend to avoid exposing secrets if this was a client-side app,
            // but since this is a protected dashboard for the merchant themselves, using their token here for testing is acceptable.
            const origin = window.location.origin;
            const response = await api.post('/opay-business/generate-payment-page', {
                payment_amount: Number(amount),
                user_identity_address: user?.email || 'test-user@opay.org', // Default to merchant email
                callback_url: `${origin}/payment-test/callback`, // Mock/Local callback
                success_redirect_url: `${origin}/payment-test/success`,
                invoice_number: `TEST-${Date.now()}`,
                checkout_items: {
                    type: "Test Payment",
                    initiator: "Merchant Dashboard"
                }
            }, {
                headers: {
                    'X-Opay-Business-Token': user?.apiToken
                }
            });

            if (response.data.success && response.data.payment_page_url) {
                // Auto-redirect to the payment page
                window.location.href = response.data.payment_page_url;
            } else {
                setError(response.data.message || 'Payment generation failed');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-brand-primary">Payment Test</h1>
                <p className="text-slate-600">Simulate a payment request using your API credentials.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Test Form */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm h-fit">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-brand-accent" />
                        Initiate Payment
                    </h2>

                    <form onSubmit={handleTestPayment} className="space-y-5">

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Amount (BDT)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val <= 25000) setAmount(e.target.value);
                                }}
                                placeholder="e.g. 100"
                                min="10"
                                max="25000"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-mono"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !user?.apiToken}
                            className="w-full py-3.5 bg-brand-accent text-white rounded-xl font-bold hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay Test <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </form>
                </div>

                {/* Response / Result Area */}
                <div className="space-y-6">
                    {/* Instructions */}
                    {!result && !error && (
                        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-slate-600">
                            <h3 className="font-bold text-slate-800 mb-2">How it works</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>Enter a customer identifier (phone or email).</li>
                                <li>Enter an amount to charge.</li>
                                <li>Click "Pay Test" to call the API.</li>
                                <li>You will receive a payment link if successful.</li>
                            </ul>
                            <div className="mt-6 pt-6 border-t border-slate-200">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Your API Token</span>
                                <div className="mt-1 font-mono text-xs bg-white p-2 rounded border border-slate-200 break-all text-slate-500">
                                    {user?.apiToken || 'No token found'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 rounded-3xl p-8 border border-red-100 animate-in slide-in-from-right">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-red-900 mb-1">Request Failed</h3>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success State */}
                    {result && (
                        <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 animate-in slide-in-from-right">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                                    <CheckCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-emerald-900 mb-1">Payment Created</h3>
                                    <p className="text-sm text-emerald-700">The payment page was generated successfully.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Payment URL</label>
                                    <a
                                        href={result.payment_page_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1 block w-full p-3 bg-white rounded-xl border border-emerald-200 text-emerald-600 font-mono text-sm break-all hover:border-emerald-400 hover:shadow-sm transition-all flex items-center justify-between group"
                                    >
                                        <span className="truncate">{result.payment_page_url}</span>
                                        <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-50 group-hover:opacity-100" />
                                    </a>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white/50 rounded-lg border border-emerald-100">
                                        <span className="block text-xs text-emerald-600/70 mb-1">Amount</span>
                                        <span className="font-bold text-emerald-900">{amount} BDT</span>
                                    </div>
                                    <div className="p-3 bg-white/50 rounded-lg border border-emerald-100">
                                        <span className="block text-xs text-emerald-600/70 mb-1">Status</span>
                                        <span className="font-bold text-emerald-900">PENDING</span>
                                    </div>
                                </div>

                                <div className="pt-4 mt-4 border-t border-emerald-200/50">
                                    <p className="text-xs text-emerald-700 leading-relaxed">
                                        <strong>Next Step:</strong> Click the URL above to proceed to the payment page. In a real integration, you would redirect your user to this URL.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
