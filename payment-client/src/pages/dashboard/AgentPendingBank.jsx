import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export default function AgentPendingBank() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProof, setSelectedProof] = useState(null);
  const [actionId, setActionId] = useState(null);

  const [supportedBanks, setSupportedBanks] = useState([]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const [res, banksRes] = await Promise.all([
        api.getAgentPendingBankPayments(token, activeTab),
        api.getSupportedBanks().catch(() => ({ data: [] }))
      ]);
      if (res.success) {
        setSessions(res.data || []);
      }
      if (banksRes && Array.isArray(banksRes.data)) {
        setSupportedBanks(banksRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPayments();
  }, [token, activeTab]);

  const handleAccept = async (code) => {
    if (!window.confirm('Confirm that you have received this bank payment?')) return;
    setActionId(code);
    try {
      const res = await api.acceptPendingBankPayment(token, code);
      if (res.success) {
        alert('Payment approved successfully!');
        fetchPayments();
      }
    } catch (err) {
      alert(err.message || 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (code) => {
    if (!window.confirm('Are you sure you want to REJECT this bank payment proof?')) return;
    setActionId(code);
    try {
      const res = await api.rejectPendingBankPayment(token, code);
      if (res.success) {
        alert('Payment rejected!');
        fetchPayments();
      }
    } catch (err) {
      alert(err.message || 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bank Payments Terminal</h1>
          <p className="text-sm text-gray-400 mt-1">Review bank transfer screenshot proofs, approve payments, and track history.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-gray-900 p-1.5 rounded-2xl border border-gray-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending Approvals
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Bank Payments History
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="py-16 text-center text-gray-400 font-medium">Loading bank payments...</div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-medium">
            {activeTab === 'pending' ? 'No pending bank payments for your accounts.' : 'No bank payment history recorded yet.'}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-black/40 text-xs uppercase font-bold text-gray-400">
                    <th className="p-4">Session Code & Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Bank & Account Details</th>
                    <th className="p-4">Proof Screenshots</th>
                    <th className="p-4 text-right">Status / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sessions.map((s) => {
                    const bd = s.bankDetails || {};
                    const proofUrls = Array.isArray(bd.proofUrls) && bd.proofUrls.length > 0 ? bd.proofUrls : (bd.proofUrl ? [bd.proofUrl] : []);

                    const matchedBank = supportedBanks.find(
                      b => b.name?.toLowerCase().trim() === bd.bankName?.toLowerCase().trim()
                    );
                    let rawLogo = matchedBank?.logo || bd.bankLogo;
                    if (rawLogo && !rawLogo.startsWith('http')) {
                      const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
                      rawLogo = `${base}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`;
                    }

                    return (
                      <tr key={s._id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="p-4 font-mono">
                          <div className="font-bold text-white text-base">{s.code}</div>
                          <div className="text-xs text-gray-400 mt-1">{new Date(s.createdAt).toLocaleString()}</div>
                        </td>
                        <td className="p-4 font-black text-emerald-400 text-lg">
                          ৳{s.amount?.toLocaleString()}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            {rawLogo ? (
                              <div className="w-8 h-8 rounded-xl bg-white border border-gray-700 p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <img src={rawLogo} alt={bd.bankName} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-base flex-shrink-0">
                                🏦
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white text-sm">{bd.bankName || 'Bank Transfer'}</div>
                              <div className="text-xs text-indigo-300 font-mono">Acc: {bd.accountNumber || 'N/A'}</div>
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1 pl-10">{bd.accountHolderName}</div>
                        </td>
                        <td className="p-4">
                          {proofUrls.length > 0 ? (
                            <div className="flex gap-2">
                              {proofUrls.map((url, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedProof(url)}
                                  className="w-12 h-12 rounded-xl border border-gray-700 bg-black overflow-hidden hover:scale-105 transition-transform relative group"
                                >
                                  <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">🔍</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 italic">No Screenshot</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {activeTab === 'pending' ? (
                            <div className="space-x-2">
                              <button
                                disabled={actionId === s.code}
                                onClick={() => handleAccept(s.code)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
                              >
                                Approve
                              </button>
                              <button
                                disabled={actionId === s.code}
                                onClick={() => handleReject(s.code)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                              s.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {s.status === 'paid' ? 'Approved & Credited' : 'Rejected & Cancelled'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-gray-800">
              {sessions.map((s) => {
                const bd = s.bankDetails || {};
                const proofUrls = Array.isArray(bd.proofUrls) && bd.proofUrls.length > 0 ? bd.proofUrls : (bd.proofUrl ? [bd.proofUrl] : []);

                const matchedBank = supportedBanks.find(
                  b => b.name?.toLowerCase().trim() === bd.bankName?.toLowerCase().trim()
                );
                let rawLogo = matchedBank?.logo || bd.bankLogo;
                if (rawLogo && !rawLogo.startsWith('http')) {
                  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
                  rawLogo = `${base}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`;
                }

                return (
                  <div key={s._id} className="p-4 space-y-3.5 bg-gray-900/80">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Session Code</span>
                        <span className="font-mono font-bold text-white text-sm">#{s.code}</span>
                      </div>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        ৳{s.amount?.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-gray-800">
                      {rawLogo ? (
                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-700 p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <img src={rawLogo} alt={bd.bankName} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-lg flex-shrink-0">
                          🏦
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-white text-sm truncate">{bd.bankName || 'Bank Transfer'}</h4>
                        <div className="text-xs text-indigo-300 font-mono font-semibold truncate">Acc: {bd.accountNumber || 'N/A'}</div>
                        <div className="text-[11px] text-gray-400 truncate">{bd.accountHolderName}</div>
                      </div>
                    </div>

                    {proofUrls.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Proof Screenshot(s):</span>
                        <div className="flex flex-wrap gap-2">
                          {proofUrls.map((url, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedProof(url)}
                              className="w-14 h-14 rounded-xl border border-gray-700 bg-black overflow-hidden relative group"
                            >
                              <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-[9px] text-white font-bold">🔍 Zoom</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-mono">{new Date(s.createdAt).toLocaleString()}</span>
                      {activeTab === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={actionId === s.code}
                            onClick={() => handleReject(s.code)}
                            className="px-3.5 py-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all"
                          >
                            Reject
                          </button>
                          <button
                            disabled={actionId === s.code}
                            onClick={() => handleAccept(s.code)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                          >
                            Approve
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border ${
                          s.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {s.status === 'paid' ? 'Approved & Credited' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Screenshot Zoom Modal */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedProof(null)}>
          <div className="bg-gray-900 rounded-3xl max-w-2xl w-full p-5 relative border border-gray-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <h3 className="font-bold text-white text-base">Payment Screenshot Proof</h3>
              <button onClick={() => setSelectedProof(null)} className="text-gray-400 hover:text-white font-bold text-xl px-2">✕</button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto flex justify-center bg-black rounded-2xl p-2 border border-gray-800">
              <img src={selectedProof} alt="Proof" className="max-w-full h-auto object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
