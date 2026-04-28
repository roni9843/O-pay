import React, { useState, useEffect } from 'react';
import { api, getDashboardOverview, fetchMerchantWithdrawals, getWithdrawalConfig } from '../lib/api';
import { Wallet, Landmark, Smartphone, AlertCircle, CheckCircle2, Clock, XCircle, Image as ImageIcon, ExternalLink } from 'lucide-react';

// For images: get the domain from VITE_API_BASE_URL (removing /api) or fallback
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api$/, '')

export default function Withdrawal() {
    const [overview, setOverview] = useState(null);
    const [kycData, setKycData] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [withdrawConfig, setWithdrawConfig] = useState({ minAmount: 10000, commissionPercent: 0 });
    
    const [amount, setAmount] = useState('');
    const [selectedMethod, setSelectedMethod] = useState(''); // e.g., 'bank_0' or 'mfs_1'
    
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', msg: '' }
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [resDashboard, resKyc, resHistory, resConfig] = await Promise.all([
                getDashboardOverview(),
                api.get('/opay-business/kyc/status'),
                fetchMerchantWithdrawals(),
                getWithdrawalConfig()
            ]);

            if (resDashboard.success) setOverview(resDashboard.data);
            if (resKyc.data?.data?.kycData) setKycData(resKyc.data.data.kycData);
            if (resHistory.success) setHistory(resHistory.data);
            if (resConfig.success && resConfig.data) {
                setWithdrawConfig({
                    minAmount: Number(resConfig.data.minAmount || 0),
                    commissionPercent: Number(resConfig.data.commissionPercent || 0),
                });
            }

        } catch (err) {
            console.error("Failed to load withdrawal resources", err);
        } finally {
            setLoading(false);
        }
    };

    const maxAmount = overview?.totals?.availableBalance || 0;
    const minWithdrawalAmount = Number(withdrawConfig.minAmount || 0);
    const commissionPercent = Number(withdrawConfig.commissionPercent || 0);
    const amountNum = Number(amount) || 0;
    const commissionAmount = amountNum > 0 ? (amountNum * commissionPercent) / 100 : 0;
    const receiveAmount = amountNum - commissionAmount;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus(null);
        
        const numAmount = Number(amount);
        if (numAmount <= 0) return setStatus({ type: 'error', msg: 'Please enter a valid amount' });
        if (numAmount < minWithdrawalAmount) return setStatus({ type: 'error', msg: `Minimum withdrawal is ৳${minWithdrawalAmount}` });
        if (numAmount > maxAmount) return setStatus({ type: 'error', msg: 'Insufficient balance' });
        if (!selectedMethod) return setStatus({ type: 'error', msg: 'Please select a withdrawal method' });

        setSubmitting(true);
        try {
            let methodData = null;
            if (selectedMethod.startsWith('bank_')) {
                const idx = parseInt(selectedMethod.split('_')[1]);
                methodData = { ...kycData.banking[idx], type: 'Bank' };
            } else if (selectedMethod.startsWith('mfs_')) {
                const idx = parseInt(selectedMethod.split('_')[1]);
                methodData = { ...kycData.mfs[idx], type: 'MFS' };
            }

            const res = await api.post('/opay-business/withdraw', { amount: numAmount, method: methodData });
            
            if (res.data.success) {
                setStatus({ type: 'success', msg: 'Withdrawal request submitted successfully!' });
                setAmount('');
                setSelectedMethod('');
                loadData(); // Refresh all
            } else {
                setStatus({ type: 'error', msg: res.data.message || 'Withdrawal failed' });
            }
        } catch (err) {
            setStatus({ type: 'error', msg: err.response?.data?.message || 'Server error' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    const banks = kycData?.banking || [];
    const mfs = kycData?.mfs || [];

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-20">
            <header>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center sm:text-left">Withdraw Funds</h1>
                <p className="text-slate-500 font-medium text-center sm:text-left underline decoration-emerald-200">Transfer your earnings to your linked accounts</p>
            </header>

            {status && (
                <div className={`p-4 rounded-2xl flex items-center justify-between border-2 ${status.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm shadow-emerald-500/10'}`}>
                    <div className="flex items-center gap-3">
                        {status.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        <span className="text-sm font-black">{status.msg}</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div className="p-8 rounded-[2.5rem] bg-indigo-950 text-white shadow-2xl relative overflow-hidden h-fit">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-400/10 blur-[60px] rounded-full -mr-24 -mt-24 animate-pulse" />
                        <Wallet className="w-12 h-12 text-emerald-400 mb-8" />
                        <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Available Balance</p>
                        <h2 className="text-5xl font-black text-white mt-1 tracking-tighter">৳{maxAmount.toLocaleString()}</h2>
                        <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold uppercase tracking-widest">Total Earned</span>
                                <span className="font-mono font-black">৳{overview?.totals?.absoluteTotalSuccessAmount?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-rose-400">
                                <span className="font-bold uppercase tracking-widest opacity-60">Total Withdrawn</span>
                                <span className="font-mono font-black">৳{overview?.totals?.totalWithdrawalAmount?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Account Limitations</h4>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-xs text-slate-600 font-medium">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                Instant payout for MFS accounts
                            </li>
                            <li className="flex gap-2 text-xs text-slate-600 font-medium">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                Bank transfers process in 24h
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-xl md:col-span-3">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-3 px-1">Withdrawal Amount</label>
                            <div className="relative group">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">৳</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (Number(val) > maxAmount) val = String(maxAmount);
                                        setAmount(val);
                                    }}
                                    placeholder="Enter amount"
                                    className="w-full pl-12 pr-24 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-2xl font-black text-slate-900 transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none tracking-tight"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setAmount(String(maxAmount))}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm"
                                >
                                    Max
                                </button>
                            </div>
                            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm space-y-1">
                                <p className="text-slate-700 font-bold">Minimum Withdrawal: ৳{minWithdrawalAmount.toLocaleString()}</p>
                                <p className="text-slate-700 font-bold">Opay Commission: {commissionPercent.toFixed(2)}%</p>
                                <p className="text-emerald-700 font-black">You Receive: ৳{(receiveAmount > 0 ? receiveAmount : 0).toLocaleString()}</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest">Select Method</label>
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">LIVE KYC ONLY</span>
                            </div>
                            
                            {(!banks.length && !mfs.length) ? (
                                <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                                    <p className="text-xs text-amber-800 font-black uppercase tracking-widest flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> Destination Missing
                                    </p>
                                    <p className="text-sm text-amber-700/80 font-medium">Please link your bank or mobile banking accounts in the KYC section to start withdrawing.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-72 overflow-y-auto pr-3 custom-scrollbar">
                                    {banks.map((bank, i) => (
                                        <label key={`bank_${i}`} className={`group relative flex items-center gap-4 p-5 border-2 rounded-3xl cursor-pointer transition-all ${selectedMethod === `bank_${i}` ? 'border-emerald-500 bg-emerald-50/20 shadow-lg shadow-emerald-500/5' : 'border-slate-100 hover:border-slate-200 hover:bg-white'}`}>
                                            <input type="radio" name="method" value={`bank_${i}`} checked={selectedMethod === `bank_${i}`} onChange={(e) => setSelectedMethod(e.target.value)} className="hidden" />
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                                                <Landmark className="w-7 h-7 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-black text-slate-900 text-sm truncate">{bank.bankName}</p>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5 truncate uppercase">{bank.accountNo}</p>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedMethod === `bank_${i}` ? 'border-emerald-500 bg-emerald-500' : 'border-slate-200 bg-white'}`}>
                                                {selectedMethod === `bank_${i}` && <div className="w-2.5 h-2.5 rounded-full bg-white animate-in zoom-in-0" />}
                                            </div>
                                        </label>
                                    ))}

                                    {mfs.map((m, i) => (
                                        <label key={`mfs_${i}`} className={`group relative flex items-center gap-4 p-5 border-2 rounded-3xl cursor-pointer transition-all ${selectedMethod === `mfs_${i}` ? 'border-emerald-500 bg-emerald-50/20 shadow-lg shadow-emerald-500/5' : 'border-slate-100 hover:border-slate-200 hover:bg-white'}`}>
                                            <input type="radio" name="method" value={`mfs_${i}`} checked={selectedMethod === `mfs_${i}`} onChange={(e) => setSelectedMethod(e.target.value)} className="hidden" />
                                            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                                                <Smartphone className="w-7 h-7 text-rose-500" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-black text-slate-900 text-sm flex items-center gap-2 truncate">
                                                    {m.provider}
                                                    <span className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md font-black italic">{m.type}</span>
                                                </p>
                                                <p className="text-sm text-slate-500 font-mono mt-0.5 tracking-tight font-black">{m.number}</p>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedMethod === `mfs_${i}` ? 'border-emerald-500 bg-emerald-500' : 'border-slate-200 bg-white'}`}>
                                                {selectedMethod === `mfs_${i}` && <div className="w-2.5 h-2.5 rounded-full bg-white animate-in zoom-in-0" />}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || (!banks.length && !mfs.length)}
                            className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3"
                        >
                            {submitting ? 'Processing Request...' : 'Initiate Withdrawal'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Withdrawal History */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Withdrawal History</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest underline underline-offset-4 decoration-emerald-200">Recent Transactions</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {history.map(w => (
                        <div key={w._id} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-5 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(w.createdAt).toLocaleDateString()}</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">৳{w.amount?.toLocaleString()}</p>
                                </div>
                                {w.status === 'approved' && <CheckCircle2 className="text-emerald-500 w-5 h-5" />}
                                {w.status === 'rejected' && <XCircle className="text-rose-500 w-5 h-5" />}
                                {w.status === 'pending' && <Clock className="text-amber-500 w-5 h-5 animate-pulse" />}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-black uppercase text-slate-400 w-16">Method:</div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg uppercase">{w.method?.provider || w.method?.bankName}</span>
                                        <span className="text-[10px] font-mono font-black text-slate-400">*{w.method?.number?.slice(-4) || w.method?.accountNo?.slice(-4)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-black uppercase text-slate-400 w-16">Status:</div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${w.status === 'approved' ? 'text-emerald-600' : w.status === 'rejected' ? 'text-rose-600' : 'text-amber-600'}`}>
                                        {w.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-black uppercase text-slate-400 w-16">Receive:</div>
                                    <span className="text-[11px] font-black text-emerald-700">৳{Number((w.receiveAmount ?? w.amount) || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-black uppercase text-slate-400 w-16">Fee:</div>
                                    <span className="text-[10px] font-bold text-rose-500">{Number(w.commissionPercent || 0).toFixed(2)}% (৳{Number(w.commissionAmount || 0).toLocaleString()})</span>
                                </div>
                                {w.status === 'rejected' && w.rejectReason && (
                                    <p className="text-[10px] text-rose-500 bg-rose-50 p-2 rounded-xl font-medium border border-rose-100">Reason: {w.rejectReason}</p>
                                )}
                            </div>

                            {/* Proof Images Gallery */}
                            {w.status === 'approved' && w.proofImages?.length > 0 && (
                                <div className="pt-4 border-t border-slate-50">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Payout Receipts
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {w.proofImages.map((url, idx) => (
                                            <a 
                                                key={idx} 
                                                href={`${API_BASE}${url}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 hover:border-emerald-500 transition-all group relative"
                                            >
                                                <img src={`${API_BASE}${url}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="receipt" />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                                    <ExternalLink className="text-white w-3 h-3" />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {history.length === 0 && (
                        <div className="col-span-full py-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No withdrawal history available.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
