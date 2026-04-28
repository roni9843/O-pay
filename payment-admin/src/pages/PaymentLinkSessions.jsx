import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { getPaymentSessionsAdmin } from '../lib/api'
import {
  Link as LinkIcon, ExternalLink, Calendar, Search, Activity, Clock, FileText, Smartphone, User, CheckCircle2, Copy, Check, Globe, ArrowRight, Briefcase, Hash, MessageSquareText, ShieldCheck, MapPin, Network, Monitor, Zap, Info, ArrowUpRight, ShieldAlert, Key, Eye, EyeOff
} from 'lucide-react'

const getBrowserInfo = (ua) => {
  if (!ua) return 'Unknown Browser'
  if (ua.includes('axios')) return 'Server API (Axios)'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edge')) return 'Edge'
  return 'Mobile App / Web'
}

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
    TRX_NOT_FOUND: 'Fake or invalid Transaction ID (ID not found)',
    AMOUNT_MISMATCH: 'Amount mismatch (payment amount does not match)',
    TRX_TOO_OLD: 'Transaction ID is valid, but time window expired (older than 10 minutes)',
    TRX_ALREADY_USED: 'Transaction ID already used (already verified before)',
    PROVIDER_MISMATCH: 'Provider mismatch (wrong wallet provider)',
    DEVICE_MISMATCH: 'Transaction belongs to a different device or agent',
    SESSION_EXPIRED: 'Payment link expired (session ended)',
    INVALID_AGENT_ACCOUNT: 'Agent account info invalid',
  }
  return MAP[reason] || message || 'Verification failed'
}

const detectAmountMismatch = (sessionAmount, attemptedPaymentMessage) => {
  const expected = Number(sessionAmount)
  const received = Number(attemptedPaymentMessage?.amount)
  if (!Number.isFinite(expected) || !Number.isFinite(received)) return null
  if (Math.abs(expected - received) <= 0.5) return null
  return { expected, received }
}

export default function PaymentLinkSessions() {
  const token = useAuthStore(s => s.token)

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [copiedLink, setCopiedLink] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSearch, setTempSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [tempStartDate, setTempStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [token, page, searchQuery, startDate, endDate])

  async function fetchData() {
    if (!token) return
    setLoading(true)
    try {
      const qs = { page, limit: 50, search: searchQuery }
      if (startDate) qs.startDate = startDate
      if (endDate) qs.endDate = endDate
      
      const res = await getPaymentSessionsAdmin(token, qs)
      if (res.success) {
        setItems(res.data || [])
        setTotal(res.total || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, code) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(code)
    setTimeout(() => setCopiedLink(''), 2000)
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearchQuery(tempSearch)
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
  }

  const clearFilters = () => {
    setTempSearch('')
    setSearchQuery('')
    setTempStartDate('')
    setStartDate('')
    setTempEndDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="space-y-6 pb-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-transparent p-8 border border-white/5 backdrop-blur-xl relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px]" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Network className="w-8 h-8 text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-300 via-purple-200 to-white bg-clip-text text-transparent">
                Payment Link Tracking
              </span>
            </h2>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              Trace exactly where a link was generated, who generated it via token, the exact agent/personal target number and its owner, and the final redirect destination when successful.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative group w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-indigo-400/70 group-focus-within:text-indigo-300 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search any field..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 backdrop-blur-md transition-all placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto text-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold mb-0.5 ml-1">Start Date</span>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="bg-black/40 border border-white/10 text-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold mb-0.5 ml-1">End Date</span>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="bg-black/40 border border-white/10 text-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex items-end h-full mt-4 sm:mt-0 pb-0.5 gap-2 w-full sm:w-auto">
                 <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto h-[42px] flex items-center justify-center">
                   Filter
                 </button>
                 {(searchQuery || startDate || endDate) && (
                   <button
                     type="button"
                     onClick={clearFilters}
                     title="Clear Filters"
                     className="bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 px-3 py-2.5 rounded-xl transition-colors h-[42px] flex items-center justify-center"
                   >
                     <Activity className="h-4 w-4 rotate-45" />
                   </button>
                 )}
              </div>
            </form>

            <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-center min-w-[120px] shadow-inner backdrop-blur-md">
              <div className="text-3xl font-mono font-bold bg-gradient-to-br from-white to-indigo-400 bg-clip-text text-transparent">{total}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold">Total Links</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-6">
        {loading && items.length === 0 ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-3xl h-64 w-full border border-white/5" />
          ))
        ) : items.length === 0 ? (
          <div className="bg-white/5 rounded-3xl border border-white/5 p-16 text-center text-slate-500 flex flex-col items-center">
            <Search className="w-16 h-16 opacity-20 mb-4" />
            <p className="text-lg">No links found.</p>
          </div>
        ) : (
          items.map(s => {
            const isExpired = s.status === 'expired' || (s.expiresAt && new Date(s.expiresAt) < new Date() && s.status !== 'paid')
            const isSuccess = s.status === 'paid'
            const isExpanded = expandedId === s._id

            const reqIp = s.forwardedFor || s.requestIp || 'Unknown IP'
            const reqToken = s.requestHeaders?.['x-opay-business-token'] || 'No Token'

            const events = Array.isArray(s.events) ? s.events : []
            const payClickEvent = events.find(e => e.type === 'pay_click')
            const selectedMethod = payClickEvent?.meta?.method || null
            const verifyAttempts = Array.isArray(s.verificationAttempts) ? s.verificationAttempts : []
            const failInfo = s.lastVerificationFailure || null
            const lastVerifyEvent = [...events].reverse().find(e => {
              const t = String(e?.type || '').toLowerCase()
              return t.includes('verify') && (e?.meta?.txid || e?.meta?.trxid)
            })
            const attemptedTrxid = failInfo?.trxid
              || verifyAttempts.slice().reverse().find(a => a?.trxid)?.trxid
              || lastVerifyEvent?.meta?.txid
              || lastVerifyEvent?.meta?.trxid
              || s.attemptedTrxId
              || null
            const attemptedSms = s.attemptedPaymentMessage || null
            const amountMismatch = detectAmountMismatch(s.amount, attemptedSms)
            const displayReason = (() => {
              if (amountMismatch) {
                return `Amount mismatch (Expected ${amountMismatch.expected}, SMS amount ${amountMismatch.received})`
              }
              return failureLabel(failInfo?.code, failInfo?.message)
            })()

            const stayMs = (() => {
              const start = s.firstOpenedAt || s.createdAt
              const end = s.lastActivityAt || s.updatedAt || new Date().toISOString()
              const from = start ? new Date(start).getTime() : NaN
              const to = end ? new Date(end).getTime() : NaN
              if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0
              return Math.floor((to - from) / 1000)
            })()

            const failStaySeconds = Number(failInfo?.linkStaySeconds)
            const displayStay = Number.isFinite(failStaySeconds) && failStaySeconds > 0 ? failStaySeconds : stayMs

            // Method target resolution
            const targetAgentNumber = selectedMethod ? selectedMethod.accountNumber : (s.paymentMessage?.masking || s.paymentMessage?.from || 'Waiting...')

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={s._id}
                className={`bg-white/[0.02] border rounded-3xl overflow-hidden transition-all duration-500 ${isSuccess ? 'border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.03)]' : isExpired ? 'border-rose-500/20' : 'border-sky-500/30 hover:border-sky-500/50 shadow-[0_0_30px_rgba(14,165,233,0.03)]'}`}
              >
                {/* Top Status Bar */}
                <div className={`px-6 py-2.5 flex items-center justify-between text-xs font-semibold tracking-wider uppercase border-b ${isSuccess ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isExpired ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                  <div className="flex items-center gap-2">
                    {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : isExpired ? <Activity className="w-4 h-4" /> : <Clock className="w-4 h-4 animate-pulse" />}
                    {isSuccess ? 'Payment Successful' : isExpired ? 'Session Expired / Cancelled' : 'Payment Pending'}
                  </div>
                  {isSuccess && s.paymentMessage && (
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline-block">Settled at:</span>
                      {new Date(s.paymentMessage.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="p-6">
                  {!isSuccess && (
                    <div className={`mb-5 rounded-2xl border px-4 py-3 ${s.lastVerificationFailure ? 'border-rose-500/30 bg-rose-500/10' : 'border-sky-500/25 bg-sky-500/10'}`}>
                      <div className={`text-[10px] uppercase tracking-widest font-black mb-1 ${s.lastVerificationFailure ? 'text-rose-300' : 'text-sky-300'}`}>
                        Verification Failed Reason
                      </div>
                      {s.lastVerificationFailure ? (
                        <>
                          <div className="text-sm font-semibold text-rose-100">
                            {displayReason}
                          </div>
                          <div className="mt-1 text-[11px] text-rose-200/80 font-mono">
                            TrxID: {attemptedTrxid || 'N/A'} | Stayed: {formatDuration(s.lastVerificationFailure.linkStaySeconds)}
                          </div>
                          {attemptedSms?.fullMessage ? (
                            <div className="mt-2 text-[10px] text-rose-100/90 bg-black/20 border border-rose-500/20 rounded p-2 font-mono whitespace-pre-wrap break-words">
                              SMS: {attemptedSms.fullMessage.length > 160 ? `${attemptedSms.fullMessage.slice(0, 160)}...` : attemptedSms.fullMessage}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-sky-100">
                            No failed verify attempt captured yet
                          </div>
                          <div className="mt-1 text-[11px] text-sky-200/80 font-mono">
                            {isExpired ? 'Status: Expired session' : 'Status: Pending session'}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Header Row: Trx Info & Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-white/5 pb-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-bold bg-black/40 text-slate-200 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner flex items-center gap-2">
                          {s.code}
                        </span>
                        <span className="text-3xl font-bold font-mono tracking-tight text-white drop-shadow-md">
                          ৳{Number(s.amount).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      {s.footprintUrl && (
                        <a
                          href={s.footprintUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="View Masked Fingerprint URL"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors border border-cyan-500/20 hover:border-cyan-500/30 text-sm font-medium"
                        >
                          <EyeOff className="w-4 h-4" /> Masked FP
                        </a>
                      )}
                      {s.footprintUrlNonMask && (
                        <a
                          href={s.footprintUrlNonMask}
                          target="_blank"
                          rel="noreferrer"
                          title="View Non-Masked Fingerprint URL"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors border border-indigo-500/20 hover:border-indigo-500/30 text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" /> Raw FP
                        </a>
                      )}
                      <button
                        onClick={() => toggleExpand(s._id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors border text-sm font-medium ${isExpanded ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-white/10'}`}
                      >
                        <Info className="w-4 h-4" /> {isExpanded ? 'Hide Extra Details' : 'View Extra Details'}
                      </button>
                      <button
                        onClick={() => copyToClipboard(s.payment_page_url, s.code)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/5 hover:border-white/10 text-sm font-medium"
                      >
                        {copiedLink === s.code ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Highly Animated 3-Step Visual Flow */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">

                    {/* Line connecting the 3 boxes */}
                    <div className="absolute top-2 left-1/6 right-1/6 h-0.5 bg-white/5 z-0 hidden lg:block" style={{ width: '66%', left: '16%' }}>
                      <motion.div
                        className={`h-full ${isSuccess ? 'bg-gradient-to-r from-sky-500 via-amber-500 to-emerald-500' : 'bg-gradient-to-r from-sky-500 to-amber-500'}`}
                        initial={{ width: '0%' }}
                        animate={{ width: isSuccess ? '100%' : '50%' }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                      />
                    </div>

                    {/* 1. SOURCE ORIGIN */}
                    <motion.div whileHover={{ y: -5 }} className="bg-black/40 rounded-3xl p-5 border border-white/5 relative shadow-inner z-10 flex flex-col group h-full">
                      <div className="flex items-center gap-3 mb-4 border-b border-sky-500/20 pb-3">
                        <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/30 group-hover:border-sky-400/60 transition-all shadow-lg">
                          <Globe className="w-5 h-5 text-sky-400" />
                        </div>
                        <div>
                          <h3 className="text-[10px] text-sky-500 font-black uppercase tracking-widest">Step 1: Origin</h3>
                          <p className="font-bold text-slate-200">Generation Source</p>
                        </div>
                      </div>

                      <div className="space-y-3 mt-auto mb-auto">
                        <div className="bg-[#050510] rounded-xl p-3 border border-white/5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1 mb-1"><LinkIcon className="w-3 h-3" /> Success Redirect</span>
                          <span className="text-sm font-bold text-sky-300 break-all">{s.successRedirectUrl || s.business?.domain}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-[#050510] rounded-xl p-2.5 border border-white/5">
                            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 block">User Identify Address</span>
                            <span className="text-xs font-mono font-bold text-slate-300 truncate block" title={s.userIdentityAddress}>{s.userIdentityAddress}</span>
                          </div>
                          <div className="bg-[#050510] rounded-xl p-2.5 border border-white/5">
                            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 block">Invoice</span>
                            <span className="text-xs font-mono text-slate-300 truncate block" title={s.invoiceNumber}>{s.invoiceNumber || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="bg-[#050510] rounded-xl p-2.5 border border-white/5 flex flex-col gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Checkout Items</span>
                          {s.checkoutItems && Object.keys(s.checkoutItems).length > 0 ? (
                            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 items-center">
                              {Object.entries(s.checkoutItems).map(([k, v]) => (
                                <span key={k} className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                  <span className="text-slate-500 mr-1">{k}:</span>
                                  <span className="text-slate-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">No checkout parameters provided</span>
                          )}
                        </div>

                        <div className="bg-[#050510] rounded-xl p-3 border border-indigo-500/20 shadow-[inset_0_0_10px_rgba(99,102,241,0.05)]">
                          <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5 mb-1.5"><Key className="w-3 h-3" /> Webhook & Auth Token</span>
                          <div className="text-[10px] font-mono text-indigo-200/70 truncate mb-1">CB: {s.callbackUrl}</div>
                          <div className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 p-1.5 rounded truncate border border-indigo-500/20" title={reqToken}>
                            Token: {reqToken}
                          </div>
                          <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20 mt-2">
                            <div className="text-[9px] uppercase font-bold text-indigo-400 mb-1 border-b border-indigo-500/10 pb-1">
                              Generated using this token by:
                            </div>
                            <div className="text-xs font-bold text-indigo-300">
                              {s.business?.name || 'Unknown Business'}
                            </div>
                            {s.business && (
                              <div className="text-[10px] text-indigo-200/70 mt-1 space-y-0.5 font-mono">
                                <div className="truncate" title={s.business.domain}>Domain: {s.business.domain}</div>
                                <div className="truncate" title={s.business.email}>Email: {s.business.email}</div>
                              </div>
                            )}
                          </div>
                        </div>


                      </div>
                    </motion.div>


                    {/* 2. TARGET AGENT / NUMBER */}
                    <motion.div whileHover={{ y: -5 }} className="bg-black/40 rounded-3xl p-5 border border-white/5 relative shadow-inner z-10 flex flex-col group h-full">
                      <div className="flex items-center gap-3 mb-4 border-b border-amber-500/20 pb-3">
                        <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 group-hover:border-amber-400/60 transition-all shadow-lg">
                          <Briefcase className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Step 2: Target</h3>
                          <p className="font-bold text-slate-200">Merchant / Agent Info</p>
                        </div>
                      </div>

                      <div className="space-y-3 mt-auto mb-auto">
                        <div className="bg-[#050510] rounded-xl p-4 border border-amber-500/10 text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Target Number</div>
                          <div className="text-xl font-bold font-mono text-amber-400 tracking-wider">
                            {targetAgentNumber}
                          </div>
                          <div className="flex justify-center gap-2 mt-2">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/30">
                              {selectedMethod?.provider || s.paymentMessage?.type || 'Unknown'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-400 px-2 py-0.5 rounded-md border border-white/10">
                              {selectedMethod?.gateway || 'Unknown Type'}
                            </span>
                          </div>
                        </div>

                        {/* Owner Info of Payment Method */}
                        <div className="bg-[#050510] rounded-xl p-3 border border-white/5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 mb-2"><User className="w-3 h-3" /> Number Owner Details</span>
                          {s.resolvedMethod?.owner ? (
                            <div className="text-xs text-slate-300 space-y-1">
                              <div className="flex justify-between"><span className="text-slate-500">Name:</span> <strong>{s.resolvedMethod.owner.name}</strong></div>
                              <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="text-slate-400 font-mono">{s.resolvedMethod.owner.email}</span></div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 text-center italic py-2">System or Unlinked Account</div>
                          )}
                        </div>

                        {/* Owner Info of Device Received */}
                        <div className="bg-purple-500/5 rounded-xl p-3 border border-purple-500/10">
                          <span className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1.5 mb-2"><Smartphone className="w-3 h-3" /> Active Device Name</span>
                          <div className="text-sm font-bold text-purple-200 text-center mb-2">
                            {s.verificationFootprint?.deviceName || s.paymentMessage?.deviceName || 'Waiting/Unknown Mobile'}
                          </div>
                          {s.resolvedDevice?.owner ? (
                            <div className="text-xs text-purple-300/70 border-t border-purple-500/10 pt-2 flex justify-between">
                              <span>Device Owner:</span> <strong className="text-purple-300">{s.resolvedDevice.owner.name}</strong>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>


                    {/* 3. REDIRECT / FINAL */}
                    <motion.div whileHover={{ y: -5 }} className="bg-black/40 rounded-3xl p-5 border border-white/5 relative shadow-inner z-10 flex flex-col group h-full">
                      <div className={`flex items-center gap-3 mb-4 border-b pb-3 ${isSuccess ? 'border-emerald-500/20' : 'border-slate-700'}`}>
                        <div className={`p-2.5 rounded-xl border transition-all shadow-lg ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/30 group-hover:border-emerald-400/60' : 'bg-slate-800 border-slate-700'}`}>
                          <ArrowUpRight className={`w-5 h-5 ${isSuccess ? 'text-emerald-400' : 'text-slate-500'}`} />
                        </div>
                        <div>
                          <h3 className={`text-[10px] font-black uppercase tracking-widest ${isSuccess ? 'text-emerald-500' : 'text-slate-500'}`}>Step 3: Redirect</h3>
                          <p className="font-bold text-slate-200">Final Destination</p>
                        </div>
                      </div>

                      <div className="space-y-3 mt-auto mb-auto">
                        {isSuccess ? (
                          <>
                            <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20 text-center shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]">
                              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                              <div className="text-sm font-bold text-emerald-300">Payment Verified</div>
                              <div className="text-[10px] text-emerald-500/70 uppercase tracking-widest mt-1">Redirecting to:</div>
                              <div className="text-xs font-mono font-bold text-emerald-400 mt-1 break-all bg-emerald-500/10 p-1.5 rounded inline-block">
                                {s.successRedirectUrl || 'Original Website'}
                              </div>
                            </div>

                            {s.paymentMessage && (
                              <div className="bg-[#050510] rounded-xl p-3 border border-emerald-500/20">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] uppercase font-bold text-emerald-500 flex items-center gap-1"><MessageSquareText className="w-3 h-3" /> TrxID: {s.paymentMessage.trxID}</span>
                                </div>
                                <div className="text-[10px] font-mono text-emerald-200/80 break-words leading-relaxed whitespace-pre-wrap">
                                  {s.paymentMessage.fullMessage?.substring(0, 100)}{s.paymentMessage.fullMessage?.length > 100 ? '...' : ''}
                                </div>
                              </div>
                            )}
                          </>
                        ) : isExpired ? (
                          <div className="bg-rose-500/5 rounded-xl p-4 border border-rose-500/20 text-center h-full flex flex-col items-center justify-center">
                            <ShieldAlert className="w-8 h-8 text-rose-500/50 mb-2" />
                            <div className="text-sm font-bold text-rose-400">Session Redirect Failed</div>
                            <div className="text-[10px] text-rose-400/60 mt-1 uppercase tracking-widest">Intended Redirect:</div>
                            <div className="text-[10px] font-mono font-bold text-rose-300 mt-1 break-all bg-rose-500/10 p-1.5 rounded inline-block w-full">
                              {s.successRedirectUrl || 'Original Website'}
                            </div>
                            {s.paymentMessage && (
                              <div className="mt-3 w-full bg-[#050510] rounded-xl p-3 border border-rose-500/20 text-left">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] uppercase font-bold text-rose-500 flex items-center gap-1"><MessageSquareText className="w-3 h-3" /> TrxID: {s.paymentMessage.trxID}</span>
                                </div>
                                <div className="text-[10px] font-mono text-rose-200/80 break-words leading-relaxed whitespace-pre-wrap">
                                  {s.paymentMessage.fullMessage?.substring(0, 100)}{s.paymentMessage.fullMessage?.length > 100 ? '...' : ''}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center min-h-[150px] flex flex-col items-center justify-center">
                            {failInfo ? (
                              <>
                                <ShieldAlert className="w-9 h-9 text-rose-400/80 mb-2" />
                                <div className="text-sm font-bold text-rose-300">Last Verify Attempt Failed</div>
                                <div className="text-[11px] text-rose-200 mt-1 px-2 leading-relaxed">
                                  {failureLabel(failInfo.code, failInfo.message)}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-2">
                                  Time spent on link: <span className="font-mono text-amber-300">{formatDuration(displayStay)}</span>
                                </div>
                                {failInfo.trxid ? (
                                      <div className="text-[10px] text-slate-500 font-mono mt-1">TrxID: {attemptedTrxid || failInfo.trxid}</div>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <Clock className="w-10 h-10 text-sky-500/50 mb-3 animate-pulse" />
                                <div className="text-sm font-bold text-sky-400">Waiting for Payment</div>
                                <div className="text-[10px] text-sky-400/60 mt-1 uppercase">Will Redirect to:</div>
                                <div className="text-[10px] font-mono text-sky-300/80 mt-1 truncate w-full">{s.successRedirectUrl}</div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>

                  </div>


                  {/* EXPANDED EXTRA DETAILS */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-6 flex flex-col gap-4 border-t border-white/5 pt-6"
                      >
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Activity className="w-4 h-4" /> Device & Connection Fingerprint
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Server IP Details */}
                          <div className="bg-black/20 p-4 border border-white/5 rounded-2xl relative overflow-hidden">
                            <MapPin className="w-16 h-16 absolute -top-4 -right-4 text-white/5" />
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Request IP (Customer)</div>
                            <div className="text-lg font-mono font-bold text-indigo-300">{reqIp}</div>
                            {s.approxLocation && (
                              <div className="mt-2 text-[10px] text-slate-400">
                                {s.approxLocation.city}, {s.approxLocation.countryCode} <br />
                                ISP: {s.approxLocation.isp}
                              </div>
                            )}
                          </div>

                          {/* Browser Data */}
                          <div className="bg-black/20 p-4 border border-white/5 rounded-2xl relative overflow-hidden">
                            <Monitor className="w-16 h-16 absolute -top-4 -right-4 text-white/5" />
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Browser / App</div>
                            <div className="text-lg font-bold text-indigo-300">{getBrowserInfo(s.userAgent)}</div>
                            <div className="mt-2 text-[10px] text-slate-400 font-mono break-words leading-tight">
                              {s.userAgent?.substring(0, 60)}...
                            </div>
                          </div>

                          {/* Timeline & Expiration */}
                          <div className="bg-black/20 p-4 border border-white/5 rounded-2xl md:col-span-2 relative overflow-hidden">
                            <Calendar className="w-16 h-16 absolute -top-4 -right-4 text-white/5" />
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Timeline & Expiration</div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                              <div>
                                <div className="text-[9px] uppercase text-slate-500 border-b border-white/5 pb-0.5 mb-1">Created At</div>
                                <div className="text-[11px] font-mono text-slate-300">{s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-[9px] uppercase text-slate-500 border-b border-white/5 pb-0.5 mb-1">Updated At</div>
                                <div className="text-[11px] font-mono text-slate-300">{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-[9px] uppercase text-slate-500 border-b border-white/5 pb-0.5 mb-1">Expires At</div>
                                <div className="text-[11px] font-mono text-rose-300">{s.expiresAt ? new Date(s.expiresAt).toLocaleString() : 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-[9px] uppercase text-slate-500 border-b border-white/5 pb-0.5 mb-1">First Opened</div>
                                <div className="text-[11px] font-mono text-sky-300">{s.firstOpenedAt ? new Date(s.firstOpenedAt).toLocaleString() : 'Never'}</div>
                              </div>
                              <div className="col-span-2 lg:col-span-2">
                                <div className="text-[9px] uppercase text-slate-500 border-b border-white/5 pb-0.5 mb-1">Last Activity</div>
                                <div className="text-[11px] font-mono text-amber-300">{s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString() : 'Never'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Full Payment Message */}
                          {s.paymentMessage && (
                            <div className="bg-emerald-950/20 p-4 border border-emerald-500/10 rounded-2xl md:col-span-2 relative overflow-hidden">
                              <MessageSquareText className="w-16 h-16 absolute -top-4 -right-4 text-emerald-500/5" />
                              <div className="text-[10px] uppercase font-bold text-emerald-500/70 mb-1 flex justify-between">
                                <span>Raw SMS Content</span>
                                <span>{s.paymentMessage.deviceTime}</span>
                              </div>
                              <div className="text-xs font-mono text-emerald-200/90 whitespace-pre-wrap">
                                {s.paymentMessage.fullMessage}
                              </div>
                            </div>
                          )}

                          {/* Verification Footprint Detailed View */}
                          {s.verificationFootprint && (
                            <div className="bg-slate-900/30 p-4 border border-slate-700/50 rounded-2xl md:col-span-4 mt-2">
                              <div className="text-[10px] uppercase font-bold text-slate-400 mb-3 flex items-center gap-1.5 border-b border-white/5 pb-2">
                                <Activity className="w-3.5 h-3.5 text-sky-400" /> Complete Device Fingerprint
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-4 gap-x-6">
                                <div>
                                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Device Name</div>
                                  <div className="text-[11px] font-bold text-slate-200">{s.verificationFootprint.deviceName || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Device ID / Sender Phone</div>
                                  <div className="text-[10px] font-mono text-slate-300">ID: {s.verificationFootprint.deviceId || 'N/A'}<br />Phone: {s.verificationFootprint.senderPhone || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">IP Address</div>
                                  <div className="text-[11px] font-mono text-cyan-300">{s.verificationFootprint.ip || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Platform & Screen</div>
                                  <div className="text-[11px] text-slate-300">{s.verificationFootprint.platform || 'N/A'}<br /><span className="font-mono text-[10px]">{s.verificationFootprint.screen || 'N/A'}</span></div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">Timezone & Lang</div>
                                  <div className="text-[11px] text-slate-300">{s.verificationFootprint.timezone || 'N/A'}<br /><span className="text-[10px] uppercase">{s.verificationFootprint.language || 'N/A'}</span></div>
                                </div>
                                <div className="sm:col-span-3 lg:col-span-5 bg-black/20 p-2.5 rounded-xl border border-white/5">
                                  <div className="text-[9px] uppercase text-slate-500 mb-0.5">User Agent Flow</div>
                                  <div className="text-[10px] font-mono text-slate-400 break-words leading-snug">{s.verificationFootprint.userAgent || 'N/A'}</div>
                                  <div className="text-[9px] text-slate-500 text-right mt-1 font-mono">Timestamp: {s.verificationFootprint.timestamp || 'N/A'}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {!isSuccess && failInfo && (
                            <div className="bg-rose-950/20 p-4 border border-rose-500/20 rounded-2xl md:col-span-4 mt-2">
                              <div className="text-[10px] uppercase font-bold text-rose-300 mb-3 flex items-center gap-1.5 border-b border-rose-500/20 pb-2">
                                <ShieldAlert className="w-3.5 h-3.5" /> Failure Diagnostics
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                <div className="bg-black/20 rounded-xl p-3 border border-rose-500/10">
                                  <div className="text-[10px] uppercase text-rose-300/80 mb-1">Reason</div>
                                  <div className="text-rose-100 leading-relaxed">{displayReason}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-rose-500/10">
                                  <div className="text-[10px] uppercase text-rose-300/80 mb-1">Last TrxID</div>
                                  <div className="font-mono text-rose-100 break-all">{attemptedTrxid || failInfo.trxid || 'N/A'}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-rose-500/10 md:col-span-2">
                                  <div className="text-[10px] uppercase text-rose-300/80 mb-1">Typed Trx SMS</div>
                                  <div className="font-mono text-rose-100/90 break-words whitespace-pre-wrap max-h-28 overflow-auto">
                                    {attemptedSms?.fullMessage || 'Matching SMS not found'}
                                  </div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-rose-500/10">
                                  <div className="text-[10px] uppercase text-rose-300/80 mb-1">Time Spent On Link</div>
                                  <div className="font-mono text-amber-300">{formatDuration(displayStay)}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-rose-500/10">
                                  <div className="text-[10px] uppercase text-rose-300/80 mb-1">Total Verify Try</div>
                                  <div className="font-mono text-rose-100">{verifyAttempts.length}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center mt-10">
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-6 py-2.5 hover:bg-white/10 rounded-xl text-sm disabled:opacity-30 disabled:hover:bg-transparent font-bold transition-all flex items-center gap-2"
            >
              Previous
            </button>
            <div className="px-5 text-sm font-black font-mono bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 rounded-xl text-white shadow-lg">
              Page {page}
            </div>
            <button
              disabled={items.length < 50}
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2.5 hover:bg-white/10 rounded-xl text-sm disabled:opacity-30 disabled:hover:bg-transparent font-bold transition-all flex items-center gap-2"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
