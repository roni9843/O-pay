import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export default function AgentPendingBank() {
  const { token } = useAuthStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProof, setSelectedProof] = useState(null);
  const [actionId, setActionId] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.getAgentPendingBankPayments(token);
      if (res.success) {
        setSessions(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPending();
  }, [token]);

  const handleAccept = async (code) => {
    if (!window.confirm('Confirm that you have received this bank payment?')) return;
    setActionId(code);
    try {
      const res = await api.acceptPendingBankPayment(token, code);
      if (res.success) {
        alert('Payment approved!');
        fetchPending();
      }
    } catch (err) {
      alert(err.message || 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (code) => {
    if (!window.confirm('Are you sure you want to reject this payment?')) return;
    setActionId(code);
    try {
      const res = await api.rejectPendingBankPayment(token, code);
      if (res.success) {
        alert('Payment rejected!');
        fetchPending();
      }
    } catch (err) {
      alert(err.message || 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pending Bank Payments</h1>
        <p className="text-sm opacity-70">Review customer bank transfer screenshot proofs and approve payments.</p>
      </div>

      <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading pending payments...</div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No pending bank payments for your accounts.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900/50 text-xs uppercase font-bold text-gray-400">
                  <th className="p-4">Session Code & Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Bank Details</th>
                  <th className="p-4">Proof Screenshot</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {sessions.map((s) => {
                  const bd = s.bankDetails || {};
                  return (
                    <tr key={s._id} className="hover:bg-gray-750">
                      <td className="p-4 font-mono">
                        <div className="font-bold text-white">{s.code}</div>
                        <div className="text-xs opacity-60">{new Date(s.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="p-4 font-black text-emerald-400 text-base">
                        ৳{s.amount?.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white">{bd.bankName || 'Bank'}</div>
                        <div className="text-xs opacity-70 font-mono">Acc: {bd.accountNumber}</div>
                        <div className="text-[10px] opacity-50">{bd.accountHolderName}</div>
                      </td>
                      <td className="p-4">
                        {bd.proofUrl ? (
                          <button
                            onClick={() => setSelectedProof(bd.proofUrl)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                          >
                            View Screenshot
                          </button>
                        ) : (
                          <span className="text-xs opacity-50 italic">No Screenshot</span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          disabled={actionId === s.code}
                          onClick={() => handleAccept(s.code)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                        >
                          Approve
                        </button>
                        <button
                          disabled={actionId === s.code}
                          onClick={() => handleReject(s.code)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                        >
                          Reject
                        </button>
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedProof(null)}>
          <div className="bg-gray-900 rounded-2xl max-w-xl w-full p-4 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
              <h3 className="font-bold text-white text-base">Screenshot Proof</h3>
              <button onClick={() => setSelectedProof(null)} className="text-gray-400 hover:text-white font-bold text-xl">✕</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto flex justify-center bg-black rounded-xl p-2">
              <img src={selectedProof} alt="Proof" className="max-w-full h-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
