import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ShieldCheck, Calendar, Receipt, DollarSign, Printer, ArrowRight, Sparkles } from 'lucide-react';
import axios from 'axios';

export default function PublicSuccessPage() {
    const { code } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [session, setSession] = useState(null);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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

    useEffect(() => {
        async function fetchSession() {
            if (!code) return;
            try {
                setLoading(true);
                const res = await axios.get(`${API_BASE}/opay-business/payment-receipt/${code}`);
                const data = res.data;
                if (!data.success) {
                    setError(data.message || 'Invalid or expired payment session');
                } else {
                    setSession(data);
                }
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || 'Failed to connect to servers.');
            } finally {
                setLoading(false);
            }
        }
        fetchSession();
    }, [code, API_BASE]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                    <span className="text-sm font-bold text-slate-400 animate-pulse">Loading Success Details...</span>
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
                <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-6 text-3xl shadow-xl shadow-rose-500/5">
                    ⚠️
                </div>
                <h1 className="text-2xl font-black text-slate-100 mb-2">Access Denied</h1>
                <p className="text-slate-400 max-w-sm mb-6 font-medium">{error || 'Session details unavailable.'}</p>
            </div>
        );
    }

    const { checkout_items, business, amount, invoiceNumber } = session;
    const customSuccess = checkout_items?.customSuccess || {};
    const bgColor = customSuccess.bgColor || '#ffffff';
    const textColor = customSuccess.textColor || '#064e3b';
    const title = customSuccess.title || 'পেমেন্ট সফল হয়েছে!';
    const message = customSuccess.message || 'ধন্যবাদ! আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।';
    const logoUrl = customSuccess.imageUrl || null;
    const purpose = checkout_items?.purpose || 'General Payment';
    const note = customSuccess.note || '';

    const isLightBg = getLuminance(bgColor) > 0.5;

    // Build card classes dynamically for premium look
    const cardBgClass = isLightBg 
        ? 'bg-white shadow-[0_24px_70px_rgba(0,0,0,0.06)] border border-slate-100/90' 
        : 'bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/80 shadow-[0_24px_70px_rgba(0,0,0,0.35)]';

    const cardTextColor = isLightBg ? 'text-slate-800' : 'text-slate-100';
    const labelColor = isLightBg ? 'text-slate-500' : 'text-slate-400';
    const dividerBorderColor = isLightBg ? 'border-slate-100' : 'border-slate-800/60';
    const receiptBgColor = isLightBg ? 'bg-slate-50/50' : 'bg-slate-900/50';

    // Construct merchant store link if domain is provided
    let storeDomain = business?.domain || '';
    if (storeDomain && !storeDomain.startsWith('http://') && !storeDomain.startsWith('https://')) {
        storeDomain = `https://${storeDomain}`;
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <div 
            className="min-h-screen flex items-center justify-center p-4 transition-all duration-500 font-sans relative overflow-hidden"
            style={{ backgroundColor: bgColor }}
        >
            {/* Custom Animations & Styles */}
            <style>{`
                @keyframes draw-check {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
                @keyframes scale-circle {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-check {
                    stroke-dasharray: 80;
                    stroke-dashoffset: 80;
                    animation: draw-check 0.6s cubic-bezier(0.19, 1, 0.22, 1) 0.3s forwards;
                }
                .animate-circle {
                    animation: scale-circle 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Glowing Ambient Background Orbs */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className={`w-full max-w-xl ${cardBgClass} rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center relative overflow-hidden transition-all duration-300`}>
                
                {/* Logo / Success Animated Icon */}
                <div className="mb-6 relative z-10">
                    {logoUrl ? (
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-[2.2rem] blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                            <div className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center shadow-lg border border-slate-100 p-3 overflow-hidden relative">
                                <img src={logoUrl} alt="Merchant Logo" className="w-full h-full object-contain rounded-xl" />
                            </div>
                        </div>
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-4 border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-circle">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path className="animate-check" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Business Information */}
                <div className="text-center mb-5">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600 mb-1 block">
                        {business?.name || 'Verified Merchant'}
                    </span>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight" style={{ color: textColor }}>
                        {title}
                    </h1>
                    <p className="text-sm font-medium mt-2 leading-relaxed max-w-sm mx-auto" style={{ color: textColor, opacity: 0.85 }}>
                        {message}
                    </p>
                </div>

                {/* Special Note Callout */}
                {note && (
                    <div className="w-full mt-2 px-4 py-3 rounded-2xl border-2 border-dashed flex items-start gap-3 max-w-xl" style={{ background: isLightBg ? '#ecfdf5' : 'rgba(16,185,129,0.06)', borderColor: isLightBg ? '#bbf7d0' : 'rgba(34,197,94,0.12)' }}>
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
                <div className="w-full relative flex items-center my-6 no-print">
                    {/* Left Cutout */}
                    <div className="absolute left-[-42px] md:left-[-50px] w-6 h-12 rounded-r-full border-r border-y transition-colors duration-300" 
                        style={{ 
                            backgroundColor: bgColor, 
                            borderColor: isLightBg ? '#f1f5f9' : '#1e293b' 
                        }} 
                    />
                    {/* Right Cutout */}
                    <div className="absolute right-[-42px] md:right-[-50px] w-6 h-12 rounded-l-full border-l border-y transition-colors duration-300" 
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
                <div className={`w-full ${receiptBgColor} rounded-3xl p-6 md:p-8 space-y-4 border ${dividerBorderColor} relative`}>
                    <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: isLightBg ? '#e2e8f0' : '#1e293b' }}>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Payment Receipt</span>
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>

                    <div className="space-y-3.5 text-sm font-semibold">
                        <div className="flex justify-between items-start gap-4">
                            <span className={`${labelColor} flex items-center gap-2`}><Receipt className="w-4 h-4 opacity-70" /> Invoice Ref</span>
                            <span className={`${cardTextColor} font-mono text-right`}>{invoiceNumber || 'N/A'}</span>
                        </div>

                        <div className="flex justify-between items-start gap-4">
                            <span className={`${labelColor} flex items-center gap-2`}><Calendar className="w-4 h-4 opacity-70" /> Date & Time</span>
                            <span className={`${cardTextColor} text-right font-medium`}>
                                {new Date(session.updatedAt || session.expires_at).toLocaleString('en-US', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                })}
                            </span>
                        </div>

                        <div className="flex justify-between items-start gap-4">
                            <span className={`${labelColor} flex items-center gap-2`}><Receipt className="w-4 h-4 opacity-70" /> Description</span>
                            <span className={`${cardTextColor} text-right truncate max-w-[200px]`}>{purpose}</span>
                        </div>

                        <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: isLightBg ? '#e2e8f0' : '#1e293b' }}>
                            <span className={`${labelColor} flex items-center gap-2 text-base`}><DollarSign className="w-5 h-5 opacity-70" /> Amount Paid</span>
                            <span className="text-2xl font-black font-mono text-emerald-500">{amount?.toLocaleString('en-BD')} BDT</span>
                        </div>
                    </div>
                </div>

                {/* Print and Return Buttons (No Print) */}
                <div className="w-full mt-8 flex flex-col sm:flex-row gap-3 no-print z-10">
                    <button
                        onClick={handlePrint}
                        className={`flex-1 py-3.5 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] border ${
                            isLightBg 
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
                        }`}
                    >
                        <Printer className="w-4 h-4" /> Print Receipt
                    </button>

                    {storeDomain && (
                        <a
                            href={storeDomain}
                            className="flex-1 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/10"
                        >
                            Back to Store <ArrowRight className="w-4 h-4" />
                        </a>
                    )}
                </div>

                {/* Security Footer Badge */}
                <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400 no-print">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure Payment Verified by Opay
                </div>

            </div>
        </div>
    );
}
