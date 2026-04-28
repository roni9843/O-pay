import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { CreditCard, Loader2 } from 'lucide-react';

export default function CreditHistory() {
  const token = useAuthStore((s) => s.token);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewRequest, setViewRequest] = useState(null); // State for viewing details

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE}${path}`;
  };

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const requestsRes = await api.getMyCreditTopupRequests(token);
        setRequests(requestsRes.data || []);
      } catch (err) {
        setError(err.message || "Failed to load history");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchHistory();
  }, [token]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
             <h1 className="text-3xl font-bold text-gray-900">Credit History</h1>
             <p className="text-gray-500 mt-1">Track your credit top-up requests and status.</p>
           </div>
        </div>

        {loading ? (
           <div className="flex justify-center items-center h-64">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
           </div>
        ) : error ? (
           <div className="text-center p-10 bg-red-50 rounded-3xl border border-red-100 text-red-600">
              {error}
           </div>
        ) : requests.length === 0 ? (
           <div className="text-center p-16 bg-white rounded-3xl border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CreditCard className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No History Found</h3>
              <p className="text-gray-500">You haven't made any credit top-up requests yet.</p>
           </div>
        ) : (
           <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
               {/* Mobile View: Cards */}
               <div className="md:hidden divide-y divide-gray-100">
                  {requests.map(req => (
                     <div 
                       key={req._id} 
                       onClick={() => setViewRequest(req)}
                       className="p-4 flex flex-col gap-3 active:bg-gray-50 transition-colors cursor-pointer"
                     >
                        <div className="flex justify-between items-start">
                           <div>
                              <div className="font-bold text-gray-900">{req.planId?.name || 'Unknown Plan'}</div>
                              <div className="text-xs text-indigo-600 font-bold">৳{req.planId?.creditAmount?.toLocaleString()}</div>
                           </div>
                           <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${
                              req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              req.status === 'rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                              'bg-amber-100 text-amber-700 border-amber-200'
                           }`}>
                              {req.status}
                           </span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-500 pt-1">
                           <span>{req.methodName}</span>
                           <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                     </div>
                  ))}
               </div>

               {/* Desktop View: Table */}
               <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-gray-50/50 border-b border-gray-200">
                        <tr>
                           <th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Plan</th>
                           <th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Amount</th>
                           <th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Method</th>
                           <th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Date</th>
                           <th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs text-right">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {requests.map(req => (
                           <tr 
                             key={req._id} 
                             onClick={() => setViewRequest(req)}
                             className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                           >
                              <td className="px-6 py-4 font-bold text-gray-900">{req.planId?.name || 'Unknown Plan'}</td>
                              <td className="px-6 py-4 text-indigo-600 font-bold">৳{req.planId?.creditAmount?.toLocaleString()}</td>
                              <td className="px-6 py-4 text-gray-600 font-medium">{req.methodName}</td>
                              <td className="px-6 py-4 text-gray-500 text-sm">
                                 {new Date(req.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    req.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                    'bg-amber-50 text-amber-700 border-amber-100'
                                 }`}>
                                    {req.status}
                                 </span>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
           </div>
        )}
      </div>

      {/* Request Details Modal */}
      {viewRequest && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto transform transition-all animate-in slide-in-from-bottom duration-300">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                  <div>
                     <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
                     <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        Status: 
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${
                           viewRequest.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                           viewRequest.status === 'rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                           'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                           {viewRequest.status}
                        </span>
                     </p>
                  </div>
                  <button onClick={() => setViewRequest(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                     <CreditCard size={20} />
                  </button>
               </div>

               <div className="p-6 space-y-6">
                  {/* Rejection Reason (if any) */}
                  {viewRequest.status === 'rejected' && viewRequest.rejectionReason && (
                     <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-rose-800">
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-rose-600">Rejection Reason</label>
                        <p className="font-medium">{viewRequest.rejectionReason}</p>
                     </div>
                  )}

                  {/* Plan Info */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <label className="text-xs font-bold uppercase tracking-wider block mb-3 text-gray-500">Plan Information</label>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <div className="text-xs text-gray-400">Plan Name</div>
                            <div className="font-bold text-gray-900">{viewRequest.planId?.name}</div>
                         </div>
                         <div>
                            <div className="text-xs text-gray-400">Credit Amount</div>
                            <div className="font-bold text-indigo-600">৳{viewRequest.planId?.creditAmount?.toLocaleString()}</div>
                         </div>
                      </div>
                  </div>

                  {/* Submitted Data */}
                  <div>
                     <label className="text-xs font-bold uppercase tracking-wider block mb-3 text-gray-500">Submitted Proofs</label>
                     <div className="space-y-4">
                        {Object.entries(viewRequest.submissionData || {}).map(([key, value]) => (
                           <div key={key} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{key}</div>
                              {typeof value === 'string' && (value.startsWith('http') || value.startsWith('/uploads')) ? (
                                 <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                                    <img src={getImageUrl(value)} alt={key} className="w-full h-auto max-h-60 object-contain" />
                                 </div>
                              ) : (
                                 <div className="font-mono text-gray-900 bg-gray-50 p-2 rounded border border-gray-100 break-all">{value}</div>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
               
               <div className="p-6 border-t border-gray-100">
                  <button 
                    onClick={() => setViewRequest(null)}
                    className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                  >
                    Close Details
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
