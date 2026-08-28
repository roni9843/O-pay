import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Check, X, Loader2, ExternalLink, Image as ImageIcon } from 'lucide-react';

export default function PendingBankPayments() {
  const { token } = useAuthStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [selectedProof, setSelectedProof] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.getPendingBankPayments(token);
      if (res.success) {
        setSessions(res.data || []);
      }
    } catch (err) {
      toast.error('Failed to load pending bank payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPending();
  }, [token]);

  const handleAccept = async (code) => {
    if (!window.confirm('Are you sure you want to ACCEPT and APPROVE this bank transfer?')) return;
    setActionId(code);
    try {
      const res = await api.acceptPendingBankPayment(token, code);
      if (res.success) {
        toast.success('Bank payment accepted!');
        fetchPending();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to accept payment');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (code) => {
    if (!window.confirm('Are you sure you want to REJECT this bank transfer?')) return;
    setActionId(code);
    try {
      const res = await api.rejectPendingBankPayment(token, code);
      if (res.success) {
        toast.success('Bank payment rejected');
        fetchPending();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reject payment');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Landmark className="w-7 h-7 text-indigo-600" />
            Pending Bank Payments
          </h1>
          <p className="text-sm text-slate-500 font-medium">Review customer bank transfer screenshot proofs and approve payments.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Landmark className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No pending bank payments at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="p-4">Session & Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Bank & Account Target</th>
                  <th className="p-4">Screenshot Proof</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {sessions.map((s) => {
                  const bd = s.bankDetails || {};
                  return (
                    <tr key={s._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{s.code}</div>
                        <div className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="p-4 font-black text-indigo-600 text-base">
                        ৳{s.amount?.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{bd.bankName || 'Bank Transfer'}</div>
                        <div className="text-xs text-slate-500 font-mono">Acc: {bd.accountNumber || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">{bd.accountHolderName || ''}</div>
                      </td>
                      <td className="p-4">
                        {bd.proofUrl ? (
                          <button
                            onClick={() => setSelectedProof(bd.proofUrl)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            <ImageIcon className="w-4 h-4" />
                            View Proof
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No Proof</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={actionId === s.code}
                            onClick={() => handleAccept(s.code)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" /> Accept
                          </button>
                          <button
                            disabled={actionId === s.code}
                            onClick={() => handleReject(s.code)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof Modal */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedProof(null)}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-bold text-slate-800 text-base">Screenshot Proof</h3>
              <button onClick={() => setSelectedProof(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto flex justify-center bg-slate-900 rounded-xl p-2">
              <img src={selectedProof} alt="Proof" className="max-w-full h-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
