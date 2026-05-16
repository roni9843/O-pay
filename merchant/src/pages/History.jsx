import React, { useEffect, useState } from 'react';
import { getPaymentPageHistory } from '../lib/api';
import { ExternalLink, Loader2, RefreshCw, Link2, CalendarClock, ChevronDown, ChevronUp, Code2, Globe2, Play, Clock3, MapPin, MessageSquareText, ShieldAlert, Eye, EyeOff, Activity } from 'lucide-react';

const formatDuration = (seconds) => {
  const safe = Number(seconds)
  if (!Number.isFinite(safe) || safe <= 0) return '0s'
  const total = Math.floor(safe)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const failureLabel = (code, message) => {
  const reason = String(code || '').toUpperCase()
  const MAP = {
    TRX_NOT_FOUND: 'Fake or invalid Transaction ID',
    AMOUNT_MISMATCH: 'Amount mismatch',
    TRX_TOO_OLD: 'Transaction ID expired by time window',
    TRX_ALREADY_USED: 'Transaction ID already used',
    PROVIDER_MISMATCH: 'Provider mismatch',
    DEVICE_MISMATCH: 'Device or agent mismatch',
    SESSION_EXPIRED: 'Payment link expired',
    INVALID_AGENT_ACCOUNT: 'Invalid agent account info',
  }
  return MAP[reason] || message || 'Verification failed'
}

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedCode, setExpandedCode] = useState(null);
  const [summary, setSummary] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalItems, setTotalItems] = useState(0);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');
      setItems([]); // Clear for fresh feel
      const res = await getPaymentPageHistory({ page, limit, status: statusFilter });
      if (res.success && Array.isArray(res.data)) {
        console.log('[Audit] Merchant Backend Query applied:', res.debugQuery);
        setItems(res.data);
        setTotalItems(res.total || 0);
        setSummary(res.summary);
      } else {
        setError(res.message || 'Failed to load history');
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page, statusFilter]);

  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  const toggleExpand = (code) => {
    setExpandedCode(expandedCode === code ? null : code);
  };

  const getAttemptedTrxId = (item) => {
    if (item?.lastVerificationFailure?.trxid) return item.lastVerificationFailure.trxid
    const attempts = Array.isArray(item?.verificationAttempts) ? item.verificationAttempts : []
    for (let i = attempts.length - 1; i >= 0; i -= 1) {
      if (attempts[i]?.trxid) return attempts[i].trxid
    }
    const events = Array.isArray(item?.events) ? item.events : []
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const type = String(events[i]?.type || '').toLowerCase()
      if (!type.includes('verify')) continue
      const id = events[i]?.meta?.txid || events[i]?.meta?.trxid
      if (id) return id
    }
    return null
  }

  const getAttemptedSms = (item, attemptedTrxId) => {
    const attemptedMsg = item?.attemptedPaymentMessage
    if (attemptedMsg) return attemptedMsg
    const msg = item?.paymentMessage
    if (msg && String(msg.trxID || '').trim().toLowerCase() === String(attemptedTrxId || '').trim().toLowerCase()) {
      return msg
    }
    return null
  }

  const getFailureContext = (item, attemptedSms, amountMismatch) => {
    const verifyResult = item?.lastVerifyResult || null
    const reasonCode = String(verifyResult?.meta?.reasonCode || item?.lastVerificationFailure?.code || '').toUpperCase()
    const reasonMessage = verifyResult?.meta?.reasonMessage || item?.lastVerificationFailure?.message || null
    if (amountMismatch) {
      return `Amount mismatch (Expected ${amountMismatch.expected}, SMS amount ${amountMismatch.received})`
    }
    if (reasonCode) {
      return failureLabel(reasonCode, reasonMessage)
    }
    return failureLabel(null, reasonMessage)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarClock className="w-8 h-8 text-black" />
            Audit History
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Review your transactional performance and audit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </header>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-[2rem] bg-white border border-slate-200 shadow-sm transition-all hover:shadow-xl group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors uppercase">Total Generated</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary ? (summary.totalAmount || 0).toLocaleString('en-BD') : '...'} <span className="text-[10px] text-slate-400">BDT</span></p>
          <p className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Across {summary ? summary.totalAmount === 0 && summary.totalCount === 0 ? 0 : items.length : '...'} Link Requests</p>
        </div>
        <div className="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100 shadow-sm transition-all hover:shadow-xl group">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors uppercase">Total Success</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{summary ? (summary.successAmount || 0).toLocaleString('en-BD') : '...'} <span className="text-[10px] text-emerald-400">BDT</span></p>
          <p className="mt-1 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Paid by {summary ? summary.successCount : '...'} Customers</p>
        </div>
        <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 shadow-sm transition-all hover:shadow-xl group">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest group-hover:text-amber-600 transition-colors uppercase">Unsuccessful</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{summary ? (summary.unsuccessfulAmount || 0).toLocaleString('en-BD') : '...'} <span className="text-[10px] text-amber-400">BDT</span></p>
          <p className="mt-1 text-[10px] text-amber-500 font-bold uppercase tracking-widest">Dropped from {summary ? summary.unsuccessfulCount : '...'} Sessions</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-bold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-6">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
              Transactions Logs
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-700 outline-none hover:border-slate-300 transition-all uppercase tracking-widest"
            >
              <option value="all">All Records</option>
              <option value="paid">Paid Only</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
            {totalItems} RECORDS FOUND
          </span>
        </div>

        <div className="relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] transition-all">
              <Loader2 className="w-10 h-10 animate-spin text-slate-900 mb-3" />
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">Syncing Audit Records...</p>
            </div>
          )}
          
          {items.length === 0 && !loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Code2 className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No transaction records found</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mt-1">Try adjusting your status filter</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <React.Fragment key={item.code}>
                    <tr 
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${expandedCode === item.code ? 'bg-slate-50/80 shadow-inner' : ''}`}
                      onClick={() => toggleExpand(item.code)}
                    >
                      <td className="px-6 py-5 whitespace-nowrap font-bold text-slate-700">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-black text-slate-900">
                        {Number(item.amount || 0).toLocaleString('en-BD')} <span className="text-[10px] font-bold text-slate-400">BDT</span>
                      </td>
                      <td className="px-6 py-5 max-w-xs">
                        <div className="font-bold text-slate-900 truncate" title={item.user_identity_address}>
                          {item.user_identity_address || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-mono text-xs text-slate-500">
                        #{item.invoice_number || 'N/A'}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span
                          className={
                            `inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-black border ` +
                            (item.status === 'paid'
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                              : item.status === 'cancelled' || item.status === 'expired'
                                ? 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                                : 'bg-amber-100 text-amber-800 border-amber-300')
                          }
                        >
                          {item.status === 'pending' || !item.status ? 'Unsuccessful' : item.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {expandedCode === item.code ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400 hover:text-slate-900 transition-colors" />}
                      </td>
                    </tr>
                    
                    {expandedCode === item.code && (
                      <tr className="bg-slate-50/50">
                        <td colSpan="6" className="px-8 py-8 border-b border-slate-200 shadow-inner overflow-hidden animate-in slide-in-from-top-4 duration-300">
                          {(() => {
                            const attemptedTrxId = getAttemptedTrxId(item)
                            const attemptedSms = getAttemptedSms(item, attemptedTrxId)
                            const amountMismatch = attemptedSms && Number(item.amount) !== Number(attemptedSms.amount)
                              ? { expected: Number(item.amount || 0), received: Number(attemptedSms.amount || 0) }
                              : null
                            const displayReason = getFailureContext(item, attemptedSms, amountMismatch)
                            const staySeconds = item.lastVerificationFailure?.linkStaySeconds || (() => {
                              const start = item.firstOpenedAt || item.createdAt
                              const end = item.lastActivityAt || item.updatedAt || item.createdAt
                              const from = start ? new Date(start).getTime() : NaN
                              const to = end ? new Date(end).getTime() : NaN
                              if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0
                              return Math.floor((to - from) / 1000)
                            })()

                            return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                            <div className="space-y-6">
                              <div>
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                  <Globe2 className="w-4 h-4" /> Session Details
                                </h4>
                                <div className="space-y-4">
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Payment Page URL</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{item.payment_page_url || 'N/A'}</div>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Invoice / Identity</label>
                                    <div className="text-xs font-mono break-all text-slate-600">#{item.invoice_number || 'N/A'} | {item.user_identity_address || 'N/A'}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                  <Play className="w-4 h-4 text-emerald-500" /> Footprint / Evidence
                                </h4>
                                <div className="space-y-3">
                                  {!item.status || item.status !== 'paid' ? (
                                    <div className={`rounded-2xl border px-4 py-3 ${item.lastVerificationFailure || attemptedTrxId ? 'border-rose-500/30 bg-rose-50' : 'border-sky-500/25 bg-sky-50'}`}>
                                      <div className={`text-[10px] uppercase tracking-[0.2em] font-black mb-1 ${item.lastVerificationFailure || attemptedTrxId ? 'text-rose-500' : 'text-sky-500'}`}>
                                        Verification Failed Reason
                                      </div>
                                      <div className="text-sm font-semibold text-slate-900">{displayReason}</div>
                                      <div className="mt-1 text-[11px] text-slate-600 font-mono">
                                        TrxID: {attemptedTrxId || 'N/A'} | Stayed: {formatDuration(staySeconds)}
                                      </div>
                                      {amountMismatch && attemptedSms?.fullMessage ? (
                                        <div className="mt-2 text-[10px] text-slate-700 bg-white border border-slate-200 rounded p-2 font-mono whitespace-pre-wrap break-words leading-relaxed">
                                          SMS: {attemptedSms.fullMessage}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Callback URL</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{item.callbackUrl || 'N/A'}</div>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Success Redirect</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{item.successRedirectUrl || 'N/A'}</div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {item.footprintUrl ? (
                                      <a
                                        href={item.footprintUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                      >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        Masked Footprint
                                      </a>
                                    ) : (
                                      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-400 text-center italic">
                                        No masked footprint available
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                  <Clock3 className="w-4 h-4" /> Request / Activity Info
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Request IP</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{item.forwardedFor || item.requestIp || 'N/A'}</div>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">User Agent</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{item.userAgent || 'N/A'}</div>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">First Opened</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{formatDateTime(item.firstOpenedAt)}</div>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Last Activity</label>
                                    <div className="text-xs font-mono break-all text-slate-600">{formatDateTime(item.lastActivityAt)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                               <div className="space-y-6">
                                 <div>
                                   <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                      <ShieldAlert className="w-4 h-4" /> Verification Diagnostics
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Status</label>
                                        <div className="text-xs font-bold text-slate-700">{item.status || 'pending'}</div>
                                      </div>
                                      <div className="p-4 rounded-2xl bg-white border border-slate-200">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Verification Attempts</label>
                                        <div className="text-xs font-bold text-slate-700">{Array.isArray(item.verificationAttempts) ? item.verificationAttempts.length : 0}</div>
                                      </div>
                                      <div className="p-4 rounded-2xl bg-white border border-slate-200 sm:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Last Failure Reason</label>
                                        <div className="text-xs font-semibold text-slate-700">{displayReason}</div>
                                      </div>
                                    </div>
                                 </div>

                                 <div>
                                   <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                      <MessageSquareText className="w-4 h-4" /> Transaction Message
                                    </h4>
                                    <div className="bg-slate-900 text-amber-200 p-6 rounded-[1.5rem] font-mono text-[11px] leading-relaxed shadow-2xl border border-white/5 max-h-[250px] overflow-y-auto">
                                      {amountMismatch && attemptedSms ? (
                                        <pre className="whitespace-pre-wrap">{JSON.stringify(attemptedSms, null, 2)}</pre>
                                      ) : (
                                        <div className="italic text-slate-500">SMS is shown only when the verification failed due to amount mismatch.</div>
                                      )}
                                    </div>
                                 </div>

                                 <div>
                                   <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                      <Code2 className="w-4 h-4" /> Request Payload (Checkout Items)
                                    </h4>
                                    <div className="bg-slate-900 text-amber-200 p-6 rounded-[1.5rem] font-mono text-[11px] leading-relaxed shadow-2xl border border-white/5 max-h-[250px] overflow-y-auto">
                                      {item.checkoutItems ? (
                                        <pre className="whitespace-pre-wrap">{JSON.stringify(item.checkoutItems, null, 2)}</pre>
                                      ) : (
                                        <div className="italic text-slate-500">No custom data was attached to this payment link.</div>
                                      )}
                                    </div>
                                 </div>
                               </div>
                            </div>
                          </div>
                            )
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItems)} of {totalItems} entries
            </p>
            <div className="flex items-center gap-3">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all uppercase tracking-widest"
              >
                Previous
              </button>
              <div className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black tracking-widest">
                PAGE {page}
              </div>
              <button
                disabled={page * limit >= totalItems || loading}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all uppercase tracking-widest"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
