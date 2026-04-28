import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getOpayBusiness, listOpayBusinesses, api } from '../lib/api';
import {
    Loader2, ArrowLeft, FileText, Check, X, ShieldCheck, Lock,
    Building2, MapPin, Phone, CreditCard, Globe2, ExternalLink, Copy
} from 'lucide-react';

export default function OpayBusinessDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const token = useAuthStore((s) => s.token);

    const [business, setBusiness] = useState(location.state?.business || null);
    const [loading, setLoading] = useState(!business);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [kycEditOpen, setKycEditOpen] = useState(false);
    const [kycDraft, setKycDraft] = useState(null);
    const [kycSaving, setKycSaving] = useState(false);
    const [kycSaveMsg, setKycSaveMsg] = useState({ type: '', text: '' });

    const loadBusiness = async () => {
        if (!token || !id) return;
        if (business) return;

        setLoading(true);
        setError('');
        try {
            const res = await getOpayBusiness(token, id);
            setBusiness(res.data);
        } catch (e) {
            console.error("Direct fetch failed, trying fallback list...", e);
            try {
                const res = await listOpayBusinesses(token);
                const found = res.data.find(b => b._id === id);
                if (found) {
                    setBusiness(found);
                } else {
                    throw new Error('Business not found in list');
                }
            } catch (fallbackErr) {
                setError(fallbackErr.message || 'Failed to load business details');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!business) {
            loadBusiness();
        }
    }, [id, token]);

    const refreshBusiness = async () => {
        try {
            const res = await getOpayBusiness(token, id);
            setBusiness(res.data);
        } catch (e) {
            console.error('Refresh failed', e);
        }
    };

    const handleKYCAction = async (status) => {
        if (!token || !business) return;
        if (!window.confirm(`Are you sure you want to ${status} this KYC?`)) return;

        setActionLoading(true);
        try {
            if (status === 'approved') {
                await api.post(`/api/admin/opay-businesses/${business._id}/approve`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else if (status === 'rejected') {
                await api.post(`/api/admin/opay-businesses/${business._id}/reject`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            await refreshBusiness();
        } catch (e) {
            alert('Action failed: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleReverify = async () => {
        if (!token || !business) return;
        const message = window.prompt("Enter the reason for re-verification (this will be shown to the merchant):");
        if (message === null) return;
        if (message.trim() === '') {
            alert('Please enter a valid reason.');
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/api/admin/opay-businesses/${business._id}/reverify`, { message }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refreshBusiness();
        } catch (e) {
            alert('Action failed: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(false);
        }
    };

    const toggleEnabled = async () => {
        if (!token || !business) return;
        setActionLoading(true);
        try {
            await api.post(`/api/admin/opay-businesses/${business._id}/toggle`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refreshBusiness();
        } catch (e) {
            alert('Failed to update status: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!token || !business) return;
        if (!window.confirm('Are you ABSOLUTELY SURE you want to delete this business? This action cannot be undone.')) return;

        setActionLoading(true);
        try {
            await api.delete(`/api/admin/opay-businesses/${business._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Business deleted successfully');
            navigate('/opay-business');
        } catch (e) {
            alert('Delete failed: ' + (e.response?.data?.message || e.message));
        } finally {
            setActionLoading(false);
        }
    };

    const openKycEdit = () => {
        const src = business?.kycData || {};
        setKycDraft(JSON.parse(JSON.stringify({
            company: {
                name: src.company?.name || '',
                mdName: src.company?.mdName || '',
                mdMobile: src.company?.mdMobile || '',
                dob: src.company?.dob || '',
                nidNo: src.company?.nidNo || '',
                tradeLicenseNo: src.company?.tradeLicenseNo || '',
                address: { division: src.company?.address?.division || '', district: src.company?.address?.district || '', thana: src.company?.address?.thana || '', details: src.company?.address?.details || '' },
                profilePic: src.company?.profilePic || '',
                nidFront: src.company?.nidFront || '',
                nidBack: src.company?.nidBack || '',
                tradeLicenseAttachment: src.company?.tradeLicenseAttachment || ''
            },
            primaryContact: { name: src.primaryContact?.name || '', phone: src.primaryContact?.phone || '', email: src.primaryContact?.email || '' },
            banking: src.banking ? JSON.parse(JSON.stringify(src.banking)) : [],
            mfs: src.mfs ? JSON.parse(JSON.stringify(src.mfs)) : [],
            site: { url: src.site?.url || '' }
        })));
        setKycSaveMsg({ type: '', text: '' });
        setKycEditOpen(true);
    };

    const handleKycSave = async () => {
        setKycSaving(true);
        setKycSaveMsg({ type: '', text: '' });
        try {
            await api.patch(`/api/admin/opay-businesses/${business._id}/kyc`, { kycData: kycDraft }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refreshBusiness();
            setKycSaveMsg({ type: 'success', text: 'KYC data saved successfully.' });
        } catch (e) {
            setKycSaveMsg({ type: 'error', text: e.response?.data?.message || 'Save failed.' });
        } finally {
            setKycSaving(false);
        }
    };

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
        );
    }

    if (error || !business) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
                <p className="text-lg font-bold text-rose-400 mb-2">{error || 'Business not found'}</p>
                <button
                    onClick={() => navigate('/opay-business')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to List
                </button>
            </div>
        );
    }

    const { kycData } = business;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <button
                    onClick={() => navigate('/opay-business')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all group w-fit text-sm font-bold"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to List
                </button>

                <div className="flex items-center gap-3">
                    {business.enabled ? (
                        <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-bold border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Account Active
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 px-4 py-2 bg-slate-500/10 text-slate-400 rounded-xl text-sm font-bold border border-slate-500/20">
                            <Lock className="w-4 h-4" /> Account Disabled
                        </span>
                    )}
                </div>
            </div>

            {/* Title Section */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-900/40 via-indigo-900/20 to-transparent p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-[100px]" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent mb-3">{business.name}</h1>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-300 font-medium">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 border-l-2 border-l-violet-500">
                                <Globe2 className="w-4 h-4 text-violet-400" />
                                {business.domain}
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                                <FileText className="w-4 h-4 text-sky-400" />
                                KYC Status: 
                                <span className={`uppercase tracking-widest text-[10px] font-black px-2 py-0.5 rounded border ${business.kycStatus === 'approved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                    business.kycStatus === 'pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                                    }`}>
                                    {business.kycStatus || 'None'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {business.kycStatus === 'pending' && (
                            <>
                                <button
                                    onClick={() => handleKYCAction('rejected')}
                                    disabled={actionLoading}
                                    className="px-6 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-bold transition-colors disabled:opacity-50"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleKYCAction('approved')}
                                    disabled={actionLoading}
                                    className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50"
                                >
                                    Approve Application
                                </button>
                            </>
                        )}

                        {(business.kycStatus === 'approved' || business.kycStatus === 'rejected') && (
                            <button
                                onClick={handleReverify}
                                disabled={actionLoading}
                                className="px-6 py-2.5 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold transition-colors disabled:opacity-50"
                            >
                                Request Re-verify
                            </button>
                        )}

                        <button
                            onClick={openKycEdit}
                            disabled={actionLoading}
                            className="px-6 py-2.5 rounded-xl border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 font-bold transition-colors"
                        >
                            Edit KYC Data
                        </button>

                        <button
                            onClick={toggleEnabled}
                            disabled={actionLoading}
                            className={`px-6 py-2.5 rounded-xl border font-bold transition-colors disabled:opacity-50 ${business.enabled
                                ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                        >
                            {business.enabled ? 'Disable Account' : 'Activate Account'}
                        </button>

                        <button
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="px-6 py-2.5 rounded-xl border border-red-600/30 text-red-500 hover:bg-red-600/10 font-bold transition-colors disabled:opacity-50"
                            title="Delete Business"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Admin Re-verify Message Banner */}
            {business.kycMessage && (
                <div className="flex items-start gap-4 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm shadow-lg">
                    <div className="p-2 bg-amber-500/20 rounded-xl flex-shrink-0 border border-amber-500/30">
                        <ShieldCheck className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">Re-verification Request Sent</p>
                        <p className="text-sm text-amber-200 font-medium leading-relaxed">{business.kycMessage}</p>
                    </div>
                </div>
            )}

            {/* KYC Details Grid */}
            {kycData && Object.keys(kycData).length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-8">
                        {/* Company Info */}
                        <div className="bg-gradient-to-br from-white/5 to-black/40 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <h3 className="text-xl font-bold text-violet-300 mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
                                <div className="p-2 bg-violet-500/20 rounded-xl border border-violet-500/30">
                                    <Building2 className="w-5 h-5 text-violet-400" />
                                </div>
                                Company Details
                            </h3>
                            <div className="space-y-2">
                                <DetailRow label="Company Name" value={kycData.company?.name || "N/A"} />
                                <DetailRow label="MD/Proprietor" value={kycData.company?.mdName || "N/A"} />
                                <DetailRow label="Designation" value={kycData.company?.designation || "MD"} />
                                <DetailRow label="Trade License" value={kycData.company?.tradeLicenseNo || "N/A"} />
                                <DetailRow label="NID Number" value={kycData.company?.nidNo || "N/A"} />
                                <DetailRow label="Date of Birth" value={kycData.company?.dob || "N/A"} />
                            </div>
                        </div>

                        {/* Address Info */}
                        <div className="bg-gradient-to-br from-white/5 to-black/40 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <h3 className="text-xl font-bold text-rose-300 mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
                                <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                                    <MapPin className="w-5 h-5 text-rose-400" />
                                </div>
                                Address Details
                            </h3>
                            <div className="space-y-2">
                                <DetailRow label="Division" value={kycData.company?.address?.division || "N/A"} />
                                <DetailRow label="District" value={kycData.company?.address?.district || "N/A"} />
                                <DetailRow label="Thana" value={kycData.company?.address?.thana || "N/A"} />
                                <div className="pt-4 mt-4 border-t border-white/10">
                                    <span className="block text-[10px] font-black tracking-widest text-rose-500/70 uppercase mb-2">Full Address</span>
                                    <p className="text-lg font-medium text-slate-200 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">
                                        {kycData.company?.address?.details || "No detailed address provided."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-gradient-to-br from-white/5 to-black/40 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <h3 className="text-xl font-bold text-sky-300 mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
                                <div className="p-2 bg-sky-500/20 rounded-xl border border-sky-500/30">
                                    <Phone className="w-5 h-5 text-sky-400" />
                                </div>
                                Contact Person
                            </h3>
                            <div className="space-y-2">
                                <DetailRow label="Name" value={kycData.primaryContact?.name || "N/A"} />
                                <DetailRow label="Phone" value={kycData.primaryContact?.phone || "N/A"} />
                                <DetailRow label="Email" value={kycData.primaryContact?.email || "N/A"} />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                        {/* API Access - Only if enabled */}
                        {business.enabled && (
                            <div className="bg-gradient-to-br from-black/40 to-emerald-950/20 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/20 shadow-[inset_0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] group-hover:bg-emerald-500/20 transition-colors duration-700" />
                                <h3 className="text-xl font-bold text-emerald-300 mb-6 flex items-center gap-3 pb-4 border-b border-emerald-500/10">
                                    <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    Full API Access
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <label className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-2 block">Authorized Domain</label>
                                        <div className="font-mono text-emerald-100 bg-emerald-950/50 px-4 py-3 rounded-xl border border-emerald-500/20 flex items-center justify-between shadow-inner">
                                            <span className="truncate">
                                                {business.domain && !business.domain.startsWith('temp-')
                                                    ? business.domain
                                                    : <span className="text-emerald-500/50 italic">Not Initially Set</span>
                                                }
                                            </span>
                                            <Globe2 className="w-4 h-4 text-emerald-500/50" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-2 block">API Auth Token</label>
                                        <div className="font-mono font-bold text-amber-200 bg-[#0a0500] px-4 py-3 rounded-xl border border-amber-500/30 flex items-center justify-between group/token cursor-pointer hover:border-amber-400/60 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                            onClick={() => {
                                                navigator.clipboard.writeText(business.apiToken);
                                                alert('Token copied!');
                                            }}>
                                            <span className="truncate mr-4 flex-1">{business.apiToken}</span>
                                            <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/20 group-hover/token:bg-amber-500 group-hover/token:text-white transition-all">
                                                <Copy className="w-3 h-3" /> Copy
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Financials */}
                        <div className="bg-gradient-to-br from-white/5 to-black/40 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <h3 className="text-xl font-bold text-indigo-300 mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
                                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                                    <CreditCard className="w-5 h-5 text-indigo-400" />
                                </div>
                                Financial Information
                            </h3>

                            <div className="space-y-8">
                                {/* Banking */}
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-8 h-px bg-white/10" /> Bank Accounts
                                    </h4>
                                    {kycData.banking?.length > 0 ? (
                                        <div className="space-y-4">
                                            {kycData.banking.map((b, i) => (
                                                <div key={i} className="p-5 bg-black/40 rounded-2xl border border-white/5 hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all">
                                                    <div className="space-y-2">
                                                        <DetailRow label="Bank Name" value={b.bankName} />
                                                        <DetailRow label="Account Name" value={b.accountName} />
                                                        <DetailRow label="Account No" value={b.accountNo} />
                                                        <DetailRow label="Branch Name" value={b.branchName} />
                                                        <DetailRow label="Routing No" value={b.routingNo} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="text-slate-500 italic p-4 bg-black/20 rounded-xl border border-white/5 text-center text-sm">No bank accounts added.</div>}
                                </div>

                                {/* MFS */}
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-8 h-px bg-white/10" /> Mobile Financial Services
                                    </h4>
                                    {kycData.mfs?.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            {kycData.mfs.map((m, i) => (
                                                <div key={i} className="p-5 bg-gradient-to-r from-pink-500/10 to-orange-500/5 rounded-2xl border border-pink-500/20 flex justify-between items-center group/mfs hover:border-pink-500/40 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center font-black text-pink-400">
                                                            {m.provider?.substring(0,1)}
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-slate-200 uppercase tracking-wider block">{m.provider}</span>
                                                            <span className="text-[10px] text-pink-300 font-bold uppercase tracking-widest opacity-80">{m.type}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-white font-mono text-xl tracking-widest drop-shadow-md">{m.number}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="text-slate-500 italic p-4 bg-black/20 rounded-xl border border-white/5 text-center text-sm">No MFS accounts added.</div>}
                                </div>
                            </div>

                            {/* External Web Link */}
                            {kycData.site?.url && (
                                <div className="mt-8 pt-6 border-t border-white/10">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">External Website</h4>
                                    <div className="flex items-center gap-3 p-4 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <Globe2 className="w-5 h-5 text-indigo-400" />
                                        <a href={kycData.site?.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 font-medium truncate flex-1 block">
                                            {kycData.site?.url}
                                        </a>
                                        <ExternalLink className="w-4 h-4 text-slate-500" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Documents */}
                        <div className="bg-gradient-to-br from-white/5 to-black/40 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <h3 className="text-xl font-bold text-amber-300 mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
                                <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
                                    <FileText className="w-5 h-5 text-amber-400" />
                                </div>
                                Identity Documents
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <DocPreview label="Profile Pic" url={kycData.company?.profilePic} apiUrl={API_URL} />
                                <DocPreview label="NID Front" url={kycData.company?.nidFront} apiUrl={API_URL} />
                                <DocPreview label="NID Back" url={kycData.company?.nidBack} apiUrl={API_URL} />
                                <DocPreview label="Trade License" url={kycData.company?.tradeLicenseAttachment} apiUrl={API_URL} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-3xl border border-white/5 bg-[#111] p-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <FileText className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-300 mb-2">No KYC Information</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">This user currently has no KYC data submitted for review.</p>
                </div>
            )}

            {/* KYC Edit Modal */}
            {kycEditOpen && kycDraft && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#0f1117] border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 sticky top-0 bg-[#0f1117] z-10">
                            <h2 className="text-lg font-black text-white">Edit KYC Data</h2>
                            <button onClick={() => setKycEditOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-violet-400 mb-4 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Company Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[['Company Name','name'],['MD/Proprietor','mdName'],['MD Mobile','mdMobile'],['Date of Birth','dob'],['NID / Passport No','nidNo'],['Trade License No','tradeLicenseNo']].map(([label,key]) => (
                                        <div key={key}>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</label>
                                            <input value={kycDraft.company[key]||''} onChange={e=>setKycDraft(d=>({...d,company:{...d.company,[key]:e.target.value}}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500/50"/>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-4 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Address</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    {['division','district','thana'].map(key=>(
                                        <div key={key}>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 capitalize">{key}</label>
                                            <input value={kycDraft.company.address[key]||''} onChange={e=>setKycDraft(d=>({...d,company:{...d.company,address:{...d.company.address,[key]:e.target.value}}}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-500/50"/>
                                        </div>
                                    ))}
                                </div>
                                <textarea value={kycDraft.company.address.details||''} onChange={e=>setKycDraft(d=>({...d,company:{...d.company,address:{...d.company.address,details:e.target.value}}}))} rows={2} placeholder="Detailed address" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-rose-500/50 resize-none"/>
                            </div>

                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-sky-400 mb-4 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Primary Contact</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[['Name','name'],['Phone','phone'],['Email','email']].map(([label,key])=>(
                                        <div key={key}>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</label>
                                            <input value={kycDraft.primaryContact[key]||''} onChange={e=>setKycDraft(d=>({...d,primaryContact:{...d.primaryContact,[key]:e.target.value}}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50"/>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2"><Globe2 className="w-3.5 h-3.5" /> Website</h3>
                                <input value={kycDraft.site?.url||''} onChange={e=>setKycDraft(d=>({...d,site:{url:e.target.value}}))} placeholder="https://example.com" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50"/>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Bank Accounts</h3>
                                    <button onClick={()=>setKycDraft(d=>({...d,banking:[...(d.banking||[]),{bankName:'',branchName:'',accountName:'',accountNo:'',routingNo:''}]}))} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors">+ Add Bank</button>
                                </div>
                                {(kycDraft.banking||[]).map((bank,i)=>(
                                    <div key={i} className="mb-3 p-4 bg-white/5 rounded-xl border border-white/10 relative grid grid-cols-2 gap-3">
                                        <button onClick={()=>setKycDraft(d=>({...d,banking:d.banking.filter((_,idx)=>idx!==i)}))} className="absolute top-2 right-2 text-rose-500 hover:text-rose-400 p-1"><X className="w-3.5 h-3.5"/></button>
                                        {[['Bank Name','bankName'],['Branch','branchName'],['Account Name','accountName'],['Account No','accountNo'],['Routing No','routingNo']].map(([l,k])=>(
                                            <div key={k} className={k==='routingNo'?'col-span-2':''}>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{l}</label>
                                                <input value={bank[k]||''} onChange={e=>setKycDraft(d=>{const b=[...d.banking];b[i]={...b[i],[k]:e.target.value};return{...d,banking:b};})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {!kycDraft.banking?.length && <p className="text-slate-500 text-xs italic">No bank accounts.</p>}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> MFS Accounts</h3>
                                    <button onClick={()=>setKycDraft(d=>({...d,mfs:[...(d.mfs||[]),{provider:'',type:'Personal',number:''}]}))} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors">+ Add MFS</button>
                                </div>
                                {(kycDraft.mfs||[]).map((mfs,i)=>(
                                    <div key={i} className="mb-3 p-4 bg-white/5 rounded-xl border border-white/10 relative grid grid-cols-3 gap-3">
                                        <button onClick={()=>setKycDraft(d=>({...d,mfs:d.mfs.filter((_,idx)=>idx!==i)}))} className="absolute top-2 right-2 text-rose-500 hover:text-rose-400 p-1"><X className="w-3.5 h-3.5"/></button>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Provider</label>
                                            <select value={mfs.provider||''} onChange={e=>setKycDraft(d=>{const m=[...d.mfs];m[i]={...m[i],provider:e.target.value};return{...d,mfs:m};})} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50">
                                                <option value="">Select</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="upay">Upay</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Type</label>
                                            <select value={mfs.type||'Personal'} onChange={e=>setKycDraft(d=>{const m=[...d.mfs];m[i]={...m[i],type:e.target.value};return{...d,mfs:m};})} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50">
                                                <option value="Personal">Personal</option><option value="Agent">Agent</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Number</label>
                                            <input value={mfs.number||''} onChange={e=>setKycDraft(d=>{const m=[...d.mfs];m[i]={...m[i],number:e.target.value};return{...d,mfs:m};})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
                                        </div>
                                    </div>
                                ))}
                                {!kycDraft.mfs?.length && <p className="text-slate-500 text-xs italic">No MFS accounts.</p>}
                            </div>

                            {kycSaveMsg.text && (
                                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm ${kycSaveMsg.type==='success'?'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400':'bg-rose-500/10 border border-rose-500/30 text-rose-400'}`}>
                                    {kycSaveMsg.type==='success'?<Check className="w-4 h-4"/>:<X className="w-4 h-4"/>}
                                    {kycSaveMsg.text}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5 rounded-b-2xl sticky bottom-0">
                            <button onClick={()=>setKycEditOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleKycSave} disabled={kycSaving} className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-violet-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm">
                                {kycSaving?<Loader2 className="animate-spin w-4 h-4"/>:<><Check className="w-4 h-4"/> Save KYC Data</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="flex justify-between items-center border-b border-white/5 pb-2.5 pt-1.5 last:border-0 last:pb-0 group hover:bg-white/[0.04] px-3 rounded-lg transition-colors -mx-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 w-1/3">{label}</span>
            <span className="text-sm font-bold text-slate-200 text-right w-2/3 break-words">{value}</span>
        </div>
    );
}
function DocPreview({ label, url, apiUrl }) {
    if (!url) return null;
    return (
        <a href={`${apiUrl}${url}`} target="_blank" rel="noreferrer" className="block group relative aspect-[4/3] bg-black/40 rounded-2xl overflow-hidden border border-white/10 hover:shadow-2xl hover:shadow-violet-900/20 hover:border-violet-500/30 transition-all">
            <img src={`${apiUrl}${url}`} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col justify-end h-1/2">
                <span className="text-xs font-bold text-white text-center">{label}</span>
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                    <ExternalLink className="w-6 h-6 text-white" />
                </div>
            </div>
        </a>
    )
}
