import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, Trash2, CheckCircle, AlertCircle, Loader2, Clock } from 'lucide-react';
import KYCSummary from '../components/KYCSummary';
import { api } from '../lib/api';

// Bangladesh Address Data (simplified for demo, ideally fetched or large static list)
const divisions = ["Dhaka", "Chittagong", "Rajshahi", "Khulna", "Barisal", "Sylhet", "Rangpur", "Mymensingh"];

export default function KYC() {
    const { user, token, updateUser } = useAuthStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState({
        company: {
            name: "",
            mdName: "",
            mdMobile: "",
            dob: "",
            nidNo: "",
            tradeLicenseNo: "",
            address: { division: "", district: "", thana: "", details: "" }
        },
        primaryContact: {
            isSameAsMD: false,
            name: "",
            phone: "",
            email: "", // Will auto-fill
        },
        banking: [],
        mfs: [],
        site: { url: "" }
    });

    const [files, setFiles] = useState({
        profilePic: null,
        nidFront: null,
        nidBack: null,
        tradeLicenseAttachment: null,
    });

    const [statusData, setStatusData] = useState(null);
    const [fetchingStatus, setFetchingStatus] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (user?.email) {
            setFormData(prev => ({
                ...prev,
                primaryContact: { ...prev.primaryContact, email: user.email }
            }));
        }
        fetchStatus();
    }, [user]);

    const fetchStatus = async () => {
        try {
            const res = await api.get('/opay-business/kyc/status');
            const data = res.data.data;
            setStatusData(data);

            // Populate form if data exists
            if (data.kycData) {
                setFormData(prev => ({
                    ...prev,
                    ...data.kycData,
                    // Ensure nested objects exist and merge to avoid missing fields
                    company: { ...prev.company, ...data.kycData.company },
                    primaryContact: { ...prev.primaryContact, ...data.kycData.primaryContact },
                    site: { ...prev.site, ...data.kycData.site },
                    banking: data.kycData.banking || [],
                    mfs: data.kycData.mfs || []
                }));
            }

            // Sync with global store if changed
            if (user && (user.kycStatus !== data.kycStatus || user.enabled !== data.enabled)) {
                updateUser({ kycStatus: data.kycStatus, enabled: data.enabled });
            }
        } catch (err) {
            console.error("Failed to fetch status", err);
        } finally {
            setFetchingStatus(false);
        }
    };

    const handleCompanyChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            company: { ...prev.company, [field]: value }
        }));
    };

    const handleAddressChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            company: {
                ...prev.company,
                address: { ...prev.company.address, [field]: value }
            }
        }));
    };

    const handleContactChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            primaryContact: { ...prev.primaryContact, [field]: value }
        }));
    };

    const toggleSameAsMD = (checked) => {
        if (checked) {
            setFormData(prev => ({
                ...prev,
                primaryContact: {
                    ...prev.primaryContact,
                    isSameAsMD: true,
                    name: prev.company.mdName,
                    phone: prev.company.mdMobile,
                    // keep email as user email or existing
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                primaryContact: { ...prev.primaryContact, isSameAsMD: false }
            }));
        }
    };

    const handleFileChange = (field, file) => {
        setFiles(prev => ({ ...prev, [field]: file }));
    };

    const addBank = () => {
        setFormData(prev => ({
            ...prev,
            banking: [...prev.banking, { bankName: "", branchName: "", accountName: "", accountNo: "", routingNo: "", isDefault: false }]
        }));
    };

    const removeBank = (index) => {
        setFormData(prev => ({
            ...prev,
            banking: prev.banking.filter((_, i) => i !== index)
        }));
    };

    const updateBank = (index, field, value) => {
        const newBanking = [...formData.banking];
        newBanking[index][field] = value;
        setFormData(prev => ({ ...prev, banking: newBanking }));
    };

    const addMfs = () => {
        setFormData(prev => ({
            ...prev,
            mfs: [...prev.mfs, { provider: "", number: "", type: "Personal", isDefault: false }]
        }));
    };

    const removeMfs = (index) => {
        setFormData(prev => ({
            ...prev,
            mfs: prev.mfs.filter((_, i) => i !== index)
        }));
    };

    const updateMfs = (index, field, value) => {
        const newMfs = [...formData.mfs];
        newMfs[index][field] = value;
        setFormData(prev => ({ ...prev, mfs: newMfs }));
    };

    const handleCancel = async () => {
        if (!window.confirm("Are you sure you want to cancel your application? This action cannot be undone.")) return;

        try {
            setLoading(true);
            await api.post('/opay-business/kyc/cancel');
            setSuccess("Application Cancelled.");
            updateUser({ kycStatus: 'not_submitted' });
            setStatusData(prev => ({ ...prev, kycStatus: 'not_submitted' }));
            setIsEditing(false);
            window.scrollTo(0, 0);
        } catch (err) {
            setError(err.response?.data?.message || "Cancellation Failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Basic Validation
        if (formData.banking.length === 0 && formData.mfs.length === 0) {
            setError("Please add at least one Bank Account or MFS Account.");
            setLoading(false);
            return;
        }
        if (!formData.site.url) {
            setError("Website URL is required.");
            setLoading(false);
            return;
        }

        // File Validation: Check if new file selected OR existing file path exists
        const hasProfile = files.profilePic || formData.company.profilePic;
        const hasNidFront = files.nidFront || formData.company.nidFront;
        const hasNidBack = files.nidBack || formData.company.nidBack;

        if (!hasProfile || !hasNidFront || !hasNidBack) {
            setError("Please upload Profile Picture, NID Front and NID Back.");
            setLoading(false);
            return;
        }

        const data = new FormData();
        data.append('data', JSON.stringify(formData));

        // Append files
        Object.keys(files).forEach(key => {
            if (files[key]) data.append(key, files[key]);
        });

        try {
            await api.post('/opay-business/kyc/submit', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setSuccess("KYC Submitted Successfully! Pending Approval.");
            updateUser({ kycStatus: 'pending' }); // Update store immediately
            setIsEditing(false);
            fetchStatus(); // Refresh status
            window.scrollTo(0, 0);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Submission Failed");
        } finally {
            setLoading(false);
        }
    };

    if (fetchingStatus) {
        [
            {
                "StartLine": 258,
                "EndLine": 258,
                "TargetContent": "        return <div className=\"flex justify-center items-center h-96\"><Loader2 className=\"animate-spin text-violet-600 w-8 h-8\" /></div>;",
                "ReplacementContent": "        return <div className=\"flex justify-center items-center h-96\"><Loader2 className=\"animate-spin text-brand-accent w-8 h-8\" /></div>;",
                "AllowMultiple": false
            },
            {
                "StartLine": 305,
                "EndLine": 307,
                "TargetContent": "                        <button onClick={() => setIsEditing(true)} className=\"px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors\">\n                            Edit Application\n                        </button>",
                "ReplacementContent": "                        <button onClick={() => setIsEditing(true)} className=\"px-4 py-2 text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-lg transition-colors\">\n                            Edit Application\n                        </button>",
                "AllowMultiple": false
            },
            {
                "StartLine": 319,
                "EndLine": 319,
                "TargetContent": "            <h1 className=\"text-3xl font-bold mb-8 text-slate-900\">KYC Verification</h1>",
                "ReplacementContent": "            <h1 className=\"text-3xl font-bold mb-8 text-brand-primary\">KYC Verification</h1>",
                "AllowMultiple": false
            },
            {
                "StartLine": 348,
                "EndLine": 348,
                "TargetContent": "                    <h2 className=\"text-xl font-bold text-violet-700 border-b border-slate-100 pb-4\">1. Company Profile Information</h2>",
                "ReplacementContent": "                    <h2 className=\"text-xl font-bold text-brand-primary border-b border-slate-100 pb-4\">1. Company Profile Information</h2>",
                "AllowMultiple": false
            },
            {
                "StartLine": 353,
                "EndLine": 353,
                "TargetContent": "                            <input type=\"text\" required className=\"w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20\"",
                "ReplacementContent": "                            <input type=\"text\" required className=\"w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20\"",
                "AllowMultiple": true
            },
            {
                "StartLine": 436,
                "EndLine": 436,
                "TargetContent": "                        <h2 className=\"text-xl font-bold text-violet-700\">2. Primary Contact Information</h2>",
                "ReplacementContent": "                        <h2 className=\"text-xl font-bold text-brand-primary\">2. Primary Contact Information</h2>",
                "AllowMultiple": false
            },
            {
                "StartLine": 438,
                "EndLine": 438,
                "TargetContent": "                            <input type=\"checkbox\" id=\"sameAsMD\" className=\"w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500\"",
                "ReplacementContent": "                            <input type=\"checkbox\" id=\"sameAsMD\" className=\"w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent\"",
                "AllowMultiple": false
            },
            {
                "StartLine": 466,
                "EndLine": 466,
                "TargetContent": "                        <h2 className=\"text-xl font-bold text-violet-700\">3. Banking Information</h2>",
                "ReplacementContent": "                        <h2 className=\"text-xl font-bold text-brand-primary\">3. Banking Information</h2>",
                "AllowMultiple": false
            },
            {
                "StartLine": 467,
                "EndLine": 467,
                "TargetContent": "                        <button type=\"button\" onClick={addBank} className=\"flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm shadow-violet-200\">",
                "ReplacementContent": "                        <button type=\"button\" onClick={addBank} className=\"flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium text-sm transition-colors shadow-sm\">",
                "AllowMultiple": false
            },
            {
                "StartLine": 477,
                "EndLine": 477,
                "TargetContent": "                            <input placeholder=\"Bank Name\" className=\"bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400\"",
                "ReplacementContent": "                            <input placeholder=\"Bank Name\" className=\"bg-transparent border-b border-slate-300 focus:border-brand-accent outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400\"",
                "AllowMultiple": true
            },
            {
                "StartLine": 495,
                "EndLine": 495,
                "TargetContent": "                        <h2 className=\"text-xl font-bold text-violet-700\">4. Mobile Banking (MFS) Information</h2>",
                "ReplacementContent": "                        <h2 className=\"text-xl font-bold text-brand-primary\">4. Mobile Banking (MFS) Information</h2>",
                "AllowMultiple": false
            },
            {
                "StartLine": 496,
                "EndLine": 496,
                "TargetContent": "                        <button type=\"button\" onClick={addMfs} className=\"flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm shadow-violet-200\">",
                "ReplacementContent": "                        <button type=\"button\" onClick={addMfs} className=\"flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium text-sm transition-colors shadow-sm\">",
                "AllowMultiple": false
            },
            {
                "StartLine": 506,
                "EndLine": 506,
                "TargetContent": "                            <select className=\"bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900\"",
                "ReplacementContent": "                            <select className=\"bg-transparent border-b border-slate-300 focus:border-brand-accent outline-none p-2 text-sm text-slate-900\"",
                "AllowMultiple": true
            },
            {
                "StartLine": 530,
                "EndLine": 530,
                "TargetContent": "                    <h2 className=\"text-xl font-bold text-violet-700 border-b border-slate-100 pb-4\">5. Site Information</h2>",
                "ReplacementContent": "                    <h2 className=\"text-xl font-bold text-brand-primary border-b border-slate-100 pb-4\">5. Site Information</h2>",
                "AllowMultiple": false
            },
            {
                "StartLine": 542,
                "EndLine": 542,
                "TargetContent": "                        className=\"px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-violet-600/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2\"",
                "ReplacementContent": "                        className=\"px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-accent rounded-xl font-bold text-white hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2\"",
                "AllowMultiple": false
            },
            {
                "StartLine": 566,
                "EndLine": 566,
                "TargetContent": "            <div className={`relative border-2 border-dashed ${fileName || existingFile ? 'border-violet-500/50 bg-violet-50' : 'border-slate-300 hover:border-violet-500/50 hover:bg-slate-50'} rounded-xl p-4 transition-colors group cursor-pointer`}>",
                "ReplacementContent": "            <div className={`relative border-2 border-dashed ${fileName || existingFile ? 'border-brand-accent/50 bg-brand-accent/5' : 'border-slate-300 hover:border-brand-accent/50 hover:bg-slate-50'} rounded-xl p-4 transition-colors group cursor-pointer`}>",
                "AllowMultiple": false
            },
            {
                "StartLine": 568,
                "EndLine": 568,
                "TargetContent": "                <div className=\"flex flex-col items-center justify-center text-slate-500 group-hover:text-violet-600 transition-colors\">",
                "ReplacementContent": "                <div className=\"flex flex-col items-center justify-center text-slate-500 group-hover:text-brand-accent transition-colors\">",
                "AllowMultiple": false
            },
            {
                "StartLine": 577,
                "EndLine": 577,
                "TargetContent": "                            <CheckCircle className=\"w-8 h-8 mb-2 text-violet-500\" />",
                "ReplacementContent": "                            <CheckCircle className=\"w-8 h-8 mb-2 text-brand-accent\" />",
                "AllowMultiple": false
            }
        ]
    }

    // Show Status View if Submitted/Approved
    const status = statusData?.kycStatus;

    // VIEW: Approved - read-only KYC info + banking edit modal
    if (status === 'approved') {
        const kyc = formData;
        const company = kyc.company || {};
        const contact = kyc.primaryContact || {};
        const addr = company.address || {};
        const API_URL = import.meta.env.VITE_API_URL || '';

        const ReadRow = ({ label, value }) => (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider sm:w-40 flex-shrink-0">{label}</span>
                <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
            </div>
        );

        return (
            <div className="max-w-3xl mx-auto py-8 space-y-6">
                {/* Verified Header */}
                <div className="p-6 rounded-2xl border bg-emerald-50 border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-100 flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-emerald-800">KYC Verified</h2>
                            <p className="text-emerald-700 text-sm">Your account is fully verified. Banking info can be updated below.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setError(''); setSuccess(''); setIsEditing(true); }}
                            className="px-5 py-2 rounded-lg font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors text-sm whitespace-nowrap"
                        >
                            Edit Banking Info
                        </button>
                        <button onClick={() => navigate('/dashboard')} className="px-5 py-2 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-sm whitespace-nowrap">
                            Dashboard
                        </button>
                    </div>
                </div>

                {/* Read-only Company Info */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Company Information</h3>
                    <ReadRow label="Company Name" value={company.name} />
                    <ReadRow label="MD / Proprietor" value={company.mdName} />
                    <ReadRow label="Mobile No" value={company.mdMobile} />
                    <ReadRow label="Date of Birth" value={company.dob} />
                    <ReadRow label="NID / Passport No" value={company.nidNo} />
                    <ReadRow label="Trade License No" value={company.tradeLicenseNo} />
                    <ReadRow label="Address" value={[addr.details, addr.thana, addr.district, addr.division].filter(Boolean).join(', ')} />
                </section>

                {/* Read-only Contact Info */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Primary Contact</h3>
                    <ReadRow label="Name" value={contact.name} />
                    <ReadRow label="Phone" value={contact.phone} />
                    <ReadRow label="Email" value={contact.email} />
                </section>

                {/* Read-only Documents */}
                {(company.profilePic || company.nidFront || company.nidBack || company.tradeLicenseAttachment) && (
                    <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Documents</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Profile Pic', path: company.profilePic },
                                { label: 'NID Front', path: company.nidFront },
                                { label: 'NID Back', path: company.nidBack },
                                { label: 'Trade License', path: company.tradeLicenseAttachment },
                            ].filter(d => d.path).map(d => (
                                <a key={d.label} href={`${API_URL}${d.path}`} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                                    <img src={`${API_URL}${d.path}`} className="w-full h-20 object-cover rounded-lg" alt={d.label} />
                                    <span className="text-xs font-medium text-slate-500 group-hover:text-violet-600">{d.label}</span>
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                {/* Read-only Current Banking */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Banking & MFS Accounts</h3>
                        <button
                            onClick={() => { setError(''); setSuccess(''); setIsEditing(true); }}
                            className="text-xs font-bold text-violet-600 hover:text-violet-800 hover:underline"
                        >
                            Edit
                        </button>
                    </div>
                    {formData.banking.length === 0 && formData.mfs.length === 0 && (
                        <p className="text-sm text-slate-400 italic">No banking information on file.</p>
                    )}
                    {formData.banking.map((b, i) => (
                        <div key={i} className="py-2 border-b border-slate-100 last:border-0">
                            <p className="text-sm font-semibold text-slate-700">{b.bankName} {b.branchName && `— ${b.branchName}`}</p>
                            <p className="text-xs text-slate-400">{b.accountName} · {b.accountNo}</p>
                        </div>
                    ))}
                    {formData.mfs.map((m, i) => (
                        <div key={i} className="py-2 border-b border-slate-100 last:border-0">
                            <p className="text-sm font-semibold text-slate-700 capitalize">{m.provider} ({m.type})</p>
                            <p className="text-xs text-slate-400">{m.number}</p>
                        </div>
                    ))}
                </section>

                {/* Banking Edit MODAL */}
                {isEditing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-lg font-black text-slate-800">Edit Banking Information</h2>
                                <button onClick={() => setIsEditing(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Bank accounts */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-slate-700">Bank Accounts</h3>
                                        <button type="button" onClick={addBank} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-xs transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Add Bank
                                        </button>
                                    </div>
                                    {formData.banking.map((bank, index) => (
                                        <div key={index} className="mb-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => removeBank(index)} className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                            <input placeholder="Bank Name" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400" value={bank.bankName} onChange={(e) => updateBank(index, 'bankName', e.target.value)} />
                                            <input placeholder="Branch Name" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400" value={bank.branchName} onChange={(e) => updateBank(index, 'branchName', e.target.value)} />
                                            <input placeholder="Account Name" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400" value={bank.accountName} onChange={(e) => updateBank(index, 'accountName', e.target.value)} />
                                            <input placeholder="Account No" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400" value={bank.accountNo} onChange={(e) => updateBank(index, 'accountNo', e.target.value)} />
                                            <input placeholder="Routing No" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 col-span-2" value={bank.routingNo} onChange={(e) => updateBank(index, 'routingNo', e.target.value)} />
                                        </div>
                                    ))}
                                    {formData.banking.length === 0 && <p className="text-slate-400 text-sm italic">No bank accounts.</p>}
                                </div>

                                {/* MFS accounts */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-slate-700">MFS Accounts</h3>
                                        <button type="button" onClick={addMfs} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-xs transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Add MFS
                                        </button>
                                    </div>
                                    {formData.mfs.map((mfs, index) => (
                                        <div key={index} className="mb-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative grid grid-cols-3 gap-3">
                                            <button type="button" onClick={() => removeMfs(index)} className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                            <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-400" value={mfs.provider} onChange={(e) => updateMfs(index, 'provider', e.target.value)}>
                                                <option value="">Select MFS</option>
                                                <option value="bkash">bKash</option>
                                                <option value="nagad">Nagad</option>
                                                <option value="rocket">Rocket</option>
                                                <option value="upay">Upay</option>
                                            </select>
                                            <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-400" value={mfs.type} onChange={(e) => updateMfs(index, 'type', e.target.value)}>
                                                <option value="Personal">Personal</option>
                                                <option value="Agent">Agent</option>
                                            </select>
                                            <input placeholder="Mobile Number" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400" value={mfs.number} onChange={(e) => updateMfs(index, 'number', e.target.value)} />
                                        </div>
                                    ))}
                                    {formData.mfs.length === 0 && <p className="text-slate-400 text-sm italic">No MFS accounts.</p>}
                                </div>

                                {error && (
                                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-2 text-sm">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                                    </div>
                                )}
                                {success && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-2 text-sm">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                                <button onClick={() => { setIsEditing(false); setError(''); setSuccess(''); }} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                                    Cancel
                                </button>
                                <button
                                    disabled={loading}
                                    onClick={async () => {
                                        setLoading(true);
                                        setError('');
                                        setSuccess('');
                                        try {
                                            await api.patch('/opay-business/kyc/banking', {
                                                banking: formData.banking,
                                                mfs: formData.mfs
                                            });
                                            setSuccess('Banking information updated successfully!');
                                        } catch (err) {
                                            setError(err.response?.data?.message || 'Update failed');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-violet-600/20 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                                >
                                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <><CheckCircle className="w-4 h-4" /> Save Changes</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }


    // VIEW: Pending Strategy -> Show Summary OR Edit Form
    // If Pending AND NOT Editing -> Show Summary
    if (status === 'pending' && !isEditing) {
        return (
            <div className="max-w-4xl mx-auto py-8">
                <div className="mb-8 p-6 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-amber-900">Application Under Review</h2>
                            <p className="text-amber-700 text-sm">Your KYC application is currently pending approval.</p>
                            {statusData?.kycMessage && (
                                <div className="mt-4 p-4 rounded-xl bg-white/60 border border-amber-200 shadow-sm">
                                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">Admin Note:</p>
                                    <p className="text-sm text-amber-800 font-medium">{statusData.kycMessage}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleCancel} className="px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-100 rounded-lg transition-colors">
                            Cancel Application
                        </button>
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors">
                            Edit Application
                        </button>
                    </div>
                </div>

                {/* Summary View */}
                <KYCSummary formData={formData} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <h1 className="text-3xl font-bold mb-8 text-slate-900">KYC Verification</h1>

            {statusData?.kycMessage && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-start gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <p className="font-bold text-amber-900">Message from Admin</p>
                        <p className="text-sm mt-1">{statusData.kycMessage}</p>
                    </div>
                </div>
            )}

            {status === 'rejected' && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Application Rejected</p>
                        <p className="text-sm mt-1">Your previous application was rejected. Please review your information and submit again.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Company Information */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6">
                    <h2 className="text-xl font-bold text-violet-700 border-b border-slate-100 pb-4">1. Company Profile Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Company Name *</label>
                            <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.name} onChange={(e) => handleCompanyChange('name', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">MD/Proprietor Name *</label>
                            <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.mdName} onChange={(e) => handleCompanyChange('mdName', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">MD/Proprietor Mobile No *</label>
                            <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.mdMobile} onChange={(e) => handleCompanyChange('mdMobile', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Date of Birth *</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 cursor-pointer"
                                    onClick={(e) => e.target.showPicker()}
                                    value={formData.company.dob}
                                    onChange={(e) => handleCompanyChange('dob', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">NID/Passport No *</label>
                            <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.nidNo} onChange={(e) => handleCompanyChange('nidNo', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Trade License/Approval No</label>
                            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.tradeLicenseNo} onChange={(e) => handleCompanyChange('tradeLicenseNo', e.target.value)} />
                        </div>
                    </div>

                    {/* Address */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Division *</label>
                            <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.address.division} onChange={(e) => handleAddressChange('division', e.target.value)}>
                                <option value="">Select Division</option>
                                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">District *</label>
                            <input
                                type="text"
                                required
                                placeholder="Type District"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.address.district}
                                onChange={(e) => handleAddressChange('district', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Thana *</label>
                            <input type="text" required placeholder="Thana" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.company.address.thana} onChange={(e) => handleAddressChange('thana', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2 text-slate-700">Detail Address *</label>
                        <textarea required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 min-h-[80px]"
                            value={formData.company.address.details} onChange={(e) => handleAddressChange('details', e.target.value)} />
                    </div>

                    {/* Files */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FileInput label="Profile Picture" onChange={(e) => handleFileChange('profilePic', e.target.files[0])} required existingFile={formData.company.profilePic} />
                        <FileInput label="NID Front" onChange={(e) => handleFileChange('nidFront', e.target.files[0])} required existingFile={formData.company.nidFront} />
                        <FileInput label="NID Back" onChange={(e) => handleFileChange('nidBack', e.target.files[0])} required existingFile={formData.company.nidBack} />
                        <FileInput label="Trade License Attachment (Optional)" onChange={(e) => handleFileChange('tradeLicenseAttachment', e.target.files[0])} existingFile={formData.company.tradeLicenseAttachment} />
                    </div>
                </section>

                {/* 2. Primary Contact */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h2 className="text-xl font-bold text-violet-700">2. Primary Contact Information</h2>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="sameAsMD" className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                checked={formData.primaryContact.isSameAsMD} onChange={(e) => toggleSameAsMD(e.target.checked)} />
                            <label htmlFor="sameAsMD" className="text-sm text-slate-600 select-none cursor-pointer font-medium">Same As MD/Proprietor Information</label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Name *</label>
                            <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.primaryContact.name} onChange={(e) => handleContactChange('name', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Phone *</label>
                            <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.primaryContact.phone} onChange={(e) => handleContactChange('phone', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700">Email *</label>
                            <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                value={formData.primaryContact.email} onChange={(e) => handleContactChange('email', e.target.value)} />
                        </div>
                    </div>
                </section>

                {/* 3. Banking Information */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h2 className="text-xl font-bold text-violet-700">3. Banking Information</h2>
                        <button type="button" onClick={addBank} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm shadow-violet-200">
                            <Plus className="w-4 h-4" /> Add Bank
                        </button>
                    </div>

                    {formData.banking.map((bank, index) => (
                        <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <button type="button" onClick={() => removeBank(index)} className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 p-1">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <input placeholder="Bank Name" className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400"
                                value={bank.bankName} onChange={(e) => updateBank(index, 'bankName', e.target.value)} />
                            <input placeholder="Branch Name" className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400"
                                value={bank.branchName} onChange={(e) => updateBank(index, 'branchName', e.target.value)} />
                            <input placeholder="Account Name" className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400"
                                value={bank.accountName} onChange={(e) => updateBank(index, 'accountName', e.target.value)} />
                            <input placeholder="Account No" className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400"
                                value={bank.accountNo} onChange={(e) => updateBank(index, 'accountNo', e.target.value)} />
                            <input placeholder="Routing No" className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400"
                                value={bank.routingNo} onChange={(e) => updateBank(index, 'routingNo', e.target.value)} />
                        </div>
                    ))}
                    {formData.banking.length === 0 && <p className="text-slate-500 text-sm italic">No bank accounts added.</p>}
                </section>

                {/* 4. MFS Information */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h2 className="text-xl font-bold text-violet-700">4. Mobile Banking (MFS) Information</h2>
                        <button type="button" onClick={addMfs} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm shadow-violet-200">
                            <Plus className="w-4 h-4" /> Add MFS
                        </button>
                    </div>

                    {formData.mfs.map((mfs, index) => (
                        <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <button type="button" onClick={() => removeMfs(index)} className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 p-1">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <select className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900"
                                value={mfs.provider} onChange={(e) => updateMfs(index, 'provider', e.target.value)}>
                                <option value="">Select MFS</option>
                                <option value="bkash">bKash</option>
                                <option value="nagad">Nagad</option>
                                <option value="rocket">Rocket</option>
                                <option value="upay">Upay</option>
                            </select>

                            <select className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900"
                                value={mfs.type} onChange={(e) => updateMfs(index, 'type', e.target.value)}>
                                <option value="Personal">Personal</option>
                                <option value="Agent">Agent</option>
                            </select>

                            <input placeholder="Mobile Number" className="bg-transparent border-b border-slate-300 focus:border-violet-500 outline-none p-2 text-sm text-slate-900 placeholder:text-slate-400"
                                value={mfs.number} onChange={(e) => updateMfs(index, 'number', e.target.value)} />
                        </div>
                    ))}
                    {formData.mfs.length === 0 && <p className="text-slate-500 text-sm italic">No MFS accounts added.</p>}
                </section>

                {/* 5. Site Information */}
                <section className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6">
                    <h2 className="text-xl font-bold text-violet-700 border-b border-slate-100 pb-4">5. Site Information</h2>
                    <div>
                        <label className="block text-sm font-medium mb-2 text-slate-700">Website URL *</label>
                        <input type="url" required placeholder="https://example.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                            value={formData.site.url} onChange={(e) => setFormData(prev => ({ ...prev, site: { url: e.target.value } }))} />
                    </div>
                </section>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-violet-600/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Submit Application"}
                    </button>
                </div>

            </form>
        </div>
    );
}

function FileInput({ label, onChange, required, existingFile }) {
    const [fileName, setFileName] = useState("");

    const handleFile = (e) => {
        if (e.target.files[0]) {
            setFileName(e.target.files[0].name);
            onChange(e);
        }
    }

    return (
        <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">{label} {required && "*"}</label>
            <div className={`relative border-2 border-dashed ${fileName || existingFile ? 'border-violet-500/50 bg-violet-50' : 'border-slate-300 hover:border-violet-500/50 hover:bg-slate-50'} rounded-xl p-4 transition-colors group cursor-pointer`}>
                <input type="file" onChange={handleFile} required={required && !existingFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/png, image/jpeg, image/jpg" />
                <div className="flex flex-col items-center justify-center text-slate-500 group-hover:text-violet-600 transition-colors">
                    {fileName ? (
                        <>
                            <CheckCircle className="w-8 h-8 mb-2 text-emerald-500" />
                            <span className="text-sm font-medium text-slate-800">{fileName}</span>
                            <span className="text-xs mt-1">Click to change</span>
                        </>
                    ) : existingFile ? (
                        <>
                            <CheckCircle className="w-8 h-8 mb-2 text-violet-500" />
                            <span className="text-sm font-medium text-slate-800">File Uploaded</span>
                            <span className="text-xs mt-1">Click to replace</span>
                        </>
                    ) : (
                        <>
                            <Upload className="w-8 h-8 mb-2" />
                            <span className="text-xs font-medium">Click to upload or drag and drop</span>
                            <span className="text-[10px] mt-1 opacity-60">PNG, JPG (Max 2MB)</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}


