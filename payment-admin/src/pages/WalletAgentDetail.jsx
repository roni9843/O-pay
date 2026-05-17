import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User as UserIcon, 
  Wallet, 
  Smartphone, 
  CreditCard, 
  PhoneCall, 
  Activity, 
  Loader2, 
  ArrowLeft,
  ShieldCheck,
  Zap,
  Info,
  Search,
  TrendingUp,
  BarChart3,
  Calendar,
  PieChart as PieChartIcon,
  DollarSign,
  XCircle
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { useAuthStore } from '../store/authStore'
import { 
  getUser, 
  getUserDevicesAdmin, 
  getUserPaymentMethodsAdmin,
  addCredit,
  addMinimumCredit,
  updatePaymentMethodStatus,
  listPayments
} from '../lib/api'

export default function WalletAgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  
  // Profile & Data States
  const [agent, setAgent] = useState(null)
  const [devices, setDevices] = useState([])
  const [methods, setMethods] = useState([])
  
  // Transaction States
  const [transactions, setTransactions] = useState([])
  const [statsData, setStatsData] = useState([]) // For charts
  const [loading, setLoading] = useState(true)
  const [trxLoading, setTrxLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [page, setPage] = useState(1)
  const [totalTrx, setTotalTrx] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('verified') // verified, all, unverified
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const PAGE_SIZE = 15

  // Controls
  const [creditInput, setCreditInput] = useState('')
  const [creditSaving, setCreditSaving] = useState(false)
  const [minCreditInput, setMinCreditInput] = useState('')
  const [minCreditSaving, setMinCreditSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState({})

  // Debounced Search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!token || !id) return
    loadInitialData()
  }, [id, token])

  useEffect(() => {
    if (!token || !id) return
    fetchTransactions()
  }, [id, token, page, debouncedSearch, statusFilter, fromDate, toDate])

  useEffect(() => {
    if (!token || !id) return
    fetchStatsData()
  }, [id, token])

  async function loadInitialData() {
    setLoading(true)
    setError('')
    try {
      const [uRes, dRes, mRes] = await Promise.all([
        getUser(token, id),
        getUserDevicesAdmin(token, id),
        getUserPaymentMethodsAdmin(token, id)
      ])
      
      setAgent(uRes.data || uRes)
      setDevices(dRes.data || [])
      setMethods(mRes.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load agent details')
    } finally {
      setLoading(false)
    }
  }

  async function fetchStatsData() {
    if (!token || !id) return
    setStatsLoading(true)
    try {
      // Fetch more data for charts (last 30 days roughly)
      const res = await listPayments(token, { 
        owner: id, 
        status: 'verified',
        limit: 500 // Get enough for 30 days
      })
      
      const raw = res.data || []
      // Process for chart
      const groups = {}
      raw.forEach(t => {
        const date = new Date(t.createdAt).toLocaleDateString()
        if (!groups[date]) groups[date] = { date, amount: 0, count: 0 }
        groups[date].amount += (t.amount || 0)
        groups[date].count += 1
      })
      
      const chartData = Object.values(groups)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30) // Last 30 days
        
      setStatsData(chartData)
    } catch (e) {
      console.error('Stats load failed:', e)
    } finally {
      setStatsLoading(false)
    }
  }

  async function fetchTransactions() {
    if (!token || !id) return
    setTrxLoading(true)
    try {
      const pRes = await listPayments(token, { 
        owner: id, 
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: PAGE_SIZE,
        q: debouncedSearch,
        from: fromDate || undefined,
        to: toDate || undefined
      })
      setTransactions(pRes.data || [])
      setTotalTrx(pRes.total || 0)
    } catch (e) {
      console.error('Failed to load transactions:', e)
    } finally {
      setTrxLoading(false)
    }
  }

  const handleAddCredit = async () => {
    const amount = Number(creditInput)
    if (!amount) return
    setCreditSaving(true)
    try {
      await addCredit(token, id, amount, 'inc')
      setCreditInput('')
      loadData()
    } catch (e) {
      alert(e.message)
    } finally {
      setCreditSaving(false)
    }
  }

  const handleUpdateMinCredit = async () => {
    const amount = Number(minCreditInput)
    if (isNaN(amount)) return
    setMinCreditSaving(true)
    try {
      await addMinimumCredit(token, id, amount, 'inc')
      setMinCreditInput('')
      loadData()
    } catch (e) {
      alert(e.message)
    } finally {
      setMinCreditSaving(false)
    }
  }

  const handleToggleStatus = async (method) => {
    const nextStatus = method.status === 'active' ? 'inactive' : 'active'
    setUpdatingStatus(prev => ({ ...prev, [method._id]: true }))
    try {
      await updatePaymentMethodStatus(token, method._id, nextStatus)
      loadData()
    } catch (e) {
      alert(e.message)
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [method._id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
        <p className="animate-pulse font-medium">Analyzing Agent Profile...</p>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300">
        {error || 'Agent not found'}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Nav & Action */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="font-semibold">Back to Cluster</span>
        </button>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Verified Agent
        </div>
      </div>

      {/* Profile Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/40 to-slate-800/30 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-[120px] -mr-48 -mt-48" />
        
        <div className="relative flex flex-col md:flex-row gap-8 items-start">
          <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-600 p-[2px] shadow-2xl shadow-violet-500/20">
            <div className="h-full w-full rounded-[1.9rem] bg-[#0a0a1a] flex items-center justify-center">
              <span className="text-4xl font-bold text-white">{(agent.name || agent.email).charAt(0).toUpperCase()}</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{agent.name || 'Anonymous Agent'}</h1>
              <p className="text-slate-400 font-mono text-sm mt-1">{agent.email}</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="px-3 py-1 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <Activity className="w-3 h-3"/> Wallet Agent
              </div>
              <div className="px-3 py-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <Smartphone className="w-3 h-3"/> {devices.length} Devices
              </div>
              <div className="px-3 py-1 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <PhoneCall className="w-3 h-3"/> {methods.length} SIM Slots
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px]">
             <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Main Balance</p>
                <p className="text-2xl font-bold text-white tracking-tight">৳{(agent.balance ?? 0).toFixed(2)}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard 
            title="Today's Volume" 
            value={statsData[statsData.length - 1]?.amount || 0} 
            icon={<TrendingUp className="w-5 h-5" />} 
            color="violet"
            isCurrency={true}
            sub={`From ${statsData[statsData.length - 1]?.count || 0} txns`}
         />
         <StatCard 
            title="Avg. Daily" 
            value={statsData.reduce((acc, curr) => acc + curr.amount, 0) / (statsData.length || 1)} 
            icon={<BarChart3 className="w-5 h-5" />} 
            color="sky"
            isCurrency={true}
            sub="Last 30 days average"
         />
         <StatCard 
            title="Active SIMs" 
            value={methods.filter(m => m.status === 'active').length} 
            icon={<Smartphone className="w-5 h-5" />} 
            color="emerald"
            isCurrency={false}
            sub={`Out of ${methods.length} total`}
         />
         <StatCard 
            title="Total Revenue" 
            value={statsData.reduce((acc, curr) => acc + curr.amount, 0)} 
            icon={<DollarSign className="w-5 h-5" />} 
            color="amber"
            isCurrency={true}
            sub="Last 30 days verified"
         />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-xl space-y-6 min-h-[400px]">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-violet-400" /> Revenue Flow
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Daily income performance (30 days)</p>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-violet-500" /> Income Amount
               </div>
            </div>
            
            <div className="h-[300px] w-full">
               {statsLoading ? (
                 <div className="h-full w-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsData}>
                       <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                       <XAxis 
                         dataKey="date" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#64748b', fontSize: 10 }}
                         tickFormatter={(str) => {
                            const d = new Date(str)
                            return `${d.getDate()}/${d.getMonth() + 1}`
                         }}
                       />
                       <YAxis 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#64748b', fontSize: 10 }}
                         tickFormatter={(val) => `৳${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                       />
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '16px' }}
                         itemStyle={{ color: '#fff', fontSize: '12px' }}
                         labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
                       />
                       <Area 
                         type="monotone" 
                         dataKey="amount" 
                         stroke="#8b5cf6" 
                         strokeWidth={3}
                         fillOpacity={1} 
                         fill="url(#colorAmount)" 
                       />
                    </AreaChart>
                 </ResponsiveContainer>
               )}
            </div>
         </div>

         <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-8 backdrop-blur-xl space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
               <PieChartIcon className="w-5 h-5 text-sky-400" /> Provider Mix
            </h3>
            <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={processProviderData(transactions)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {processProviderData(transactions).map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Pie>
                     <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '16px' }}
                     />
                     <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
               </ResponsiveContainer>
            </div>
            <div className="space-y-3 pt-4">
               <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center">Top Performing Method</p>
               <div className="flex items-center justify-center gap-2 text-white font-bold">
                  <span className="p-1 px-2 rounded bg-pink-500/20 text-pink-400 text-[10px]">BKASH</span>
                  <span>৳{transactions.filter(t => t.type === 'bkash').reduce((a,c) => a + (c.amount||0), 0).toLocaleString()}</span>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Financials & Devices */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Actions / Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Credit Update */}
             <div className="rounded-[2.5rem] border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-slate-900/50 to-transparent p-8 space-y-6 shadow-2xl shadow-violet-500/20 relative overflow-hidden group">
                {/* Pulse Light Effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-[40px] animate-pulse" />
                
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-violet-500/20 text-violet-400">
                      <Wallet className="w-6 h-6" />
                    </div>
                    Wallet Credit
                  </h3>
                </div>

                <div className="relative z-10">
                   <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-1">Current Balance</p>
                   <div className="text-4xl font-black text-white tracking-tighter flex items-baseline gap-2">
                      <span className="text-violet-400">৳</span>
                      <span className="bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                        {(agent.credit ?? 0).toFixed(2)}
                      </span>
                   </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                  <input 
                    type="number"
                    value={creditInput}
                    onChange={e => setCreditInput(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg font-bold focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-slate-700"
                  />
                  <button 
                    onClick={handleAddCredit}
                    disabled={creditSaving || !creditInput}
                    className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black shadow-xl shadow-violet-900/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creditSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : 'ADD CREDIT'}
                  </button>
                </div>
             </div>

             {/* Min Credit Update */}
             <div className="rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-600/10 via-slate-900/50 to-transparent p-8 space-y-6 shadow-2xl shadow-amber-500/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[40px]" />

                <div className="flex items-center justify-between relative z-10">
                  <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    Minimum Limit
                  </h3>
                </div>

                <div className="relative z-10">
                   <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-1">Safety Threshold</p>
                   <div className="text-4xl font-black text-white tracking-tighter flex items-baseline gap-2">
                      <span className="text-amber-400">৳</span>
                      <span className="bg-gradient-to-r from-white to-amber-200 bg-clip-text text-transparent">
                        {(agent.minimumCredit ?? 0).toFixed(2)}
                      </span>
                   </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                  <input 
                    type="number"
                    value={minCreditInput}
                    onChange={e => setMinCreditInput(e.target.value)}
                    placeholder="Set limit"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg font-bold focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-slate-700"
                  />
                  <button 
                    onClick={handleUpdateMinCredit}
                    disabled={minCreditSaving}
                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black shadow-xl shadow-amber-900/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {minCreditSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : 'SET LIMIT'}
                  </button>
                </div>
             </div>
          </div>

          {/* Devices Grid */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white px-2">Connected Infrastructure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 bg-white/5 border border-dashed border-white/10 rounded-3xl">
                  No active devices linked to this agent.
                </div>
              ) : (
                devices.map(device => (
                  <DeviceCard 
                    key={device._id} 
                    device={device} 
                    deviceMethods={methods.filter(m => 
                      m.deviceCode === device.deviceCode || 
                      m.deviceId === device._id || 
                      (m.device && (m.device._id === device._id || m.device === device._id))
                    )}
                  />
                ))
              )}
            </div>
          </div>

          {/* Transactions History */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
               <div>
                  <h3 className="text-xl font-bold text-white">Full Transaction History</h3>
                  <p className="text-xs text-slate-500 mt-1">Total {totalTrx} records found</p>
               </div>
               
               <div className="flex items-center gap-3">
                  {/* Status Filter */}
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    {['all', 'verified', 'unverified'].map(s => (
                      <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          statusFilter === s 
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' 
                          : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            {/* Search & Date Controls */}
            <div className="flex flex-col lg:flex-row gap-4 px-2">
               <div className="relative group flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                  <input 
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search TrxID, Amount, Phone..."
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  />
               </div>
               
               <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5">
                     <Calendar className="w-4 h-4 text-slate-500" />
                     <input 
                       type="date" 
                       value={fromDate}
                       onChange={e => { setFromDate(e.target.value); setPage(1); }}
                       className="bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]"
                     />
                     <span className="text-slate-600">to</span>
                     <input 
                       type="date" 
                       value={toDate}
                       onChange={e => { setToDate(e.target.value); setPage(1); }}
                       className="bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]"
                     />
                     {(fromDate || toDate) && (
                       <button 
                         onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
                         className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                       >
                         <XCircle className="w-3 h-3" />
                       </button>
                     )}
                  </div>
               </div>
            </div>
            
            <div className="rounded-3xl border border-white/5 bg-slate-900/30 overflow-hidden relative">
               {trxLoading && (
                 <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                 </div>
               )}

               {transactions.length === 0 ? (
                 <div className="py-20 text-center text-slate-500 italic">
                    {trxLoading ? 'Updating records...' : 'No transactions found matching your criteria.'}
                 </div>
               ) : (
                 <div className="divide-y divide-white/5">
                    {transactions.map(trx => (
                      <div key={trx._id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                         <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                              trx.type === 'bkash' ? 'bg-pink-500/20 text-pink-400' :
                              trx.type === 'nagad' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-sky-500/20 text-sky-400'
                            }`}>
                               {trx.type?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white font-mono select-all">{trx.trxID}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    trx.verify 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-slate-700/30 text-slate-400 border-white/5'
                                  }`}>
                                    {trx.verify ? 'VERIFIED' : 'PENDING'}
                                  </span>
                               </div>
                               <p className="text-[10px] text-slate-500 mt-0.5">
                                 {trx.createdAt ? new Date(trx.createdAt).toLocaleString() : 'N/A'}
                               </p>
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-6 sm:text-right">
                            <div className="hidden md:block">
                               <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Device</p>
                               <p className="text-xs text-slate-300 font-mono truncate max-w-[120px]">{trx.deviceName || 'Unknown'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Amount</p>
                               <p className="text-lg font-black text-white">৳{trx.amount?.toLocaleString()}</p>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Pagination Controls */}
            {totalTrx > PAGE_SIZE && (
               <div className="flex items-center justify-center gap-4 py-2">
                  <button 
                    disabled={page <= 1 || trxLoading}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-400">
                    Page <span className="text-white font-bold">{page}</span> of {Math.ceil(totalTrx / PAGE_SIZE)}
                  </span>
                  <button 
                    disabled={page >= Math.ceil(totalTrx / PAGE_SIZE) || trxLoading}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
               </div>
            )}
          </div>
        </div>

        {/* Right: SIM Slots / Methods Summary */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl space-y-6">
            <h3 className="font-bold text-white text-lg border-b border-white/5 pb-4">All Agent Numbers</h3>
            
            <div className="space-y-3">
              {methods.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No SIM cards detected.</p>
              ) : (
                methods.map(method => (
                  <div 
                    key={method._id}
                    className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                          method.provider === 'bkash' ? 'bg-pink-500/20 text-pink-400' :
                          method.provider === 'nagad' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-sky-500/20 text-sky-400'
                        }`}>
                          {method.provider?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm uppercase tracking-wide">{method.provider}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Slot: {method.simIndex}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleToggleStatus(method)}
                        disabled={updatingStatus[method._id]}
                        className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-all ${
                          method.status === 'active' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                        }`}
                      >
                        {updatingStatus[method._id] ? '...' : method.status.toUpperCase()}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Number</span>
                      <span className="text-white font-mono">{method.accountNumber}</span>
                    </div>
                    <div className="mt-2 text-[9px] text-slate-500 flex items-center gap-1">
                       <Smartphone className="w-2.5 h-2.5" />
                       Device: {method.deviceCode || 'N/A'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/10 flex items-start gap-3">
              <Info className="w-4 h-4 text-violet-400 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Total active gateways assigned to this agent across all linked devices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color, sub, isCurrency = true }) {
  const styles = {
    violet: 'border-violet-500/20 bg-violet-500/5 text-violet-400',
    sky: 'border-sky-500/20 bg-sky-500/5 text-sky-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  }
  return (
    <div className={`p-6 rounded-[2rem] border backdrop-blur-md space-y-3 ${styles[color]}`}>
       <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{title}</p>
          <div className="p-2 rounded-xl bg-white/5 border border-white/5">{icon}</div>
       </div>
       <div>
          <p className="text-2xl font-black text-white tracking-tight">
             {isCurrency && typeof value === 'number' && '৳'}
             {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value}
          </p>
          <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase">{sub}</p>
       </div>
    </div>
  )
}

function processProviderData(data) {
  const counts = {}
  data.forEach(t => {
    const type = t.type || 'other'
    counts[type] = (counts[type] || 0) + (t.amount || 0)
  })
  const colors = {
    bkash: '#ec4899',
    nagad: '#f97316',
    upay: '#0ea5e9',
    other: '#64748b'
  }
  return Object.entries(counts).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
    color: colors[name] || colors.other
  }))
}

function DeviceCard({ device, deviceMethods = [] }) {
  return (
    <div className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${device.online ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-slate-700/20 text-slate-500'}`}>
            <Zap className={`w-5 h-5 ${device.online ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">{device.deviceUserName || device.deviceName || 'Unnamed'}</h4>
            <p className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">{device.deviceCode || 'No ID'}</p>
          </div>
        </div>
        <div className={`h-2 w-2 rounded-full ${device.online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} />
      </div>
      
      {/* Numbers on this device */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 px-1">
          <PhoneCall className="w-3 h-3 text-sky-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active SIM Slots</span>
        </div>
        
        {deviceMethods.length === 0 ? (
          <div className="text-[10px] text-slate-600 italic px-4 py-3 rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
            No SIM slots active on this hardware.
          </div>
        ) : (
          <div className="grid gap-2">
            {deviceMethods.map(m => (
              <div key={m._id} className="group/sim flex items-center justify-between px-4 py-3 rounded-2xl bg-black/40 border border-white/5 hover:border-violet-500/30 transition-all">
                <div className="flex items-center gap-3">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                     m.provider === 'bkash' ? 'bg-pink-500/10 text-pink-400' :
                     m.provider === 'nagad' ? 'bg-orange-500/10 text-orange-400' :
                     'bg-sky-500/10 text-sky-400'
                   }`}>
                     S{m.simIndex}
                   </div>
                   <div>
                     <p className="text-[11px] font-mono font-bold text-white leading-none">{m.accountNumber}</p>
                     <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">{m.provider}</p>
                   </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  m.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                   <span className={`w-1 h-1 rounded-full ${m.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                   {m.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="space-y-3 pt-4 border-t border-white/5">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Subscription</span>
          <span className={`font-bold ${device.online ? 'text-emerald-400' : 'text-slate-400'}`}>
            {device.subscriptionEndDate ? new Date(device.subscriptionEndDate).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  )
}
