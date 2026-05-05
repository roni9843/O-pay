import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { CheckCircle, XCircle, Clock, Eye, AlertCircle, X, Search, Filter } from 'lucide-react';

export default function TopupRequests() {
  const token = useAuthStore(s => s.token);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE}${path}`;
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.getCreditTopupRequests(token);
      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
      // Removed alert for cleaner UX, could add toast later
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this request? User's credit will be updated instantly.")) return;
    try {
      await api.updateCreditTopupRequestStatus(token, id, 'approved');
      loadRequests();
      setSelectedRequest(null);
    } catch (err) {
      alert(err.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return alert('Please provide a reason');
    try {
      await api.updateCreditTopupRequestStatus(token, selectedRequest._id, 'rejected', rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      alert(err.message || 'Failed to reject');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3 h-3"/> Approved</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3"/> Rejected</span>;
      default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3"/> Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
             <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
               Topup Requests
             </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Manage incoming credit top-up requests from wallet agents. Review proofs and approve/reject transactions.
          </p>
        </div>

        <div className="relative z-10 flex gap-3">
           <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" /> Filter
           </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Plan / Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Method</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map(req => (
                <tr key={req._id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                           {(req.userId?.name?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                           <div className="font-medium text-white">{req.userId?.name || 'Unknown'}</div>
                           <div className="text-[11px] text-slate-400">{req.userId?.mobile || req.userId?.email}</div>
                        </div>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="font-bold text-white text-base">{req.planId?.name}</div>
                     <div className="text-xs text-emerald-400 font-mono">Credit: ৳{req.planId?.creditAmount}</div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
                        {req.methodName || 'Unknown'}
                     </span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                  <td className="px-6 py-4 text-right">
                     <button 
                       onClick={() => setSelectedRequest(req)}
                       className="p-2 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 rounded-xl transition-all"
                     >
                       <Eye size={18} />
                     </button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && !loading && (
                <tr>
                   <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      No requests found.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRequest && !showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
           <div className="bg-[#050510] border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
              
              <div className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#050510]/80 backdrop-blur-xl z-10">
                 <div>
                    <h2 className="text-xl font-bold text-white">Request Details</h2>
                    <p className="text-xs text-slate-400">Transaction ID: {selectedRequest._id.slice(-8).toUpperCase()}</p>
                 </div>
                 <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>

              <div className="p-6 space-y-6">
                 {/* Plan Summary */}
                 <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/10 p-5 rounded-2xl border border-violet-500/20">
                    <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-1">Selected Plan</div>
                    <div className="font-bold text-2xl text-white mb-2">{selectedRequest.planId?.name}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-white/10 pt-3 mt-3">
                       <div>
                          <span className="block text-[10px] text-slate-400 uppercase">Credit Added</span>
                          <span className="font-bold text-emerald-400 text-lg">৳{selectedRequest.planId?.creditAmount}</span>
                       </div>
                       <div>
                          <span className="block text-[10px] text-slate-400 uppercase">Min Credit Req</span>
                          <span className="font-bold text-amber-400 text-lg">৳{selectedRequest.planId?.minimumCredit}</span>
                       </div>
                    </div>
                 </div>
                 
                 {/* Submission Data */}
                 <div>
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                       <AlertCircle className="w-4 h-4" /> Submission Proofs
                    </h3>
                    <div className="space-y-3">
                       {selectedRequest.submissionData && Object.entries(selectedRequest.submissionData).map(([key, value]) => (
                          <div key={key} className="bg-white/5 p-4 rounded-xl border border-white/5 shadow-sm">
                             <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">{key}</div>
                             {typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:image') || value.startsWith('/uploads/')) ? (
                                <a href={getImageUrl(value)} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg">
                                   <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">View Full Image</div>
                                   <img src={getImageUrl(value)} alt="Proof" className="w-full h-auto rounded-lg max-h-48 object-cover" />
                                </a>
                             ) : (
                                <div className="font-mono text-sm break-all text-white bg-black/30 p-2 rounded border border-white/5">{value}</div>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>

                 {selectedRequest.status === 'pending' && (
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                       <button 
                         onClick={() => setShowRejectModal(true)}
                         className="flex-1 py-3 rounded-xl border border-rose-500/30 text-rose-400 font-bold hover:bg-rose-500/10 transition-colors text-sm"
                       >
                         Reject Request
                       </button>
                       <button 
                         onClick={() => handleApprove(selectedRequest._id)}
                         className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all text-sm"
                       >
                         Approve & Add Credit
                       </button>
                    </div>
                 )}
                 {selectedRequest.status === 'rejected' && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
                       <strong>Rejection Reason:</strong> {selectedRequest.rejectionReason}
                    </div>
                 )}
                 {selectedRequest.status === 'approved' && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm text-center font-medium">
                       This request has been approved.
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in zoom-in-95 duration-200">
            <div className="bg-[#050510] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
               <h3 className="text-lg font-bold text-white mb-4">Reject Request</h3>
               <textarea 
                  className="w-full p-4 border border-white/10 bg-white/5 text-white rounded-xl mb-4 h-32 outline-none focus:border-rose-500/50 focus:bg-white/10 transition-colors placeholder:text-slate-600 resize-none"
                  placeholder="Reason for rejection..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
               ></textarea>
               <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowRejectModal(false)} 
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleReject} 
                    className="px-6 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-500 shadow-lg shadow-rose-900/20 transition-all"
                  >
                    Confirm Reject
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
