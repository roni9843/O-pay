import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listPayments } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { 
  MessageSquareText, Search, Filter, RefreshCw, 
  CheckCircle2, XCircle, Smartphone, User, Clock,
  ArrowUpRight, AlertCircle, Loader2, Eye
} from 'lucide-react'
import { format } from 'date-fns'

export default function PaymentMessages() {
  const token = useAuthStore(s => s.token)
  const PAGE_SIZE = 50
  
  // State
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  
  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, verified, unverified

  // Debounced Search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch Data
  useEffect(() => {
    fetchData()
  }, [token, page, debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE))
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  async function fetchData() {
    if (!token) return
    setLoading(true)
    try {
      const res = await listPayments(token, {
        page,
        limit: PAGE_SIZE,
        q: debouncedSearch,
        status: statusFilter === 'all' ? undefined : statusFilter
      })
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

  // Formatters
  const formatTime = (isoString) => {
    if (!isoString || isoString === 'null') return '—'
    try {
      return format(new Date(isoString), 'PP p')
    } catch (e) {
      return isoString
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-8 border border-white/5 backdrop-blur-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <MessageSquareText className="w-8 h-8 text-blue-400" />
              <span className="bg-gradient-to-r from-blue-200 via-indigo-200 to-white bg-clip-text text-transparent">
                Payment Messages
              </span>
            </h2>
            <p className="text-slate-400 mt-2 max-w-xl">
              Real-time monitoring of all incoming payment SMS messages from devices.
              View verified and unverified transactions with full device context.
            </p>
          </div>

          <div className="flex items-center gap-4">
             <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center min-w-[120px]">
                <div className="text-2xl font-mono font-bold text-white">{total}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Total Msgs</div>
             </div>
          </div>
        </div>
      </motion.div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md sticky top-4 z-30 shadow-2xl shadow-black/50">
         
         {/* Search */}
         <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by TrxID, Message, User, Email..." 
              className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:bg-black/40 focus:border-blue-500/50 transition-all font-mono text-sm"
            />
         </div>

         <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
               {['all', 'verified', 'unverified'].map(s => (
                 <button
                   key={s}
                   onClick={() => { setStatusFilter(s); setPage(1); }}
                   className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                     statusFilter === s 
                     ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                     : 'text-slate-400 hover:text-white hover:bg-white/5'
                   }`}
                 >
                   {s}
                 </button>
               ))}
            </div>

            <button 
              onClick={fetchData} 
              className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/10 transition-colors"
              title="Refresh"
            >
               <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
         </div>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {loading && items.length === 0 ? (
           <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p>Loading messages...</p>
           </div>
        ) : items.length === 0 ? (
           <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <Search className="w-10 h-10 opacity-20" />
              <p>No messages found matching your criteria</p>
           </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item, i) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group relative bg-[#0a0a1a] hover:bg-[#111122] border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-all overflow-hidden"
              >
                 {/* Status Stripe */}
                 <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.verify ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                 
                 <div className="flex flex-col lg:flex-row gap-6 relative z-10 pl-2">
                    {/* Main Info */}
                    <div className="flex-1 space-y-3">
                       <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                             <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                               item.verify 
                               ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                               : 'bg-slate-700/30 border-slate-600/30 text-slate-400'
                             }`}>
                                {item.verify ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {item.verify ? 'Verified' : 'Unverified'}
                             </span>
                             <span className="text-slate-500 text-xs font-mono">{formatTime(item.createdAt)}</span>
                          </div>
                          
                          {/* Amount */}
                          <div className="text-right">
                             <div className="text-xl font-bold text-white font-mono">
                                ৳{item.amount?.toLocaleString() ?? 0}
                             </div>
                             <div className="text-[10px] text-slate-500 uppercase tracking-widest">{item.title}</div>
                          </div>
                       </div>

                       {/* Message Content */}
                       <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                          <p className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                             {item.fullMessage}
                          </p>
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                             <div className="flex items-center gap-2 text-xs text-blue-400 font-bold bg-blue-500/5 px-2 py-1 rounded">
                                <span>TRX ID:</span>
                                <span className="select-all font-mono">{item.trxID}</span>
                             </div>
                             {item.from !== 'null' && (
                               <div className="text-xs text-slate-500">From: {item.from}</div>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* Metadata Column */}
                    <div className="lg:w-72 flex flex-col gap-3 py-1 border-t lg:border-t-0 lg:border-l border-white/5 lg:pl-6">
                       {/* User Info */}
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                             <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">User</div>
                             {item.owner ? (
                                <div className="text-sm text-white font-medium truncate" title={item.owner.email}>
                                   {item.owner.name}
                                </div>
                             ) : (
                                <div className="text-sm text-slate-600 italic">Unknown Owner</div>
                             )}
                          </div>
                       </div>

                       {/* Device Info */}
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                             <Smartphone className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Device</div>
                             <div className="text-sm text-slate-300 truncate font-mono" title={item.deviceResolved?.deviceCode || item.deviceId}>
                                {item.deviceResolved?.deviceName || item.deviceName}
                             </div>
                             {item.deviceResolved?.deviceUserName && (
                               <div className="text-xs text-slate-500 truncate">@{item.deviceResolved.deviceUserName}</div>
                             )}
                          </div>
                       </div>

                       {/* Verification Time */}
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                             <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Device Time</div>
                             <div className="text-xs text-slate-400 font-mono truncate">
                                {item.deviceTime !== 'null' ? item.deviceTime : '—'}
                             </div>
                          </div>
                       </div>

                       {/* Footprint Button */}
                       {item.paymentSession && item.paymentSession.footprintUrlNonMask && (
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                             <Eye className="w-4 h-4" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Security</div>
                             <a 
                               href={item.paymentSession.footprintUrlNonMask}
                               target="_blank"
                               rel="noopener noreferrer" 
                               className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1 mt-0.5"
                             >
                               View Footprint <ArrowUpRight className="w-3 h-3" />
                             </a>
                           </div>
                         </div>
                       )}
                    </div>
                 </div>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex justify-center pt-8">
             <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
               <button 
                 disabled={!hasPrevPage}
                 onClick={() => setPage(p => Math.max(1, p - 1))}
                 className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 disabled:hover:bg-transparent"
               >
                 Previous
               </button>
               <span className="px-4 text-sm font-mono text-slate-400">Page {page} / {totalPages}</span>
               <button 
                 disabled={!hasNextPage}
                 onClick={() => setPage(p => p + 1)}
                 className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 disabled:hover:bg-transparent"
               >
                 Next
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
