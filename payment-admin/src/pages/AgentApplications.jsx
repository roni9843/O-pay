import React, { useEffect, useState } from 'react';
import { getAgentApplications, deleteAgentApplication } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Search, Eye, Filter, CheckCircle, XCircle, Clock, Trash2, Shield, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AgentApplications() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);

  // Helper to format image URLs
  const getImgUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    // Remove leading slash if any
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // If it already includes 'uploads', don't add it again
    if (cleanPath.startsWith('uploads/')) return `${API_BASE}/${cleanPath}`;
    return `${API_BASE}/uploads/${cleanPath}`;
  };

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setLoading(true);
    try {
      const res = await getAgentApplications(token);
      if (res && res.data) {
        setApps(res.data);
      }
    } catch (error) {
      console.error(error);
      // alert(error.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this application? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteAgentApplication(token, id);
      await deleteAgentApplication(token, id);
      setApps(prev => prev.filter(a => a._id !== id));
      if (selectedApp?._id === id) setSelectedApp(null);
      // Optional: Show success toast
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete application");
    }
  };

  const filteredApps = apps.filter(app => filterStatus === 'all' || app.status === filterStatus);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> APPROVED</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> REJECTED</span>;
      default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> PENDING</span>;
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />

        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Agent Applications
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Review and manage new wallet agent registration requests.
          </p>
        </div>

        <div className="relative z-10 flex gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 backdrop-blur-md">
          {['all', 'pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === status
                ? 'bg-violet-600/90 text-white shadow-lg shadow-violet-900/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading applications...</div>
          ) : filteredApps.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No applications found.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider w-12">#</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Applicant & Service</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Contact & Location</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Business Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Wallets</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredApps.map((app, index) => (
                  <React.Fragment key={app._id}>
                    <tr
                      onClick={() => setSelectedApp(selectedApp?._id === app._id ? null : app)}
                      className={`transition-colors group cursor-pointer border-b border-white/5 ${selectedApp?._id === app._id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/20 flex-shrink-0 overflow-hidden">
                            {app.photo ? (
                              <img src={getImgUrl(app.photo)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              app.name?.[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{app.name}</div>
                            <div className="text-[10px] text-violet-300 font-medium px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/10 inline-block mt-0.5">
                              {app.serviceType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs space-y-1">
                        <div className="font-mono text-slate-300">{app.mobile}</div>
                        <div className="text-slate-500">{app.upazila}, {app.district}</div>
                      </td>
                      <td className="px-6 py-4 text-xs space-y-1">
                        <div className="text-slate-300"><span className="text-slate-500">Exp:</span> {app.experience || 'N/A'}</div>
                        <div className="text-slate-300"><span className="text-slate-500">Amount:</span> {app.initialAmount || 'N/A'}</div>
                        <div className="text-slate-500 italic line-clamp-1">{app.reason}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {app.hasBkash === 'Yes' && <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px] border border-pink-500/20">bKash</span>}
                          {app.hasNagad === 'Yes' && <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] border border-orange-500/20">Nagad</span>}
                          {app.hasUpay === 'Yes' && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] border border-blue-500/20">Upay</span>}
                          {app.wantBankAgent === 'Yes' && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/20">Bank</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {getStatusBadge(app.status)}
                          <div className="text-[10px] text-slate-500">{new Date(app.submittedAt).toLocaleDateString()}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/agent-applications/${app._id}`); }}
                            className="p-2 rounded-xl bg-white/5 hover:bg-violet-600 hover:text-white text-slate-400 transition-all group-hover:shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                            title="View Full Details Page"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(app._id, e)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500 hover:text-white text-slate-400 transition-all hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                            title="Delete Application"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row (Text Only) */}
                    {selectedApp?._id === app._id && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan="7" className="px-6 py-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">

                            {/* Group 1: Joining Reason */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Joining Reason
                              </h4>
                              <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {app.reason || 'No reason provided.'}
                              </div>
                            </div>

                            {/* Group 2: Detailed Stats */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <Smartphone className="w-3.5 h-3.5" /> Application Metadata
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                  <span className="block text-[10px] text-slate-500 mb-0.5">Experience</span>
                                  <span className="text-sm text-white font-medium">{app.experience || 'N/A'}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                  <span className="block text-[10px] text-slate-500 mb-0.5">Initial Amount</span>
                                  <span className="text-sm text-white font-medium">{app.initialAmount || 'N/A'}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/20 border border-white/5 col-span-2">
                                  <span className="block text-[10px] text-slate-500 mb-0.5">Full Address</span>
                                  <span className="text-sm text-slate-300">{app.upazila}, {app.district}</span>
                                </div>
                              </div>
                            </div>

                            {/* Group 3: Features & Capabilities */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5" /> Capabilities
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {app.canBankTrx === 'Yes' && <span className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">Can do Bank Trx</span>}
                                {app.canTopupMin === 'Yes' && <span className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-bold border border-teal-500/20">Can Topup Minimum</span>}
                                {app.wantBankAgent === 'Yes' && <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">Wants Bank Agent</span>}
                                <span className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs font-bold border border-white/10">Service: {app.serviceType}</span>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
