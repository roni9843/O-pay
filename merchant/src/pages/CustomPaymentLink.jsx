import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2, Link2, Copy, Check, ArrowRight, ExternalLink, Sparkles, Globe, FileSpreadsheet, Clock, RefreshCw, AlertCircle, CheckCircle2, Eye, ChevronDown, ChevronUp, Palette, Image as ImageIcon, UploadCloud, Printer, ShieldCheck, Calendar, Receipt, DollarSign, Trash2, Ban, RefreshCcw } from 'lucide-react';
import { api, getPaymentPageHistory, uploadPaymentPageImage, deletePaymentPageHistory, expirePaymentPageHistory } from '../lib/api';

const PRESETS = [
    { id: 'emerald', name: 'Emerald Light', bg: '#ffffff', text: '#064e3b', previewBorder: 'border-emerald-200 bg-white' },
    { id: 'midnight', name: 'Midnight Dark', bg: '#0f172a', text: '#f8fafc', previewBorder: 'border-slate-800 bg-slate-900' },
    { id: 'solar', name: 'Solar Gold', bg: '#fffbeb', text: '#78350f', previewBorder: 'border-amber-200 bg-amber-50' },
    { id: 'royal', name: 'Royal Indigo', bg: '#e0e7ff', text: '#1e1b4b', previewBorder: 'border-indigo-200 bg-indigo-50' },
    { id: 'sunset', name: 'Sunset Rose', bg: '#fff1f2', text: '#881337', previewBorder: 'border-rose-200 bg-rose-50' },
    { id: 'custom', name: 'Custom Theme', bg: '#ffffff', text: '#0f172a', previewBorder: 'border-dashed border-slate-300' }
];

export default function CustomPaymentLink() {
    const { user } = useAuthStore();
    const [amount, setAmount] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [purpose, setPurpose] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [expiryMinutes, setExpiryMinutes] = useState('30');
    const [note, setNote] = useState('');
    const [notifyPhone, setNotifyPhone] = useState('');
    
    // Custom Success Page customization states
    const [showCustomize, setShowCustomize] = useState(true); // default open to make it easy to see
    const [successTitle, setSuccessTitle] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    const [selectedPreset, setSelectedPreset] = useState('emerald');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [textColor, setTextColor] = useState('#064e3b');
    const [imageUrl, setImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    const [loading, setLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState({ code: '', action: '' });
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [duplicatingFrom, setDuplicatingFrom] = useState(null); // tracks which item is being duplicated
    const formRef = useRef(null);

    // Sync preset colors
    useEffect(() => {
        const found = PRESETS.find(p => p.id === selectedPreset);
        if (found && found.id !== 'custom') {
            setBgColor(found.bg);
            setTextColor(found.text);
        }
    }, [selectedPreset]);

    const fetchHistory = useCallback(async () => {
        if (!user) return;
        setHistoryLoading(true);
        try {
            const res = await getPaymentPageHistory({ limit: 100 });
            if (res.success && res.data) {
                // Filter to show only custom payment links
                const filtered = res.data.filter(item => 
                    item.checkoutItems?.type === "Custom Payment Link"
                );
                setHistory(filtered);
            }
        } catch (e) {
            console.error("Failed to load backend history", e);
        } finally {
            setHistoryLoading(false);
        }
    }, [user]);

    // Load history on mount
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setError('');
        try {
            const res = await uploadPaymentPageImage(file);
            if (res.success && res.url) {
                // Prepend base API URL if URL is relative
                const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                const baseHost = API_BASE.replace('/api', '');
                setImageUrl(`${baseHost}${res.url}`);
            } else {
                setError('Failed to upload logo.');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Image upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateLink = async (e) => {
        e.preventDefault();
        if (!user?.apiToken) {
            setError('Your API Token is not available. Please complete KYC.');
            return;
        }

        setLoading(true);
        setError('');
        setGeneratedLink('');
        setCopied(false);

        try {
            const origin = window.location.origin;
            const finalInvoice = invoiceNumber.trim() || `INV-${Date.now()}`;
            const response = await api.post('/opay-business/generate-payment-page', {
                payment_amount: Number(amount),
                user_identity_address: customerAddress.trim() || user?.email || 'customer@example.com',
                callback_url: `${origin}/payment-test/callback`,
                success_redirect_url: `${origin}/sucess-page/{code}`,
                invoice_number: finalInvoice,
                expiry_minutes: Number(expiryMinutes),
                checkout_items: {
                    type: "Custom Payment Link",
                    purpose: purpose.trim() || "General Charge",
                    initiator: "Merchant Dashboard",
                    customSuccess: {
                        title: successTitle.trim() || undefined,
                        message: successMessage.trim() || undefined,
                        note: note.trim() || undefined,
                        notifyPhone: notifyPhone.trim() || undefined,
                        bgColor: bgColor,
                        textColor: textColor,
                        imageUrl: imageUrl.trim() || undefined
                    }
                }
            }, {
                headers: {
                    'X-Opay-Business-Token': user?.apiToken
                }
            });

            if (response.data.success && response.data.payment_page_url) {
                const link = response.data.payment_page_url;
                setGeneratedLink(link);
                setGeneratedCode(response.data.short_code);
                
                // Refresh list from server
                fetchHistory();

                // Clear input form fields
                setAmount('');
                setCustomerAddress('');
                setPurpose('');
                setInvoiceNumber('');
                setSuccessTitle('');
                setSuccessMessage('');
                setImageUrl('');
                setNotifyPhone('');
                setNote('');
                setSelectedPreset('emerald');
                setDuplicatingFrom(null); // clear duplicate mode
            } else {
                setError(response.data.message || 'Failed to generate payment link');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (linkText) => {
        const instruction = [
            `💳 পেমেন্ট লিংক:`,
            `${linkText}`,
            ``,
            `⚠️ গুরুত্বপূর্ণ নির্দেশনা:`,
            `• এই লিংকটি শুধুমাত্র একবার ব্যবহারযোগ্য।`,
            `• লিংকটি একবার ওপেন করলে এবং বন্ধ করলে স্বয়ংক্রিয়ভাবে মেয়াদ শেষ (Expire) হয়ে যাবে।`,
            `• পরবর্তী পেমেন্টের জন্য নতুন লিংক প্রয়োজন হবে।`,
            `• লিংকটি অন্য কাউকে শেয়ার করবেন না।`,
        ].join('\n');
        navigator.clipboard.writeText(instruction);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenLink = (e) => {
        const confirmOpen = window.confirm(
            "সাবধান! এটি একটি একক ব্যবহারের (Single-use) পেমেন্ট লিংক। লিংকটি নিজে ওপেন না করে সরাসরি আপনার ক্লায়েন্টকে পাঠিয়ে দিন (লিংকটি কপি করার জন্য 'Copy' অপশন ব্যবহার করুন)। নিজে ওপেন করতে না চাইলে 'Cancel' ক্লিক করুন, ভুলেও 'OK' ক্লিক করবেন না। একবার ওপেন করা হলে এটি পরবর্তীতে আর পুনরায় ওপেন বা ব্যবহার করা যাবে না।"
        );
        if (!confirmOpen) {
            e.preventDefault();
        }
    };

    const handleExpireHistoryLink = async (item) => {
        const confirmExpire = window.confirm('This will expire the payment link immediately. Continue?');
        if (!confirmExpire) return;

        setActionLoading({ code: item.code, action: 'expire' });
        setError('');
        try {
            const res = await expirePaymentPageHistory(item.code);
            if (res.success) {
                await fetchHistory();
            } else {
                setError(res.message || 'Failed to expire payment link');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to expire payment link');
        } finally {
            setActionLoading({ code: '', action: '' });
        }
    };

    const handleDeleteHistoryLink = async (item) => {
        const confirmDelete = window.confirm('This will permanently delete the payment link record. Continue?');
        if (!confirmDelete) return;

        setActionLoading({ code: item.code, action: 'delete' });
        setError('');
        try {
            const res = await deletePaymentPageHistory(item.code);
            if (res.success) {
                await fetchHistory();
            } else {
                setError(res.message || 'Failed to delete payment link');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to delete payment link');
        } finally {
            setActionLoading({ code: '', action: '' });
        }
    };

    const closeHistoryDetails = () => setSelectedHistoryItem(null);

    // Pre-fill form with data from an existing history item (Duplicate / Regenerate)
    const handleDuplicate = (item) => {
        setAmount(String(item.amount || ''));
        setCustomerAddress(item.user_identity_address || '');
        setPurpose(item.checkoutItems?.purpose || '');
        setInvoiceNumber(''); // intentionally blank so a new one auto-generates
        setNote(item.checkoutItems?.customSuccess?.note || '');
        setNotifyPhone(item.checkoutItems?.customSuccess?.notifyPhone || '');
        setSuccessTitle(item.checkoutItems?.customSuccess?.title || '');
        setSuccessMessage(item.checkoutItems?.customSuccess?.message || '');
        setImageUrl(item.checkoutItems?.customSuccess?.imageUrl || '');

        // Restore branding colors
        const bg = item.checkoutItems?.customSuccess?.bgColor;
        const txt = item.checkoutItems?.customSuccess?.textColor;
        if (bg) setBgColor(bg);
        if (txt) setTextColor(txt);
        // Switch to custom preset if custom colors were used, otherwise keep default
        const matchedPreset = PRESETS.find(p => p.id !== 'custom' && p.bg === bg && p.text === txt);
        setSelectedPreset(matchedPreset ? matchedPreset.id : (bg ? 'custom' : 'emerald'));

        setDuplicatingFrom(item);
        setExpiryMinutes('30'); // reset expiry so user consciously picks a new one
        setGeneratedLink(''); // hide old result
        setError('');

        // Scroll form into view
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    const getLinkStatus = (item) => {
        if (item.status === 'paid') {
            return {
                label: 'Paid',
                color: 'text-emerald-700 bg-emerald-100 border-emerald-200',
                icon: CheckCircle2
            };
        }
        
        // Expired check
        const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
        if (isExpired) {
            return {
                label: 'Expired',
                color: 'text-rose-700 bg-rose-100 border-rose-200',
                icon: AlertCircle
            };
        }

        // Used / Opened check (backend enforces 30 seconds after opening once)
        if (item.firstOpenedAt) {
            const timeSinceOpen = new Date() - new Date(item.firstOpenedAt);
            if (timeSinceOpen > 30 * 1000) {
                return {
                    label: 'Used / Invalid',
                    color: 'text-amber-700 bg-amber-100 border-amber-200',
                    icon: AlertCircle
                };
            }
            return {
                label: 'Opened',
                color: 'text-orange-700 bg-orange-100 border-orange-200',
                icon: Eye
            };
        }

        return {
            label: 'Active / Pending',
            color: 'text-blue-700 bg-blue-100 border-blue-200',
            icon: Clock
        };
    };

    // Helper to calculate relative luminance of bgColor
    const getLuminance = (hex) => {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 1; // default to light
        let c = hex.substring(1);      // strip #
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length !== 6) return 1;
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        // Relative luminance formula
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    
    const isLightBg = getLuminance(bgColor) > 0.5;
    const cardBgClass = isLightBg 
        ? 'bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] border border-slate-100/90' 
        : 'bg-slate-900 border border-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.3)]';
    const cardTextColor = isLightBg ? 'text-slate-800' : 'text-slate-200';
    const labelColor = isLightBg ? 'text-slate-400' : 'text-slate-500';
    const receiptBgColor = isLightBg ? 'bg-slate-50' : 'bg-slate-950/40';
    const dividerBorderColor = isLightBg ? 'border-slate-100' : 'border-slate-800/80';

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="bg-brand-primary/10 p-2.5 rounded-2xl text-brand-primary">
                            <Link2 className="w-6 h-6" />
                        </span>
                        Custom Payment Link
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Generate reusable or one-off payment links to share with customers.</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 flex items-center gap-3 w-fit">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block leading-none">Instant Checkout</span>
                        <span className="text-xs font-black text-indigo-700">No integration required</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Generation Form (Left) */}
                <div ref={formRef} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm lg:col-span-8 space-y-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Create Link</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">Configure your payment link parameters &amp; success page branding</p>
                    </div>

                    {/* Duplicate Mode Banner */}
                    {duplicatingFrom && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 animate-in slide-in-from-top-3 duration-200">
                            <RefreshCcw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Duplicate Mode</p>
                                <p className="text-xs text-amber-700 font-semibold mt-0.5">
                                    Pre-filled from: <span className="font-mono font-black">{duplicatingFrom.checkoutItems?.purpose || 'Link'}</span>
                                    {duplicatingFrom.invoiceNumber && <> &mdash; Ref: <span className="font-mono">{duplicatingFrom.invoiceNumber}</span></>}
                                    . Choose a new expiry time and click Generate.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDuplicatingFrom(null)}
                                className="text-amber-500 hover:text-amber-700 text-lg leading-none font-black flex-shrink-0"
                                title="Cancel duplicate mode"
                            >×</button>
                        </div>
                    )}

                    <form onSubmit={handleGenerateLink} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Amount (BDT)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="e.g. 500"
                                    min="10"
                                    max="100000"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold font-mono"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Purpose / Description</label>
                                <input
                                    type="text"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    placeholder="e.g. Website Design Fee"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Customer Info (Email/Phone)</label>
                                <input
                                    type="text"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    placeholder="e.g. customer@example.com"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Link Expiry</label>
                                <select
                                    value={expiryMinutes}
                                    onChange={(e) => setExpiryMinutes(e.target.value)}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold text-sm h-[46px]"
                                >
                                    <option value="15">15 Minutes</option>
                                    <option value="30">30 Minutes</option>
                                    <option value="60">1 Hour</option>
                                    <option value="360">6 Hours</option>
                                    <option value="720">12 Hours</option>
                                    <option value="1440">24 Hours</option>
                                    <option value="10080">7 Days</option>
                                </select>
                            </div>
                        </div>

                        {/* Optional Reference */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Invoice / Reference (Optional)</label>
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                placeholder="e.g. INV-1092"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold"
                            />
                        </div>

                        {/* Optional Note */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Note (Optional)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Optional note to show on success page"
                                rows="2"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold resize-none text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Notify Phone (Optional)</label>
                            <input
                                type="tel"
                                value={notifyPhone}
                                onChange={(e) => setNotifyPhone(e.target.value)}
                                placeholder="e.g. 01XXXXXXXXX"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all font-semibold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">If provided, this number will receive an SMS when payment is completed.</p>
                        </div>

                        {/* Success Page Customization */}
                        <div className="border-t border-slate-100 pt-5">
                            <button
                                type="button"
                                onClick={() => setShowCustomize(!showCustomize)}
                                className="flex items-center justify-between w-full text-sm font-black text-slate-800 hover:text-brand-accent transition-colors pb-3 border-b border-slate-100"
                            >
                                <span className="flex items-center gap-2"><Palette className="w-4 h-4 text-brand-primary" /> Success Screen Designer Settings</span>
                                {showCustomize ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {showCustomize && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5 animate-in slide-in-from-top-3 duration-200">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Success Title</label>
                                            <input
                                                type="text"
                                                value={successTitle}
                                                onChange={(e) => setSuccessTitle(e.target.value)}
                                                placeholder="e.g. পেমেন্ট সফল হয়েছে!"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 outline-none transition-all text-sm font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Success Message</label>
                                            <textarea
                                                value={successMessage}
                                                onChange={(e) => setSuccessMessage(e.target.value)}
                                                placeholder="e.g. মার্চেন্টে রিডাইরেক্ট করা হচ্ছে..."
                                                rows="2"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 outline-none transition-all text-sm font-semibold resize-none"
                                            />
                                        </div>
                                        
                                        {/* Logo upload block */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                                <span>Logo / Branding Image</span>
                                                {uploading && <span className="text-[10px] text-brand-primary font-bold animate-pulse flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
                                            </label>
                                            
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={imageUrl}
                                                    onChange={(e) => setImageUrl(e.target.value)}
                                                    placeholder="Or enter logo URL directly..."
                                                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 outline-none transition-all text-xs font-mono"
                                                />
                                                <label className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl cursor-pointer text-xs font-bold text-slate-700 transition-all select-none">
                                                    <UploadCloud className="w-4 h-4" /> Upload
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={handleImageUpload} 
                                                        className="hidden" 
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Design Theme Preset</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {PRESETS.map((preset) => (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => setSelectedPreset(preset.id)}
                                                        className={`px-3 py-2.5 text-xs font-bold border rounded-xl transition-all text-center leading-tight truncate ${preset.previewBorder} ${selectedPreset === preset.id ? 'ring-2 ring-brand-accent border-brand-accent font-black shadow-sm' : 'opacity-85 hover:opacity-100'}`}
                                                        style={{ color: preset.id === 'custom' ? '#1e293b' : preset.text }}
                                                    >
                                                        {preset.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {selectedPreset === 'custom' && (
                                            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in fade-in duration-200">
                                                <div>
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Background</label>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="color" 
                                                            value={bgColor} 
                                                            onChange={(e) => setBgColor(e.target.value)} 
                                                            className="w-8 h-8 rounded-lg cursor-pointer border-0 outline-none bg-transparent"
                                                        />
                                                        <span className="text-xs font-mono font-semibold uppercase">{bgColor}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Text Color</label>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="color" 
                                                            value={textColor} 
                                                            onChange={(e) => setTextColor(e.target.value)} 
                                                            className="w-8 h-8 rounded-lg cursor-pointer border-0 outline-none bg-transparent"
                                                        />
                                                        <span className="text-xs font-mono font-semibold uppercase">{textColor}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600 leading-relaxed">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !user?.apiToken || user?.kycStatus !== 'approved' || uploading}
                            className="w-full py-4 bg-brand-accent text-white rounded-xl font-bold hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-accent/20"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Generate Payment Link <ArrowRight className="w-4 h-4" /></>}
                        </button>

                        {user?.kycStatus !== 'approved' && (
                            <p className="text-[10px] text-center text-rose-500 font-bold leading-relaxed">
                                * Your account must be KYC approved to generate payment links.
                            </p>
                        )}
                    </form>
                </div>

                {/* Live Success Preview (Right) */}
                <div className="lg:col-span-4 space-y-6 sticky top-8">
                    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Live Success Preview
                            </h3>
                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Dynamic</span>
                        </div>
                        
                        <div 
                            className="w-full rounded-[2rem] border border-slate-100/50 shadow-inner flex flex-col items-center justify-center p-6 relative overflow-hidden transition-all duration-300 min-h-[460px] font-sans scale-95 origin-top"
                            style={{ backgroundColor: bgColor }}
                        >
                            {/* Glowing Ambient Background Orbs */}
                            <div className="absolute -top-20 -left-20 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />
                            <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />

                            <div className={`w-full ${cardBgClass} rounded-[2rem] p-6 flex flex-col items-center relative overflow-hidden transition-all duration-300`}>
                                
                                {/* Logo / Success Animated Icon */}
                                <div className="mb-4 relative z-10">
                                    {imageUrl ? (
                                        <div className="w-16 h-16 rounded-[1.2rem] bg-white flex items-center justify-center shadow-md border border-slate-100 p-2 overflow-hidden relative">
                                            <img src={imageUrl} alt="Merchant Logo" className="w-full h-full object-contain rounded-lg" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-sm">
                                            <Check className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>

                                {/* Business Information */}
                                <div className="text-center mb-3">
                                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-600 mb-0.5 block">
                                        Your Business Name
                                    </span>
                                    <h4 className="text-lg font-black tracking-tight leading-tight" style={{ color: textColor }}>
                                        {successTitle || 'পেমেন্ট সফল হয়েছে!'}
                                    </h4>
                                    <p className="text-[10px] font-semibold mt-1 leading-relaxed max-w-[200px] mx-auto" style={{ color: textColor, opacity: 0.8 }}>
                                        {successMessage || 'ধন্যবাদ! আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।'}
                                    </p>
                                </div>

                                {/* Special Note Callout */}
                                {note && (
                                    <div className="w-full mt-3 px-4 py-3 rounded-2xl border-2 border-dashed flex items-start gap-3" style={{ background: isLightBg ? '#ecfdf5' : 'rgba(16,185,129,0.06)', borderColor: isLightBg ? '#bbf7d0' : 'rgba(34,197,94,0.12)' }}>
                                        <div className="flex-shrink-0 mt-0.5">
                                            <Sparkles className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-xs font-black uppercase tracking-wider text-emerald-700">Note</div>
                                            <div className="text-sm font-semibold mt-1" style={{ color: textColor }}>
                                                {note}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tear-off Ticket Decorative Separator */}
                                <div className="w-full relative flex items-center my-4">
                                    {/* Left Cutout */}
                                    <div className="absolute left-[-32px] w-4 h-8 rounded-r-full border-r border-y transition-colors duration-300" 
                                        style={{ 
                                            backgroundColor: bgColor, 
                                            borderColor: isLightBg ? '#f1f5f9' : '#1e293b' 
                                        }} 
                                    />
                                    {/* Right Cutout */}
                                    <div className="absolute right-[-32px] w-4 h-8 rounded-l-full border-l border-y transition-colors duration-300" 
                                        style={{ 
                                            backgroundColor: bgColor, 
                                            borderColor: isLightBg ? '#f1f5f9' : '#1e293b' 
                                        }} 
                                    />
                                    {/* Dashed Line */}
                                    <div className="w-full border-t-2 border-dashed transition-colors duration-300" 
                                        style={{ borderColor: isLightBg ? '#e2e8f0' : '#334155' }} 
                                    />
                                </div>

                                {/* Receipt Details Container */}
                                <div className={`w-full ${receiptBgColor} rounded-2xl p-4 space-y-2.5 border ${dividerBorderColor} text-xs`}>
                                    <div className="flex justify-between items-center border-b pb-1.5" style={{ borderColor: isLightBg ? '#e2e8f0' : '#1e293b' }}>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payment Receipt</span>
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    </div>

                                    <div className="space-y-2 font-semibold">
                                        <div className="flex justify-between items-start gap-4">
                                            <span className={`${labelColor} flex items-center gap-1.5`}><Receipt className="w-3.5 h-3.5 opacity-70" /> Invoice Ref</span>
                                            <span className={`${cardTextColor} font-mono text-right`}>{invoiceNumber || 'INV-1092'}</span>
                                        </div>

                                        <div className="flex justify-between items-start gap-4">
                                            <span className={`${labelColor} flex items-center gap-1.5`}><Calendar className="w-3.5 h-3.5 opacity-70" /> Date & Time</span>
                                            <span className={`${cardTextColor} text-right font-medium`}>{new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                                        </div>

                                        <div className="flex justify-between items-start gap-4">
                                            <span className={`${labelColor} flex items-center gap-1.5`}><Receipt className="w-3.5 h-3.5 opacity-70" /> Description</span>
                                            <span className={`${cardTextColor} text-right truncate max-w-[120px]`}>{purpose || 'Website Design Fee'}</span>
                                        </div>

                                        <div className="flex justify-between items-start gap-4">
                                            <span className={`${labelColor} flex items-center gap-1.5`}><FileSpreadsheet className="w-3.5 h-3.5 opacity-70" /> Note</span>
                                            <span className={`${cardTextColor} text-right truncate max-w-[120px]`}>{note || '—'}</span>
                                        </div>

                                        <div className="pt-2 border-t flex justify-between items-center" style={{ borderColor: isLightBg ? '#e2e8f0' : '#1e293b' }}>
                                            <span className={`${labelColor} flex items-center gap-1.5 text-xs`}><DollarSign className="w-4 h-4 opacity-70" /> Amount Paid</span>
                                            <span className="text-sm font-black font-mono text-emerald-500">{Number(amount || 5000).toLocaleString()} BDT</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Print and Return Buttons */}
                                <div className="w-full mt-4 flex gap-2">
                                    <div className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border text-[10px] select-none bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60`}>
                                        <Printer className="w-3.5 h-3.5" /> Print
                                    </div>
                                    <div className="flex-1 py-2 px-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-[10px] select-none">
                                        Back to Store <ArrowRight className="w-3.5 h-3.5" />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Generated Link Result Section */}
            {generatedLink && (
                <div className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100 animate-in slide-in-from-top-4 duration-300 shadow-sm space-y-5">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h3 className="text-emerald-900 font-black text-lg flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                পেমেন্ট লিংক তৈরি হয়েছে!
                            </h3>
                            <p className="text-emerald-700 text-xs font-semibold mt-1">নিচের লিংকটি কপি করে আপনার ক্লায়েন্টকে পাঠিয়ে দিন।</p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200 flex-shrink-0">
                            <Clock className="w-3.5 h-3.5" /> {Number(expiryMinutes) >= 60 ? `${Math.round(Number(expiryMinutes)/60)} ঘন্টা` : `${expiryMinutes} মিনিট`} এ মেয়াদ শেষ
                        </span>
                    </div>

                    {/* Link Box + Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-white border border-emerald-200 rounded-2xl px-4 py-3.5 font-mono text-sm break-all text-emerald-800 flex items-center justify-between shadow-inner">
                            <span className="truncate mr-4 select-all">{generatedLink}</span>
                            <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => handleCopy(generatedLink)}
                                className="px-5 py-3.5 bg-white border border-emerald-200 text-emerald-800 rounded-2xl font-bold hover:bg-emerald-100/50 active:scale-95 transition-all flex items-center gap-2 text-sm shadow-sm"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <a
                                href={generatedLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={handleOpenLink}
                                className="px-5 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 text-sm shadow-md"
                            >
                                Open <ExternalLink className="w-4 h-4" />
                            </a>
                            {generatedCode && (
                                <a
                                    href={`/sucess-page/${generatedCode}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-5 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 text-sm shadow-md"
                                >
                                    Success Preview <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Bangla Instruction Panel */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-amber-600 text-base">⚠️</span>
                            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">ক্লায়েন্টকে পাঠানোর আগে জেনে নিন</p>
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-200 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">১</span>
                                <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                                    এই লিংকটি <strong className="font-black">শুধুমাত্র একবার</strong> ব্যবহার করা যাবে। একবার ওপেন করলে লিংকটি <strong className="font-black">স্বয়ংক্রিয়ভাবে বন্ধ</strong> হয়ে যাবে।
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-200 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">২</span>
                                <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                                    ক্লায়েন্ট লিংক ওপেন করে পেমেন্ট না করলে বা বন্ধ করে দিলে — লিংকটি <strong className="font-black">Expire</strong> হয়ে যাবে। তখন নতুন লিংক তৈরি করতে হবে।
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-200 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">৩</span>
                                <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                                    লিংকটি <strong className="font-black">সরাসরি ক্লায়েন্টকে</strong> পাঠান। নিজে ওপেন করলে লিংক নষ্ট হয়ে যাবে।
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-amber-200">
                            <p className="text-[11px] text-amber-600 font-bold flex items-center gap-1.5">
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy বাটনে ক্লিক করলে লিংক ও সম্পূর্ণ নির্দেশনা একসাথে কপি হবে — সরাসরি WhatsApp বা SMS এ পাঠান।</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}


            {/* Links History Section */}
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Recent Links</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">Real-time status of payment links generated by your account</p>
                    </div>
                    <button 
                        onClick={fetchHistory}
                        disabled={historyLoading}
                        className="text-xs font-bold text-brand-primary hover:text-brand-accent transition-colors flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>

                {historyLoading && history.length === 0 ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-16 text-slate-300 space-y-3">
                        <div className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-[1.5rem] mx-auto flex items-center justify-center">
                            <Link2 className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">No links generated yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto pr-1">
                        {history.map((item, index) => {
                            const statusInfo = getLinkStatus(item);
                            const StatusIcon = statusInfo.icon;
                            const expired = item.expires_at && new Date(item.expires_at) < new Date();
                            const invalid = expired || (item.firstOpenedAt && (new Date() - new Date(item.firstOpenedAt) > 30 * 1000) && item.status !== 'paid');
                            const isOpened = Boolean(item.firstOpenedAt);
                            const busy = actionLoading.code === item.code;

                            return (
                                <div key={index} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group/item">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className="text-sm font-black text-slate-800">
                                                {item.checkoutItems?.purpose || 'General Payment'}
                                            </span>
                                            <span className="text-[10px] font-black font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                {item.invoiceNumber || 'No Ref'}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusInfo.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-semibold">
                                            <span className="font-bold text-slate-400">Customer: <strong className="text-slate-600 font-semibold">{item.user_identity_address}</strong></span>
                                            <span className="font-bold text-slate-400">Expires: <strong className={`${expired ? 'text-rose-500 font-bold' : 'text-slate-600'} font-semibold`}>{new Date(item.expires_at).toLocaleString()}</strong></span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-black text-brand-primary mr-3 font-mono">{item.amount.toLocaleString()} BDT</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSelectedHistoryItem(item)}
                                                className="p-2.5 rounded-xl text-slate-500 border border-transparent flex items-center justify-center hover:bg-slate-100 hover:text-brand-primary hover:border-slate-200 active:scale-90 transition-all"
                                                title="View details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {item.status !== 'paid' && !isOpened && (
                                                <button
                                                    onClick={() => handleDeleteHistoryLink(item)}
                                                    disabled={busy}
                                                    className="p-2.5 rounded-xl text-slate-500 border border-transparent flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title="Delete unused link"
                                                >
                                                    {busy && actionLoading.action === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            )}
                                            {item.status !== 'paid' && isOpened && (
                                                <button
                                                    onClick={() => handleExpireHistoryLink(item)}
                                                    disabled={busy}
                                                    className="p-2.5 rounded-xl text-slate-500 border border-transparent flex items-center justify-center hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title="Expire opened link"
                                                >
                                                    {busy && actionLoading.action === 'expire' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleCopy(item.payment_page_url)}
                                                disabled={invalid || item.status === 'paid'}
                                                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-brand-primary active:scale-90 transition-all border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                                title="Copy URL"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicate(item)}
                                                className="p-2.5 rounded-xl text-slate-500 border border-transparent flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 active:scale-90 transition-all"
                                                title="Duplicate / Regenerate this link with new expiry"
                                            >
                                                <RefreshCcw className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={invalid || item.status === 'paid' ? '#' : item.payment_page_url}
                                                target={invalid || item.status === 'paid' ? '_self' : '_blank'}
                                                rel="noreferrer"
                                                onClick={(e) => {
                                                    if (invalid || item.status === 'paid') {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    handleOpenLink(e);
                                                }}
                                                className={`p-2.5 rounded-xl text-slate-500 border border-transparent flex items-center justify-center ${(invalid || item.status === 'paid') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 hover:text-brand-primary hover:border-slate-200 active:scale-90 transition-all'}`}
                                                title={item.status === 'paid' ? 'Paid link' : invalid ? 'Link invalid/expired' : 'Open link'}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <a
                                                href={`/sucess-page/${item.code}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2.5 rounded-xl text-slate-500 border border-transparent flex items-center justify-center hover:bg-slate-100 hover:text-brand-primary hover:border-slate-200 active:scale-90 transition-all"
                                                title="Preview Success Page"
                                            >
                                                <Receipt className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedHistoryItem && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeHistoryDetails}>
                    <div
                        className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Payment Link Details</h3>
                                <p className="text-xs font-semibold text-slate-500">Full session information for this Recent Link</p>
                            </div>
                            <button
                                onClick={closeHistoryDetails}
                                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex items-center justify-center"
                                title="Close"
                            >
                                <span className="text-xl leading-none">×</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${selectedHistoryItem.status === 'paid' ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : 'text-blue-700 bg-blue-100 border-blue-200'}`}>
                                    <CheckCircle2 className="w-3 h-3" />
                                    {selectedHistoryItem.status || 'pending'}
                                </span>
                                <span className="text-[10px] font-black font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    {selectedHistoryItem.code}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Amount</div>
                                    <div className="mt-1 text-lg font-black text-brand-primary">{Number(selectedHistoryItem.amount || 0).toLocaleString()} BDT</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Invoice</div>
                                    <div className="mt-1 font-semibold text-slate-800">{selectedHistoryItem.invoiceNumber || 'No Ref'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Purpose</div>
                                    <div className="mt-1 font-semibold text-slate-800">{selectedHistoryItem.checkoutItems?.purpose || 'General Payment'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer</div>
                                    <div className="mt-1 font-semibold text-slate-800 break-all">{selectedHistoryItem.user_identity_address}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Note</div>
                                    <div className="mt-1 font-semibold text-slate-800 whitespace-pre-wrap break-words">{selectedHistoryItem.checkoutItems?.customSuccess?.note || '—'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Notify Phone</div>
                                    <div className="mt-1 font-semibold text-slate-800">{selectedHistoryItem.checkoutItems?.customSuccess?.notifyPhone || '—'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Created</div>
                                    <div className="mt-1 font-semibold text-slate-800">{selectedHistoryItem.createdAt ? new Date(selectedHistoryItem.createdAt).toLocaleString() : '—'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expires</div>
                                    <div className="mt-1 font-semibold text-slate-800">{selectedHistoryItem.expires_at ? new Date(selectedHistoryItem.expires_at).toLocaleString() : '—'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment Page URL</div>
                                    <div className="mt-1 font-mono text-xs text-slate-700 break-all">{selectedHistoryItem.payment_page_url}</div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                                <a
                                    href={selectedHistoryItem.payment_page_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2.5 rounded-xl bg-brand-accent text-white font-bold hover:opacity-90 transition-all flex items-center gap-2"
                                >
                                    <ExternalLink className="w-4 h-4" /> Open Link
                                </a>
                                <a
                                    href={`/sucess-page/${selectedHistoryItem.code}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
                                >
                                    <Receipt className="w-4 h-4" /> Success Page
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
