import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getPendingBankPayments, acceptPendingBankPayment, rejectPendingBankPayment, getBankList } from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Check, X, Loader2, Image as ImageIcon, Calendar } from 'lucide-react';

export default function PendingBankPayments() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [selectedProof, setSelectedProof] = useState(null);
  const [supportedBanks, setSupportedBanks] = useState([]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = activeTab === 'history' ? { status: 'history' } : {};
      const [res, banksRes] = await Promise.all([
        getPendingBankPayments(token, params),
        getBankList(token).catch(() => ({ data: [] }))
      ]);
      if (res.success) {
        setSessions(res.data || []);
      }
      if (banksRes && Array.isArray(banksRes.data)) {
        setSupportedBanks(banksRes.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load bank transfer payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPayments();
  }, [token, activeTab]);

  const handleAccept = async (code) => {
    if (!window.confirm('Are you sure you want to ACCEPT and APPROVE this bank transfer?')) return;
    setActionId(code);
    try {
      const res = await acceptPendingBankPayment(token, code);
      if (res.success) {
        toast.success('Bank payment accepted!');
        fetchPayments();
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
      const res = await rejectPendingBankPayment(token, code);
      if (res.success) {
        toast.success('Bank payment rejected');
        fetchPayments();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reject payment');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
              <Landmark className="w-7 h-7 text-indigo-400" />
            </div>
            Bank Transactions Terminal
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">
            Dedicated monitoring, proof verification, and history terminal for all Bank Transfer sessions.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-black/40 p-1.5 rounded-2xl border border-white/10 self-start sm:self-auto backdrop-blur-xl">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Approvals
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Bank History
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Landmark className="w-14 h-14 mx-auto mb-3 opacity-30 text-indigo-400" />
            <p className="text-base font-bold text-slate-300">
              {activeTab === 'pending' ? 'No pending bank transfer sessions.' : 'No bank transfer history records found.'}
            </p>
            <p className="text-xs text-slate-500 mt-1">All bank transfer transactions will appear here in real-time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/40 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="p-4">Session Code & Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Bank Target & Wallet Agent</th>
                  <th className="p-4">Proof Screenshot(s)</th>
                  <th className="p-4 text-right">Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium text-slate-300">
                {sessions.map((s) => {
                  const bd = s.bankDetails || {};
                  const proofUrls = Array.isArray(bd.proofUrls) && bd.proofUrls.length > 0 ? bd.proofUrls : (bd.proofUrl ? [bd.proofUrl] : []);
                  const agentInfo = s.walletAgentSnapshot || s.resolvedBankAgent;

                  return (
                    <tr key={s._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-white text-base">{s.code}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {new Date(s.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} (BD Time)
                        </div>
                        {s.userIdentityAddress && (
                          <div className="text-[10px] font-mono text-cyan-300 mt-1 truncate max-w-[150px]">
                            User: {s.userIdentityAddress}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-black text-emerald-400 text-xl font-mono">
                          ৳{s.amount?.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">BDT</div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const matchedBank = supportedBanks.find(
                            b => b.name?.toLowerCase().trim() === bd.bankName?.toLowerCase().trim()
                          );
                          let rawLogo = matchedBank?.logo || bd.bankLogo;
                          if (rawLogo && !rawLogo.startsWith('http')) {
                            const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
                            rawLogo = `${base}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`;
                          }

                          return (
                            <div className="flex items-center gap-2.5">
                              {rawLogo ? (
                                <div className="w-8 h-8 rounded-xl bg-black border border-white/10 p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
                                  <img src={rawLogo} alt={bd.bankName} className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base flex-shrink-0">
                                  🏦
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-white text-base">{bd.bankName || 'Bank Transfer'}</div>
                                <div className="text-xs text-indigo-300 font-mono mt-0.5">Acc: {bd.accountNumber || 'N/A'}</div>
                              </div>
                            </div>
                          );
                        })()}
                        {bd.accountHolderName && (
                          <div className="text-[11px] text-slate-400 mt-1">Holder: {bd.accountHolderName}</div>
                        )}
                        {/* Wallet Agent Email & Info Display */}
                        <div className="mt-2 bg-black/40 p-2.5 rounded-xl border border-white/10 text-[11px] text-left">
                          <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-1">
                            🏦 Wallet Agent Target:
                          </span>
                          {agentInfo ? (
                            <div>
                              <div className="text-amber-300 font-bold font-mono">{agentInfo.agentName || agentInfo.name || 'Wallet Agent'}</div>
                              {agentInfo.email && <div className="text-slate-300 text-[10px] font-mono font-bold mt-0.5">{agentInfo.email}</div>}
                              {agentInfo.phone && <div className="text-slate-400 text-[10px] font-mono">{agentInfo.phone}</div>}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">Unlinked Agent Account</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {proofUrls.length > 0 ? (
                          <div className="flex gap-2">
                            {proofUrls.map((url, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedProof(url)}
                                className="w-14 h-14 rounded-xl border border-white/10 bg-black overflow-hidden hover:scale-105 transition-transform relative group"
                              >
                                <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                                <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">🔍 Zoom</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">No Screenshot Uploaded</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {activeTab === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={actionId === s.code}
                              onClick={() => handleAccept(s.code)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Approve
                            </button>
                            <button
                              disabled={actionId === s.code}
                              onClick={() => handleReject(s.code)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                              s.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {s.status === 'paid' ? '✅ Approved & Paid' : '❌ Rejected'}
                            </span>
                            {s.callbackResult && (
                              <span className="text-[9px] text-indigo-300 font-mono">
                                Webhook: {s.callbackResult.success ? 'HTTP 200 Sent' : 'Failed'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Screenshot Zoom Modal */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedProof(null)}>
          <div className="bg-slate-900 rounded-3xl max-w-2xl w-full p-5 relative border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">Bank Payment Proof Screenshot</h3>
              <button onClick={() => setSelectedProof(null)} className="text-slate-400 hover:text-white font-bold text-xl px-2">✕</button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto flex justify-center bg-black rounded-2xl p-2 border border-white/5">
              <img src={selectedProof} alt="Proof" className="max-w-full h-auto object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
