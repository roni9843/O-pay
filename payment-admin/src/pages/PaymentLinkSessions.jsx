import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { getPaymentSessionsAdmin, listOpayBusinesses, listUsers } from '../lib/api'
import {
  Link as LinkIcon, ExternalLink, Calendar, Search, Activity, Clock, FileText, Smartphone, User, CheckCircle2, Copy, Check, Globe, ArrowRight, Briefcase, Hash, MessageSquareText, ShieldCheck, MapPin, Network, Monitor, Zap, Info, ArrowUpRight, ShieldAlert, Key, Eye, EyeOff, RefreshCw, Filter, Loader2
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
  const [txnIdFilter, setTxnIdFilter] = useState('')
  const [tempTxnIdFilter, setTempTxnIdFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [tempStartDate, setTempStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tempStatus, setTempStatus] = useState('all')
  const [merchantFilter, setMerchantFilter] = useState('all')
  const [tempMerchantFilter, setTempMerchantFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [tempAccountFilter, setTempAccountFilter] = useState('all')
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [merchantOptions, setMerchantOptions] = useState([])
  const [accountOptions, setAccountOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [failureSummary, setFailureSummary] = useState({ failedTotal: 0, failedToday: 0, failedYesterday: 0 })

  // Advanced search states
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [tempAmount, setTempAmount] = useState('')
  const [tempMasking, setTempMasking] = useState('')
  const [tempFrom, setTempFrom] = useState('')
  const [tempTrxid, setTempTrxid] = useState('')
  const [tempPmDateStart, setTempPmDateStart] = useState('')
  const [tempPmDateEnd, setTempPmDateEnd] = useState('')
  const [tempPmTimeStart, setTempPmTimeStart] = useState('')
  const [tempPmTimeEnd, setTempPmTimeEnd] = useState('')
  const [tempDeviceName, setTempDeviceName] = useState('')
  const [tempDeviceId, setTempDeviceId] = useState('')
  const [tempBdTimeStart, setTempBdTimeStart] = useState('')
  const [tempBdTimeEnd, setTempBdTimeEnd] = useState('')
  const [tempVerify, setTempVerify] = useState('all')

  const [appliedFilters, setAppliedFilters] = useState({
    amount: '',
    masking: '',
    from: '',
    trxid: '',
    pmDateStart: '',
    pmDateEnd: '',
    pmTimeStart: '',
    pmTimeEnd: '',
    deviceName: '',
    deviceId: '',
    bdTimeStart: '',
    bdTimeEnd: '',
    verify: 'all'
  })

  useEffect(() => {
    fetchData()
  }, [token, page, searchQuery, txnIdFilter, startDate, endDate, statusFilter, appliedFilters])

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const loadFilterOptions = async () => {
      setLoadingOptions(true)
      try {
        const [businessRes, firstUserPage] = await Promise.all([
          listOpayBusinesses(token),
          listUsers(token, { page: 1, limit: 100 })
        ])

        if (cancelled) return

        setMerchantOptions(Array.isArray(businessRes?.data) ? businessRes.data : [])

        const allUsers = Array.isArray(firstUserPage?.data) ? [...firstUserPage.data] : []
        const totalUsers = Number(firstUserPage?.total || 0)
        const pageSize = Array.isArray(firstUserPage?.data) ? firstUserPage.data.length : 0

        if (totalUsers > pageSize && pageSize > 0) {
          const totalPages = Math.ceil(totalUsers / pageSize)
          const extraPages = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) => index + 2)
              .map(pageNumber => listUsers(token, { page: pageNumber, limit: pageSize }))
          )

          extraPages.forEach(pageResult => {
            if (Array.isArray(pageResult?.data)) {
              allUsers.push(...pageResult.data)
            }
          })
        }

        if (cancelled) return

        setAccountOptions(allUsers.filter(user => ['wallet_agent', 'user'].includes(user?.role)))
      } catch (error) {
        console.error('Failed to load payment session filter options', error)
      } finally {
        if (!cancelled) setLoadingOptions(false)
      }
    }

    loadFilterOptions()

    return () => {
      cancelled = true
    }
  }, [token])

  async function fetchData() {
    if (!token) return
    setLoading(true)
    try {
      const qs = { page, limit: 50, search: searchQuery }
      if (txnIdFilter) qs.txnId = txnIdFilter
      if (startDate) qs.startDate = startDate
      if (endDate) qs.endDate = endDate
      if (statusFilter !== 'all') qs.status = statusFilter
      if (merchantFilter !== 'all') qs.businessId = merchantFilter
      if (accountFilter !== 'all') qs.targetOwnerId = accountFilter
      
      // Inject active advanced filters
      if (appliedFilters.amount) qs.f_amount = appliedFilters.amount
      if (appliedFilters.masking) qs.f_masking = appliedFilters.masking
      if (appliedFilters.from) qs.f_from = appliedFilters.from
      if (appliedFilters.trxid) qs.f_trxid = appliedFilters.trxid
      if (appliedFilters.pmDateStart) qs.f_pmDateStart = appliedFilters.pmDateStart
      if (appliedFilters.pmDateEnd) qs.f_pmDateEnd = appliedFilters.pmDateEnd
      if (appliedFilters.pmTimeStart) qs.f_pmTimeStart = appliedFilters.pmTimeStart
      if (appliedFilters.pmTimeEnd) qs.f_pmTimeEnd = appliedFilters.pmTimeEnd
      if (appliedFilters.deviceName) qs.f_deviceName = appliedFilters.deviceName
      if (appliedFilters.deviceId) qs.f_deviceId = appliedFilters.deviceId
      if (appliedFilters.bdTimeStart) qs.f_bdTimeStart = appliedFilters.bdTimeStart
      if (appliedFilters.bdTimeEnd) qs.f_bdTimeEnd = appliedFilters.bdTimeEnd
      if (appliedFilters.verify !== 'all') qs.f_verify = appliedFilters.verify
      
      const res = await getPaymentSessionsAdmin(token, qs)
      if (res.success) {
        setItems(res.data || [])
        setTotal(res.total || 0)
        setFailureSummary(res.summary || { failedTotal: 0, failedToday: 0, failedYesterday: 0 })
        setLastUpdated(new Date())
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
    setTxnIdFilter(tempTxnIdFilter)
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
    setStatusFilter(tempStatus)
    setMerchantFilter(tempMerchantFilter)
    setAccountFilter(tempAccountFilter)
    setAppliedFilters({
      amount: tempAmount,
      masking: tempMasking,
      from: tempFrom,
      trxid: tempTrxid,
      pmDateStart: tempPmDateStart,
      pmDateEnd: tempPmDateEnd,
      pmTimeStart: tempPmTimeStart,
      pmTimeEnd: tempPmTimeEnd,
      deviceName: tempDeviceName,
      deviceId: tempDeviceId,
      bdTimeStart: tempBdTimeStart,
      bdTimeEnd: tempBdTimeEnd,
      verify: tempVerify
    })
  }

  const clearFilters = () => {
    setTempSearch('')
    setSearchQuery('')
    setTempTxnIdFilter('')
    setTxnIdFilter('')
    setTempStartDate('')
    setStartDate('')
    setTempEndDate('')
    setEndDate('')
    setTempStatus('all')
    setStatusFilter('all')
    setTempMerchantFilter('all')
    setMerchantFilter('all')
    setTempAccountFilter('all')
    setAccountFilter('all')
    
    // Reset advanced values
    setTempAmount('')
    setTempMasking('')
    setTempFrom('')
    setTempTrxid('')
    setTempPmDateStart('')
    setTempPmDateEnd('')
    setTempPmTimeStart('')
    setTempPmTimeEnd('')
    setTempDeviceName('')
    setTempDeviceId('')
    setTempBdTimeStart('')
    setTempBdTimeEnd('')
    setTempVerify('all')

    setAppliedFilters({
      amount: '',
      masking: '',
      from: '',
      trxid: '',
      pmDateStart: '',
      pmDateEnd: '',
      pmTimeStart: '',
      pmTimeEnd: '',
      deviceName: '',
      deviceId: '',
      bdTimeStart: '',
      bdTimeEnd: '',
      verify: 'all'
    })
    setPage(1)
  }


  return (
    <div className="space-y-6 pb-12">
      {/* Minimalistic Premium Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-transparent p-8 border border-white/5 backdrop-blur-xl relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-left">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                <Network className="w-8 h-8 text-indigo-400" />
              </div>
              <span className="bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent uppercase tracking-tight">
                Link Tracking
              </span>
            </h2>
            <div className="flex items-center gap-3 text-slate-400">
              <p className="text-sm md:text-base leading-relaxed font-medium">
                Real-time monitoring and advanced traceability for all payment links.
              </p>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/5 text-[10px] font-bold">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live: {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="relative group self-stretch sm:self-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-black/40 border border-white/10 rounded-2xl p-4 text-center min-w-[140px] backdrop-blur-xl">
              <div className="text-3xl font-mono font-black text-white tracking-tighter">{total}</div>
              <div className="text-[10px] text-indigo-400 uppercase tracking-widest mt-1 font-black">Tracking Links</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Premium Filter Dashboard Panel */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl bg-black/40 border border-white/5 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden"
      >
        {/* Soft glowing ambient light */}
        <div className="absolute top-0 left-10 w-72 h-72 bg-indigo-500/5 blur-[80px] pointer-events-none" />

        <form onSubmit={handleSearch} className="space-y-6 relative z-10">
          {/* Header of Filters */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <Filter className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Search Console</h3>
            </div>
            
            {/* Active filters count badge */}
            {(searchQuery || startDate || endDate || statusFilter !== 'all' || merchantFilter !== 'all' || accountFilter !== 'all' || Object.values(appliedFilters).some(v => v !== '' && v !== 'all')) && (
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase tracking-widest animate-pulse">
                Active Custom Filters
              </span>
            )}
          </div>

          {/* Quick Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
            {/* Search Query */}
            <div className="space-y-2 text-left">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Global Query</label>
              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  placeholder="ID, user, trx, amount..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-sm rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-500 hover:border-slate-400/80"
                />
              </div>
            </div>

            {/* Txn ID */}
            <div className="space-y-2 text-left">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Txn ID</label>
              <div className="relative group">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search TrxID..."
                  value={tempTxnIdFilter}
                  onChange={(e) => setTempTxnIdFilter(e.target.value)}
                  className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-sm rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-500 hover:border-slate-400/80"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2 text-left">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Session Status</label>
              <select
                value={tempStatus}
                onChange={(e) => setTempStatus(e.target.value)}
                className="w-full bg-white/90 border border-slate-300/70 text-slate-900 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all cursor-pointer hover:border-slate-400/80"
              >
                <option className="text-slate-900" value="all">All Statuses</option>
                <option className="text-slate-900" value="paid">Paid</option>
                <option className="text-slate-900" value="pending">Pending</option>
                <option className="text-slate-900" value="expired">Expired</option>
              </select>
            </div>

            {/* Merchant */}
            <div className="space-y-2 text-left lg:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Merchant / Opay Business</label>
              <select
                value={tempMerchantFilter}
                onChange={(e) => setTempMerchantFilter(e.target.value)}
                disabled={loadingOptions}
                className="w-full bg-white/90 border border-slate-300/70 text-slate-900 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all cursor-pointer hover:border-slate-400/80 disabled:opacity-60"
              >
                <option className="text-slate-900" value="all">All Merchants</option>
                {merchantOptions.map((merchant) => (
                  <option className="text-slate-900" key={merchant._id} value={merchant._id}>
                    {merchant.name || merchant.domain || merchant.email || 'Unnamed Merchant'}
                  </option>
                ))}
              </select>
            </div>

            {/* Wallet Agent / User */}
            <div className="space-y-2 text-left lg:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Wallet Agent / User</label>
              <select
                value={tempAccountFilter}
                onChange={(e) => setTempAccountFilter(e.target.value)}
                disabled={loadingOptions}
                className="w-full bg-white/90 border border-slate-300/70 text-slate-900 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all cursor-pointer hover:border-slate-400/80 disabled:opacity-60"
              >
                <option className="text-slate-900" value="all">All Wallet Agents / Users</option>
                {accountOptions.map((account) => (
                  <option className="text-slate-900" key={account._id} value={account._id}>
                    {account.name || account.email || account.phone || 'Unnamed User'} {account.role ? `(${account.role.replace('_', ' ')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-2 text-left">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Session Start Date</label>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-full bg-white/90 border border-slate-300/70 text-slate-900 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all hover:border-slate-400/80"
              />
            </div>

            {/* End Date */}
            <div className="space-y-2 text-left">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-1">Session End Date</label>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="w-full bg-white/90 border border-slate-300/70 text-slate-900 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all hover:border-slate-400/80"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-rose-300">Txn ID Count</div>
                <div className="mt-1 text-2xl font-black text-white font-mono">{failureSummary.failedTotal || 0}</div>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">Today</div>
                <div className="mt-1 text-2xl font-black text-white font-mono">{failureSummary.failedToday || 0}</div>
              </div>
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-sky-200">Yesterday</div>
                <div className="mt-1 text-2xl font-black text-white font-mono">{failureSummary.failedYesterday || 0}</div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-4 py-2.5 rounded-2xl font-bold border transition-all text-xs flex items-center gap-2 ${
                showAdvanced 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${showAdvanced ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
              {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            </button>

            <div className="flex items-center gap-3">
              {(searchQuery || startDate || endDate || statusFilter !== 'all' || merchantFilter !== 'all' || accountFilter !== 'all' || Object.values(appliedFilters).some(v => v !== '' && v !== 'all')) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={loading}
                  className="px-4 py-2.5 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-2xl transition-all border border-white/5 flex items-center gap-2 text-xs group"
                >
                  <RefreshCw className={`h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
                  Reset Filters
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 text-xs"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {loading ? 'Searching...' : 'Apply Filters'}
              </button>
            </div>
          </div>

          {/* Advanced Drawer */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden border-t border-white/5 pt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 text-left"
              >
                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">SMS Amount</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={tempAmount}
                    onChange={(e) => setTempAmount(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* Masking */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">Gateway Masking</label>
                  <input
                    type="text"
                    placeholder="e.g. bKash, 16216"
                    value={tempMasking}
                    onChange={(e) => setTempMasking(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* From Phone */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">From Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 017xxxxxxxx"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* TrxID */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">Transaction ID (TrxID)</label>
                  <input
                    type="text"
                    placeholder="e.g. BKB123XYZ"
                    value={tempTrxid}
                    onChange={(e) => setTempTrxid(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* Device Name */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">Device Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Xiaomi"
                    value={tempDeviceName}
                    onChange={(e) => setTempDeviceName(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all"
                  />
                </div>

                {/* Device ID */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">Device ID</label>
                  <input
                    type="text"
                    placeholder="e.g. dev_xxxx"
                    value={tempDeviceId}
                    onChange={(e) => setTempDeviceId(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* Payment Message Verified */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">SMS Verification</label>
                  <select
                    value={tempVerify}
                    onChange={(e) => setTempVerify(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/40 transition-all cursor-pointer"
                  >
                    <option className="text-slate-900" value="all">All</option>
                    <option className="text-slate-900" value="true">Verified (True)</option>
                    <option className="text-slate-900" value="false">Unverified (False)</option>
                  </select>
                </div>

                {/* SMS Date - Start */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">SMS Date (Start)</label>
                  <input
                    type="date"
                    value={tempPmDateStart}
                    onChange={(e) => setTempPmDateStart(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/40 transition-all"
                  />
                </div>

                {/* SMS Date - End */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">SMS Date (End)</label>
                  <input
                    type="date"
                    value={tempPmDateEnd}
                    onChange={(e) => setTempPmDateEnd(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/40 transition-all"
                  />
                </div>

                {/* SMS Time - Start */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">SMS Time (Start)</label>
                  <input
                    type="text"
                    placeholder="HH:MM:SS"
                    value={tempPmTimeStart}
                    onChange={(e) => setTempPmTimeStart(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* SMS Time - End */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">SMS Time (End)</label>
                  <input
                    type="text"
                    placeholder="HH:MM:SS"
                    value={tempPmTimeEnd}
                    onChange={(e) => setTempPmTimeEnd(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* BDTimeZone Start */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">BD Time (Start)</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-05-18"
                    value={tempBdTimeStart}
                    onChange={(e) => setTempBdTimeStart(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>

                {/* BDTimeZone End */}
                <div className="space-y-1">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest ml-1">BD Time (End)</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-05-19"
                    value={tempBdTimeEnd}
                    onChange={(e) => setTempBdTimeEnd(e.target.value)}
                    className="w-full bg-white/90 border border-slate-300/70 text-slate-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>

      <div className="space-y-6 relative min-h-[400px]">
        {/* Glowing Loading Bar & Overlay for Smooth UX */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/25 backdrop-blur-[2px] z-20 rounded-[2.5rem] flex items-start justify-center pt-24 pointer-events-none"
            >
              <div className="bg-black/80 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl backdrop-blur-md">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Refreshing list...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && items.length === 0 ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-[2.5rem] h-64 w-full border border-white/5" />
          ))
        ) : items.length === 0 ? (
          <div className="bg-white/5 rounded-[2.5rem] border border-white/5 p-16 text-center text-slate-500 flex flex-col items-center">
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: items.indexOf(s) * 0.05 }}
                key={s._id}
                className={`relative group bg-white/[0.03] border rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:bg-white/[0.05] ${isSuccess ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.05)]' : isExpired ? 'border-rose-500/20' : 'border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.05)]'}`}
              >
                {/* Top Status Bar - Premium Design */}
                <div className={`px-8 py-3.5 flex items-center justify-between text-[10px] font-black tracking-[0.2em] uppercase border-b ${isSuccess ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isExpired ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${isSuccess ? 'bg-emerald-500/20' : isExpired ? 'bg-rose-500/20' : 'bg-indigo-500/20'}`}>
                      {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : isExpired ? <ShieldAlert className="w-4 h-4" /> : <Clock className="w-4 h-4 animate-pulse" />}
                    </div>
                    {isSuccess ? 'Payment Verified & Settled' : isExpired ? 'Session Expired / Cancelled' : 'Payment Link Active & Pending'}
                  </div>
                  {isSuccess && s.paymentMessage && (
                    <div className="flex items-center gap-3 opacity-80">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline-block font-mono">{new Date(s.paymentMessage.createdAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="p-8">
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

                  {/* Financial Settlement — always visible for paid sessions */}
                  {isSuccess && (s.walletAgentSnapshot || s.merchantSnapshot) && (
                    <div className="mt-6 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/30 via-slate-900/40 to-amber-950/20 overflow-hidden">
                      {/* Header */}
                      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 bg-white/[0.02]">
                        <Activity className="w-4 h-4 text-violet-400" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-violet-300">Financial Settlement</span>
                        <div className="ml-auto flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" /> SETTLED
                        </div>
                      </div>

                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Wallet Agent Credit */}
                        {s.walletAgentSnapshot && (
                          <div className="bg-black/30 rounded-xl border border-violet-500/20 overflow-hidden">
                            <div className="px-4 py-2.5 bg-violet-500/10 border-b border-violet-500/15 flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-violet-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Wallet Agent Credit</span>
                              <span className="ml-auto text-[10px] font-bold text-violet-200 truncate max-w-[120px]">{s.walletAgentSnapshot.agentName}</span>
                            </div>
                            <div className="p-4 flex items-center gap-3">
                              {/* Before */}
                              <div className="flex-1 text-center bg-white/5 rounded-lg p-3">
                                <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">Before</p>
                                <p className="text-sm font-black font-mono text-slate-200">৳{Number(s.walletAgentSnapshot.creditBefore || 0).toLocaleString()}</p>
                              </div>
                              {/* Arrow */}
                              <div className="flex flex-col items-center gap-1">
                                <ArrowRight className="w-4 h-4 text-rose-400" />
                                <span className="text-[9px] font-black text-rose-400 font-mono whitespace-nowrap">-৳{Number(s.walletAgentSnapshot.creditDeducted || 0).toLocaleString()}</span>
                              </div>
                              {/* After */}
                              <div className="flex-1 text-center bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                                <p className="text-[9px] uppercase text-rose-400 font-bold mb-1">After</p>
                                <p className="text-sm font-black font-mono text-rose-300">৳{Number(s.walletAgentSnapshot.creditAfter || 0).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Merchant Balance */}
                        {s.merchantSnapshot && (
                          <div className="bg-black/30 rounded-xl border border-amber-500/20 overflow-hidden">
                            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/15 flex items-center gap-2">
                              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Merchant Balance</span>
                              <span className="ml-auto text-[10px] font-bold text-amber-200 truncate max-w-[120px]">{s.merchantSnapshot.businessName}</span>
                            </div>
                            <div className="p-4 flex items-center gap-3">
                              {/* Before */}
                              <div className="flex-1 text-center bg-white/5 rounded-lg p-3">
                                <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">Before</p>
                                <p className="text-sm font-black font-mono text-slate-200">৳{Number(s.merchantSnapshot.balanceBefore || 0).toLocaleString()}</p>
                              </div>
                              {/* Arrow */}
                              <div className="flex flex-col items-center gap-1">
                                <ArrowRight className="w-4 h-4 text-emerald-400" />
                                <span className="text-[9px] font-black text-emerald-400 font-mono whitespace-nowrap">+৳{Number(s.merchantSnapshot.balanceAdded || 0).toLocaleString()}</span>
                              </div>
                              {/* After */}
                              <div className="flex-1 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                <p className="text-[9px] uppercase text-emerald-400 font-bold mb-1">After</p>
                                <p className="text-sm font-black font-mono text-emerald-300">৳{Number(s.merchantSnapshot.balanceAfter || 0).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  )}

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

                          {/* AI Verification Box */}
                          {s.aiVerification && (
                            <div className="bg-cyan-950/20 p-4 border border-cyan-500/20 rounded-2xl md:col-span-4 mt-2">
                              <div className="text-[10px] uppercase font-bold text-cyan-400 mb-3 flex items-center gap-1.5 border-b border-cyan-500/20 pb-2">
                                <ShieldCheck className="w-3.5 h-3.5" /> AI Forensic Scan Details
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                                <div>
                                  <div className="text-[9px] uppercase text-cyan-500 mb-0.5">Model Used</div>
                                  <div className="text-[11px] font-mono text-cyan-200">{s.aiVerification.model || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-cyan-500 mb-0.5">Verification Method</div>
                                  <div className="text-[11px] font-mono text-cyan-200">{s.aiVerification.methodUsed || 'N/A'}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-cyan-500 mb-0.5">AI Status</div>
                                  <div className={`text-[11px] font-bold ${s.aiVerification.status ? 'text-emerald-400' : 'text-rose-400'}`}>{s.aiVerification.status ? 'VERIFIED' : 'FAILED'}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-cyan-500 mb-0.5">Risk Flag</div>
                                  <div className="text-[11px] font-mono text-cyan-200 uppercase">{s.aiVerification.risk_flag || 'N/A'}</div>
                                </div>
                                <div className="md:col-span-4 lg:col-span-5">
                                  <div className="text-[9px] uppercase text-cyan-500 mb-0.5">AI Reason / Feedback</div>
                                  <div className="text-sm text-slate-300 font-medium">{s.aiVerification.reason || 'N/A'}</div>
                                </div>
                                {s.aiVerification.promptData && (
                                  <div className="md:col-span-4 lg:col-span-5 mt-1">
                                    <div className="text-[9px] uppercase text-cyan-500 mb-1">Prompt Data Analyzed by AI</div>
                                    <pre className="text-[10px] font-mono text-cyan-100/70 bg-black/40 p-3 rounded-xl border border-cyan-500/10 max-h-48 overflow-y-auto whitespace-pre-wrap shadow-inner">
                                      {JSON.stringify(s.aiVerification.promptData, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Callback Webhook Details */}
                          {s.callbackResult && (
                            <div className={`${s.callbackResult.success ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-rose-950/20 border-rose-500/20'} p-4 border rounded-2xl md:col-span-4 mt-2`}>
                              <div className={`text-[10px] uppercase font-bold mb-3 flex items-center gap-1.5 border-b pb-2 ${s.callbackResult.success ? 'text-emerald-400 border-emerald-500/20' : 'text-rose-400 border-rose-500/20'}`}>
                                <Globe className="w-3.5 h-3.5" /> Webhook Callback Delivery Status
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div>
                                  <div className={`text-[9px] uppercase mb-1 ${s.callbackResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>Status: {s.callbackResult.success ? 'SUCCESS' : 'FAILED'} (HTTP {s.callbackResult.statusCode || 'ERROR'})</div>
                                  {s.callbackResult.error && (
                                    <div className="text-[10px] text-rose-300 mb-2">{s.callbackResult.error}</div>
                                  )}
                                  <div className="text-[9px] uppercase text-slate-500 mb-1 mt-2">Payload Sent to Merchant</div>
                                  <pre className="text-[11px] font-mono text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5 max-h-48 overflow-y-auto whitespace-pre-wrap shadow-inner">
                                    {JSON.stringify(s.callbackResult.payloadSent, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase text-slate-500 mb-1 mt-2">Response Received from Merchant</div>
                                  <pre className="text-[11px] font-mono text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5 max-h-48 overflow-y-auto whitespace-pre-wrap shadow-inner">
                                    {JSON.stringify(s.callbackResult.responseReceived, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Wallet Agent Credit + Merchant Balance Snapshot */}
                          {(s.walletAgentSnapshot || s.merchantSnapshot) && (
                            <div className="bg-gradient-to-br from-violet-950/30 to-amber-950/20 p-5 border border-violet-500/20 rounded-2xl md:col-span-4 mt-2">
                              <div className="text-[10px] uppercase font-bold text-violet-300 mb-4 flex items-center gap-2 border-b border-violet-500/20 pb-2">
                                <Activity className="w-3.5 h-3.5" /> Financial Settlement Snapshot
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {s.walletAgentSnapshot && (
                                  <div className="bg-black/30 rounded-2xl p-4 border border-violet-500/20">
                                    <div className="text-[10px] uppercase font-bold text-violet-400 mb-3 flex items-center gap-1.5">
                                      <User className="w-3 h-3" /> Wallet Agent Credit Deducted
                                    </div>
                                    <div className="text-sm font-bold text-violet-200 mb-3">{s.walletAgentSnapshot.agentName || 'Unknown Agent'}</div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                        <span className="text-[10px] uppercase text-slate-400">Before</span>
                                        <span className="font-mono font-bold text-slate-300">৳{Number(s.walletAgentSnapshot.creditBefore || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                                        <span className="text-[10px] uppercase text-rose-400">Deducted</span>
                                        <span className="font-mono font-bold text-rose-400">– ৳{Number(s.walletAgentSnapshot.creditDeducted || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                                        <span className="text-[10px] uppercase text-emerald-400">After</span>
                                        <span className="font-mono font-bold text-emerald-400">৳{Number(s.walletAgentSnapshot.creditAfter || 0).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {s.merchantSnapshot && (
                                  <div className="bg-black/30 rounded-2xl p-4 border border-amber-500/20">
                                    <div className="text-[10px] uppercase font-bold text-amber-400 mb-3 flex items-center gap-1.5">
                                      <Briefcase className="w-3 h-3" /> Merchant Balance Added
                                    </div>
                                    <div className="text-sm font-bold text-amber-200 mb-3">{s.merchantSnapshot.businessName || 'Unknown Merchant'}</div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                        <span className="text-[10px] uppercase text-slate-400">Before</span>
                                        <span className="font-mono font-bold text-slate-300">৳{Number(s.merchantSnapshot.balanceBefore || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                                        <span className="text-[10px] uppercase text-emerald-400">Added</span>
                                        <span className="font-mono font-bold text-emerald-400">+ ৳{Number(s.merchantSnapshot.balanceAdded || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                                        <span className="text-[10px] uppercase text-amber-400">After</span>
                                        <span className="font-mono font-bold text-amber-400">৳{Number(s.merchantSnapshot.balanceAfter || 0).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
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

      {/* Sleek Premium Pagination Console */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 bg-black/30 border border-white/5 backdrop-blur-xl p-4 rounded-[2rem] shadow-xl relative z-10">
          {/* Item count summary */}
          <div className="text-xs text-slate-400 font-medium">
            Showing <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{(page - 1) * 50 + 1}</span> to{' '}
            <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{Math.min(page * 50, total)}</span> of{' '}
            <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{total}</span> items
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1 || loading}
              onClick={() => {
                setPage(1)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition-all"
              title="First Page"
            >
              First
            </button>
            
            <button
              disabled={page === 1 || loading}
              onClick={() => {
                setPage(p => Math.max(1, p - 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition-all"
            >
              Prev
            </button>

            <div className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-black font-mono shadow-md shadow-indigo-600/10">
              {page} / {Math.ceil(total / 50) || 1}
            </div>

            <button
              disabled={page >= (Math.ceil(total / 50) || 1) || loading}
              onClick={() => {
                setPage(p => Math.min((Math.ceil(total / 50) || 1), p + 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition-all"
            >
              Next
            </button>

            <button
              disabled={page >= (Math.ceil(total / 50) || 1) || loading}
              onClick={() => {
                setPage(Math.ceil(total / 50) || 1)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition-all"
              title="Last Page"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
