import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { getMerchantWithdrawals, updateMerchantWithdrawalStatus, uploadWithdrawalProofs, getMerchantWithdrawalConfig, updateMerchantWithdrawalConfig } from '../lib/api';
import { Landmark, Search, Filter, CheckCircle, XCircle, Clock, Eye, X, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function MerchantWithdraws() {
    const token = useAuthStore(s => s.token);
    const [withdraws, setWithdraws] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [config, setConfig] = useState({ minAmount: 10000, commissionPercent: 0 });
    const [configSaving, setConfigSaving] = useState(false);

    // Multi-image upload state
    const [proofFiles, setProofFiles] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [withdrawRes, configRes] = await Promise.all([
                getMerchantWithdrawals(token),
                getMerchantWithdrawalConfig(token)
            ]);
            if (withdrawRes.success) {
                setWithdraws(withdrawRes.data);
            }
            if (configRes.success && configRes.data) {
                setConfig({
                    minAmount: Number(configRes.data.minAmount || 0),
                    commissionPercent: Number(configRes.data.commissionPercent || 0),
                });
            }
        } catch (err) {
            console.error("Failed to load withdrawals", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setConfigSaving(true);
        try {
            const res = await updateMerchantWithdrawalConfig(token, {
                minAmount: Number(config.minAmount || 0),
                commissionPercent: Number(config.commissionPercent || 0),
            });
            if (res.success && res.data) {
                setConfig({
                    minAmount: Number(res.data.minAmount || 0),
                    commissionPercent: Number(res.data.commissionPercent || 0),
                });
            }
        } catch (err) {
            alert(err.message || 'Failed to save withdrawal config');
        } finally {
            setConfigSaving(false);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + proofFiles.length > 5) {
            alert("Maximum 5 images allowed");
            return;
        }
        setProofFiles(prev => [...prev, ...files]);
    };

    const removeProofFile = (index) => {
        setProofFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateStatus = async (id, status, reason = null) => {
        setSubmitting(true);
        try {
            let proofUrls = [];
            
            // If approving with proofs
            if (status === 'approved' && proofFiles.length > 0) {
                const uploadRes = await uploadWithdrawalProofs(token, proofFiles);
                if (uploadRes.success) {
                    proofUrls = uploadRes.urls;
                }
            }

            const res = await updateMerchantWithdrawalStatus(token, id, status, reason, proofUrls);
            if (res.success) {
                setWithdraws(prev => prev.map(w => w._id === id ? { ...w, status, rejectReason: reason, proofImages: proofUrls } : w));
                setSelectedRequest(null);
                setShowRejectModal(false);
                setRejectReason('');
                setProofFiles([]);
            }
        } catch (err) {
            alert(err.message || "Failed to update status");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3 h-3"/> Approved</span>;
            case 'rejected': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3"/> Rejected</span>;
            case 'pending':
            default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3"/> Pending</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-orange-600/20 via-amber-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[80px]" />
                
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                            Merchant Withdrawals
                        </span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1 max-w-xl">
                        Review and process withdrawal requests from Marchants. Apply payment proofs for transparency.
                    </p>
                    <p className="text-xs text-amber-200/90 mt-2 font-bold">
                        Example: 10,000 at 10% commission {'=>'} Opay Receives 1,000 and Merchant Payout 9,000.
                    </p>
                </div>

                <div className="relative z-10 flex gap-3">
                    <button onClick={loadData} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors">
                        Refresh
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Withdrawal Rules (Admin Control)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Minimum Withdrawal Amount</label>
                        <input
                            type="number"
                            min="0"
                            value={config.minAmount}
                            onChange={(e) => setConfig((prev) => ({ ...prev, minAmount: e.target.value }))}
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Opay Commission (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={config.commissionPercent}
                            onChange={(e) => setConfig((prev) => ({ ...prev, commissionPercent: e.target.value }))}
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-orange-400"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={configSaving}
                        className="h-[46px] rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
                    >
                        {configSaving ? 'Saving...' : 'Save Rules'}
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-black/40">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date / ID</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Merchant</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Opay Commission</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Merchant Payout</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Destination</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {withdraws.map(w => (
                                <tr key={w._id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-white font-medium">{new Date(w.createdAt).toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500 font-mono mt-1">#{w._id.slice(-6).toUpperCase()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white">{w.merchantId?.name || 'Unknown'}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">{w.merchantId?.mobile || w.merchantId?.email || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-emerald-400 text-lg tracking-tighter">৳{w.amount?.toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-amber-300 font-bold">{Number(w.commissionPercent || 0).toFixed(2)}%</div>
                                        <div className="text-[10px] text-slate-500">Opay gets: ৳{Number(w.commissionAmount || 0).toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-cyan-300 text-base">৳{Number(w.receiveAmount ?? w.amount ?? 0).toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500">Merchant gets this amount</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-slate-300 uppercase">
                                                {w.method?.provider || w.method?.bankName || 'Dest'}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">{w.method?.number || w.method?.accountNo || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(w.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => {
                                                setSelectedRequest(w);
                                                setProofFiles([]);
                                            }}
                                            className="p-2 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 rounded-xl transition-all"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#050510] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh] relative">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#050510]/80 backdrop-blur-xl z-10">
                            <div>
                                <h2 className="text-xl font-bold text-white">Process Withdrawal</h2>
                                <p className="text-xs text-slate-400 font-mono mt-1">ID: {selectedRequest._id}</p>
                                <p className="text-[11px] text-amber-200/90 mt-2 font-bold">
                                    Clear Breakdown: Requested amount splits into Opay commission and Merchant payout.
                                </p>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Requested Amount</p>
                                    <p className="text-3xl font-black text-emerald-400 tracking-tighter">৳{selectedRequest.amount?.toLocaleString()}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-black">Current Status</p>
                                    <div>{getStatusBadge(selectedRequest.status)}</div>
                                </div>
                            </div>

                            <div className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                                <h3 className="text-xs font-black text-amber-300 uppercase tracking-widest border-b border-amber-500/20 pb-2">
                                    Financial Breakdown
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Requested</p>
                                        <p className="text-lg font-black text-white">৳{Number(selectedRequest.amount || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Opay Commission</p>
                                        <p className="text-lg font-black text-amber-300">
                                            ৳{Number(selectedRequest.commissionAmount || 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1">{Number(selectedRequest.commissionPercent || 0).toFixed(2)}%</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Merchant Payout</p>
                                        <p className="text-lg font-black text-emerald-300">
                                            ৳{Number((selectedRequest.receiveAmount ?? selectedRequest.amount) || 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1">Amount merchant will receive</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 rounded-3xl bg-white/5 border border-white/5 space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">Designated Payout Data</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    {selectedRequest.method?.bankName ? (
                                        <>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bank Name</p>
                                                <p className="text-white font-bold">{selectedRequest.method.bankName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Account Number</p>
                                                <p className="text-white font-mono break-all">{selectedRequest.method.accountNo}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Name</p>
                                                <p className="text-white">{selectedRequest.method.branchName || 'N/A'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Routing Number</p>
                                                <p className="text-white font-mono">{selectedRequest.method.routingNo || 'N/A'}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MFS Provider</p>
                                                <p className="text-white font-bold uppercase">{selectedRequest.method?.provider}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Account Type</p>
                                                <p className="text-white uppercase font-bold text-xs">{selectedRequest.method?.type}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mobile Number</p>
                                                <p className="text-white font-mono text-lg">{selectedRequest.method?.number}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Payout Proof Upload Section (If pending OR if approved but admin wants to add/update) */}
                            {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved') && (
                                <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                        <ImageIcon className="w-3.5 h-3.5" /> {selectedRequest.status === 'approved' ? 'Add/Update Payout Proofs' : 'Payout Proof Images (Receipts)'}
                                    </h3>
                                    
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                        {proofFiles.map((file, i) => (
                                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                                <img 
                                                    src={URL.createObjectURL(file)} 
                                                    alt="proof" 
                                                    className="w-full h-full object-cover" 
                                                />
                                                <button 
                                                    onClick={() => removeProofFile(i)}
                                                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        {proofFiles.length < 5 && (
                                            <button 
                                                onClick={() => fileInputRef.current.click()}
                                                className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center text-slate-500 hover:text-emerald-400"
                                            >
                                                <Upload size={20} />
                                                <span className="text-[8px] font-black uppercase mt-1">Upload</span>
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        hidden 
                                        multiple 
                                        accept="image/*"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <p className="text-[9px] text-slate-500 px-1 font-bold italic">
                                        {selectedRequest.status === 'approved' ? 'Upload new images to append or replace current proofs.' : 'Recommended: Upload screenshot of transaction success or bank slip. (Max 5)'}
                                    </p>
                                    
                                    {selectedRequest.status === 'approved' && proofFiles.length > 0 && (
                                        <button 
                                            disabled={submitting}
                                            onClick={() => handleUpdateStatus(selectedRequest._id, 'approved')}
                                            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all"
                                        >
                                            {submitting ? 'Updating...' : 'Update Proof Images'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* View Proof Images (If approved) */}
                            {selectedRequest.status === 'approved' && selectedRequest.proofImages?.length > 0 && (
                                <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 font-black">
                                        <ImageIcon className="w-3.5 h-3.5" /> Payout Proofs Provided
                                    </h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                        {selectedRequest.proofImages.map((url, i) => (
                                            <a key={i} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all">
                                                <img 
                                                    src={`${API_BASE}${url}`} 
                                                    alt="proof" 
                                                    className="w-full h-full object-cover" 
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedRequest.status === 'pending' && (
                                <div className="flex gap-3 sticky bottom-0 bg-[#050510] py-4 border-t border-white/5">
                                    <button 
                                        disabled={submitting}
                                        onClick={() => setShowRejectModal(true)}
                                        className="flex-1 py-4 rounded-2xl border border-rose-500/30 text-rose-400 font-black text-xs uppercase tracking-widest hover:bg-rose-500/10 transition-colors"
                                    >
                                        Reject Request
                                    </button>
                                    <button 
                                        disabled={submitting}
                                        onClick={() => handleUpdateStatus(selectedRequest._id, 'approved')}
                                        className="flex-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-widest hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 grow"
                                    >
                                        {submitting ? 'Processing...' : (
                                            <>
                                                <CheckCircle className="w-4 h-4" /> 
                                                Confirm & Approve Payout
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {selectedRequest.status === 'rejected' && selectedRequest.rejectReason && (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                                    <p className="text-[10px] font-black mb-1 uppercase tracking-widest font-black opacity-60">Rejection Reason</p>
                                    <p className="text-sm">{selectedRequest.rejectReason}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in-95 duration-200">
                    <div className="bg-[#050510] border border-white/10 rounded-3xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-black text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                             <AlertCircle className="text-rose-500 w-5 h-5"/> Reject Withdrawal
                        </h3>
                        <textarea 
                            className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl mb-4 h-32 focus:outline-none focus:border-rose-500/50 transition-colors placeholder:text-slate-600 resize-none font-medium"
                            placeholder="Enter rejection reason for the Marchant..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 text-slate-400 font-bold hover:text-white transition-colors"
                            >
                                Back
                            </button>
                            <button 
                                disabled={submitting || !rejectReason.trim()}
                                onClick={() => handleUpdateStatus(selectedRequest._id, 'rejected', rejectReason)}
                                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Rejecting...' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
