import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAgentApplicationDetail, updateAgentApplicationStatus, deleteAgentApplication } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { ArrowLeft, CheckCircle, XCircle, MapPin, Phone, CreditCard, FileText, User, Calendar, ExternalLink, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AgentApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to format image URLs
  const getImgUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/400?text=No+Image';
    if (path.startsWith('http')) return path;
    // Remove leading slash if any
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // If it already includes 'uploads', don't add it again
    if (cleanPath.startsWith('uploads/')) return `${API_BASE}/${cleanPath}`;
    return `${API_BASE}/uploads/${cleanPath}`;
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    try {
      const res = await getAgentApplicationDetail(token, id);
      if (res && res.data) setApp(res.data);
    } catch (error) {
      alert("Failed to load detail");
      navigate('/agent-applications');
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (status) => {
    if (!confirm(`Mark application as ${status}?`)) return;
    try {
      await updateAgentApplicationStatus(token, id, status);
      loadDetail();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this application? This action cannot be undone.")) return;
    try {
      await deleteAgentApplication(token, id);
      navigate('/agent-applications');
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete application");
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400 animate-pulse">Loading application details...</div>;
  if (!app) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Top Bar */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => navigate('/agent-applications')}
          className="p-3 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{app.name}</h1>
            {app.status === 'approved' && <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">Approved</div>}
            {app.status === 'rejected' && <div className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">Rejected</div>}
            {app.status === 'pending' && <div className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">Pending</div>}
          </div>
          <p className="text-slate-500 text-xs font-mono mt-1 flex items-center gap-2">
            <span>ID: {app._id}</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 font-bold hover:bg-rose-500/10 hover:border-rose-500/50 transition-all flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>

          {app.status === 'pending' && (
            <>
              <button
                onClick={() => handleStatus('rejected')}
                className="px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 font-bold hover:bg-rose-500/10 hover:border-rose-500/50 transition-all flex items-center gap-2 text-sm"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleStatus('approved')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 text-sm hover:scale-105 active:scale-95"
              >
                <CheckCircle className="w-4 h-4" /> Approve Agent
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Info Card */}
          <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <FileText className="w-32 h-32 text-indigo-500 transform rotate-12 translate-x-8 -translate-y-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
              <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300"><User className="w-5 h-5" /></span>
              Basic Information
            </h3>

            <div className="grid grid-cols-2 gap-y-8 gap-x-4 relative z-10">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Full Name</span>
                <span className="text-white font-medium text-lg">{app.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Service Type</span>
                <span className="text-violet-300 font-bold text-lg">{app.serviceType}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Mobile Number</span>
                <span className="text-white font-mono text-lg tracking-wide">{app.mobile}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Initial Amount</span>
                <span className="text-emerald-400 font-mono font-bold text-lg">৳ {app.initialAmount || '0'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Address</span>
                <div className="flex items-center gap-2 text-slate-300 text-lg">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  {app.upazila}, {app.district}
                </div>
              </div>
            </div>
          </div>

          {/* Capabilities Card */}
          <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-sky-500/20 text-sky-300"><CreditCard className="w-5 h-5" /></span>
              Agent Capability
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <div className={`p-4 rounded-2xl border ${app.hasBkash === 'Yes' ? 'bg-pink-500/10 border-pink-500/20' : 'bg-white/5 border-white/5'} text-center`}>
                <div className="font-bold text-white mb-1">bKash</div>
                <div className={`text-xs font-bold uppercase ${app.hasBkash === 'Yes' ? 'text-pink-400' : 'text-slate-500'}`}>{app.hasBkash === 'Yes' ? 'Available' : 'Unavailable'}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${app.hasNagad === 'Yes' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/5'} text-center`}>
                <div className="font-bold text-white mb-1">Nagad</div>
                <div className={`text-xs font-bold uppercase ${app.hasNagad === 'Yes' ? 'text-orange-400' : 'text-slate-500'}`}>{app.hasNagad === 'Yes' ? 'Available' : 'Unavailable'}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${app.hasUpay === 'Yes' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/5'} text-center`}>
                <div className="font-bold text-white mb-1">Upay</div>
                <div className={`text-xs font-bold uppercase ${app.hasUpay === 'Yes' ? 'text-blue-400' : 'text-slate-500'}`}>{app.hasUpay === 'Yes' ? 'Available' : 'Unavailable'}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${app.wantBankAgent === 'Yes' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'} text-center`}>
                <div className="font-bold text-white mb-1">Bank Agent</div>
                <div className={`text-xs font-bold uppercase ${app.wantBankAgent === 'Yes' ? 'text-emerald-400' : 'text-slate-500'}`}>{app.wantBankAgent === 'Yes' ? 'Requested' : 'No'}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${app.canBankTrx === 'Yes' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/5 border-white/5'} text-center`}>
                <div className="font-bold text-white mb-1">Bank Trx</div>
                <div className={`text-xs font-bold uppercase ${app.canBankTrx === 'Yes' ? 'text-indigo-400' : 'text-slate-500'}`}>{app.canBankTrx === 'Yes' ? 'Capable' : 'No'}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${app.canTopupMin === 'Yes' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-white/5 border-white/5'} text-center`}>
                <div className="font-bold text-white mb-1">Min Topup</div>
                <div className={`text-xs font-bold uppercase ${app.canTopupMin === 'Yes' ? 'text-teal-400' : 'text-slate-500'}`}>{app.canTopupMin === 'Yes' ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <strong className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Reason for joining</strong>
                <p className="text-slate-300 bg-black/20 p-4 rounded-xl text-sm leading-relaxed border border-white/5">
                  {app.reason || 'No reason provided.'}
                </p>
              </div>
              <div>
                <strong className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Prior Experience</strong>
                <p className="text-slate-300 bg-black/20 p-4 rounded-xl text-sm leading-relaxed border border-white/5">
                  {app.experience || 'No experience provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Documents */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-6 sticky top-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-orange-500/20 text-orange-300"><FileText className="w-5 h-5" /></span>
              Documents
            </h3>

            <div className="space-y-6">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">Applicant Photo</span>
                <div className="aspect-square bg-black/40 rounded-2xl overflow-hidden border border-white/10 relative group cursor-pointer shadow-lg">
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <ExternalLink className="text-white w-6 h-6" />
                  </div>
                  <img src={getImgUrl(app.photo)} alt="Applicant" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onClick={() => window.open(getImgUrl(app.photo), '_blank')} />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">NID Front</span>
                <div className="aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/10 relative group cursor-pointer shadow-lg">
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <ExternalLink className="text-white w-6 h-6" />
                  </div>
                  <img src={getImgUrl(app.nidFront)} alt="NID Front" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onClick={() => window.open(getImgUrl(app.nidFront), '_blank')} />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">NID Back</span>
                <div className="aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/10 relative group cursor-pointer shadow-lg">
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <ExternalLink className="text-white w-6 h-6" />
                  </div>
                  <img src={getImgUrl(app.nidBack)} alt="NID Back" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onClick={() => window.open(getImgUrl(app.nidBack), '_blank')} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
