import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { getStats, getTodayStats, getTodayUserList, listDevicesOnlineStatus, listPayments } from '../lib/api'
import { io } from 'socket.io-client'
import {
  Users,
  MonitorSmartphone,
  CheckCircle2,
  Clock,
  Wallet,
  ArrowUpRight,
  Sparkles,
  Activity,
  Wifi,
  WifiOff,
  Smartphone,
  User,
  Mail,
  Shield,
  Signal,
  TrendingUp,
  Crown
} from 'lucide-react'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Dashboard() {
  const token = useAuthStore((s) => s.token)
  const [stats, setStats] = React.useState(null)
  const [todayStatsData, setTodayStatsData] = React.useState({ totalAmount: 0, topUser: null, totalTransactions: 0 })
   const [todayUserList, setTodayUserList] = React.useState([])
  const [deviceStatus, setDeviceStatus] = React.useState({ online: 0, total: 0 })
  const [onlineDevices, setOnlineDevices] = React.useState([])
  const [allPayments24h, setAllPayments24h] = React.useState([]) // All verified payments from today
  const [recentPayments, setRecentPayments] = React.useState([]) // First 8 for display
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [realtime, setRealtime] = React.useState(false)
  const socketRef = React.useRef(null)

  const loadDevices = React.useCallback(async () => {
    if (!token) return
    try {
      const devicesRes = await listDevicesOnlineStatus(token)
      const devs = devicesRes?.data || []
      const onlineDevs = devs.filter((d) => d.online).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
      const online = onlineDevs.length
      setDeviceStatus({ online, total: devs.length })
      setOnlineDevices(onlineDevs)
    } catch (err) {
      console.error('Failed to load device status:', err)
    }
  }, [token])

  React.useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
            const [statsRes, todayRes, todayUserListRes, devicesRes, paymentsRes] = await Promise.all([
               getStats(token),
               getTodayStats(token),
               getTodayUserList(token),
               listDevicesOnlineStatus(token),
               listPayments(token, { page: 1, limit: 50, status: 'verified' }),
            ])

        if (cancelled) return

            setStats(statsRes?.data || null)
            setTodayStatsData(todayRes?.data || { totalAmount: 0, topUser: null, totalTransactions: 0 })
            setTodayUserList(todayUserListRes?.data || [])
        
        const devs = devicesRes?.data || []
        const onlineDevs = devs.filter((d) => d.online).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
        const online = onlineDevs.length
        setDeviceStatus({ online, total: devs.length })
        setOnlineDevices(onlineDevs)
        
        // Filter payments to last 24h and verified
        const now = Date.now()
        const oneDay = 24 * 60 * 60 * 1000
        const verified24h = (paymentsRes?.data || [])
          .filter(p => p.verify === true || p.status === 'verified')
          .filter(p => new Date(p.createdAt).getTime() > now - oneDay)
        
        setAllPayments24h(verified24h) // Store ALL for calculations
        setRecentPayments(verified24h.slice(0, 8)) // Display only 8
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token])

  // Socket.IO listener for realtime device status updates
  React.useEffect(() => {
    if (!token) return

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setRealtime(true)
      loadDevices()
    })

    socket.on('disconnect', () => {
      setRealtime(false)
    })

    // Listen for device status changes and refresh device counts
    socket.on('device:status', loadDevices)
    socket.on('devices:update', loadDevices)

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('device:status', loadDevices)
      socket.off('devices:update', loadDevices)
      socket.close()
      socketRef.current = null
    }
  }, [token, loadDevices])

  const totalVolume = React.useMemo(
    () => todayStatsData?.totalAmount || 0,
    [todayStatsData]
  )

  const todayStats = React.useMemo(() => {
    // Use todayStatsData from API (which uses PaymentMessage model)
    return {
      totalAmount: todayStatsData?.totalAmount || 0,
      topUser: todayStatsData?.topUser,
      topUserTransactions: todayStatsData?.topUser?.count || 0
    }
  }, [todayStatsData])

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-8 border border-white/5 backdrop-blur-md"
      >
        <div className="absolute top-0 right-0 p-8 opacity-20">
           <Sparkles className="h-32 w-32 text-violet-400" />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
             <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
               Admin Overview
             </span>
             <Activity className="w-6 h-6 text-fuchsia-400 animate-pulse" />
          </h2>
          <p className="text-slate-400 max-w-xl">
             Welcome back to the control center. Here's what's happening across your payment network right now.
          </p>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-red-200"
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <AnimatedSummaryCard
          custom={0}
          title="Total Users"
          value={stats?.usersCount ?? '--'}
          icon={Users}
          color="from-blue-500 to-indigo-600"
        />
        
        <AnimatedSummaryCard
          custom={2}
          title="Verified Vol"
          value={stats?.verifiedPayments ?? '--'}
          prefix="BDT "
          icon={CheckCircle2}
          color="from-emerald-500 to-teal-600"
        />
        <AnimatedSummaryCard
          custom={3}
          title="Pending Top-ups"
          value={stats?.pendingTopUps ?? '--'}
          icon={Clock}
          color="from-amber-400 to-orange-500"
        />
        <AnimatedSummaryCard
          custom={4}
          title="Merchant Payouts"
          value={stats?.pendingWithdrawals ?? '--'}
          icon={ArrowUpRight}
          color="from-rose-500 to-red-600"
        />
        
        {/* Today's Stats - New Cards */}
        <AnimatedSummaryCard
          custom={5}
          title="Today's Volume"
               value={todayStats.totalAmount || 0}
          prefix="৳"
          icon={TrendingUp}
          color="from-cyan-500 to-blue-600"
        />
        
      </div>

         {/* Today's Paid Count by User (stylish, includes wallet agents) */}
         <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={7}
            className="rounded-3xl bg-gradient-to-br from-slate-900/40 to-slate-800/30 border border-white/5 p-6 backdrop-blur-xl mb-6 shadow-2xl w-full"
         >
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="text-lg font-bold text-white">Today's Paid Count by User</h3>
                  <p className="text-sm text-slate-400">Includes wallet agents and merchants — today's verified payments record</p>
               </div>
               <div className="text-sm text-slate-300 font-semibold">Total: {todayStatsData?.totalTransactions ?? 0} txns</div>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 uppercase font-bold border-b border-white/5">
                     <tr>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Email / Device</th>
                        <th className="px-3 py-2 text-right">Count</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {todayUserList && todayUserList.length ? todayUserList.map((r, i) => (
                        <tr key={i} className="hover:bg-white/3 transition-colors">
                           <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                 <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                                    {r.name ? r.name.split(' ').map(n=>n[0]).slice(0,2).join('') : 'AN'}
                                 </div>
                                 <div className="min-w-0">
                                    <div className="font-medium text-white truncate max-w-[180px]">{r.name}</div>
                                    <div className="text-xs text-slate-400 truncate max-w-[180px]">
                                       {r.role === 'wallet_agent' ? 'Wallet Agent' : r.role === 'merchant' ? 'Merchant' : r.userId ? 'User' : 'Wallet Agent / Device'}
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-3 py-3 text-slate-400 truncate max-w-[220px]">{r.email || (r.role ? r.email || r.name : r.name)}</td>
                           <td className="px-3 py-3 text-right font-semibold">{r.count}</td>
                           <td className="px-3 py-3 text-right">৳{Number(r.amount || 0).toLocaleString()}</td>
                        </tr>
                     )) : (
                        <tr><td className="px-3 py-6 text-slate-500" colSpan={4}>No payments today</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </motion.div>

         <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
         {/* Live Device Status - Full Width on Mobile */}
         <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={4}
            className="lg:col-span-3 relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/20 via-white/5 to-teal-600/20 border border-emerald-500/30 backdrop-blur-xl flex flex-col shadow-2xl"
         >
            {/* Animated background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full animate-pulse" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 blur-[80px] rounded-full" />
            
            <div className="relative z-10 p-6 sm:p-8 border-b border-emerald-500/20">
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                     <div className="flex items-center gap-2 mb-2">
                        <Signal className="w-5 h-5 text-emerald-400 animate-pulse" />
                        <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                           Network Status
                        </h3>
                     </div>
                     <p className="text-xs sm:text-sm text-slate-400">Live devices connectivity</p>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap ${realtime ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/20' : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'}`}>
                     {realtime ? <Wifi className="w-4 h-4 animate-pulse" /> : <WifiOff className="w-4 h-4" />}
                     {realtime ? 'Live' : 'Offline'}
                  </div>
               </div>

               {/* Stats Overview */}
               <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <motion.div 
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ delay: 0.1 }}
                     className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 text-center group hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                  >
                     <p className="text-xs text-emerald-300/80 uppercase tracking-wider mb-1 sm:mb-2 font-semibold">Online</p>
                     <p className="text-2xl sm:text-3xl font-bold text-emerald-400">{deviceStatus.online}</p>
                  </motion.div>
                  <motion.div
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ delay: 0.15 }}
                     className="p-3 sm:p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center hover:shadow-lg transition-all"
                  >
                     <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 sm:mb-2 font-semibold">Offline</p>
                     <p className="text-2xl sm:text-3xl font-bold text-slate-300">{Math.max(0, deviceStatus.total - deviceStatus.online)}</p>
                  </motion.div>
                  <motion.div
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ delay: 0.2 }}
                     className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-500/30 text-center hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                  >
                     <p className="text-xs text-blue-300/80 uppercase tracking-wider mb-1 sm:mb-2 font-semibold">Total</p>
                     <p className="text-2xl sm:text-3xl font-bold text-blue-400">{deviceStatus.total}</p>
                  </motion.div>
               </div>

               {/* Progress Bar */}
               <div className="mt-6 sm:mt-8">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs text-slate-400 font-medium">Connectivity Rate</span>
                     <span className="text-xs font-bold text-emerald-400">
                        {deviceStatus.total > 0 ? `${Math.round((deviceStatus.online / deviceStatus.total) * 100)}%` : '0%'}
                     </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden ring-1 ring-white/5">
                     <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: deviceStatus.total > 0 ? `${(deviceStatus.online / deviceStatus.total) * 100}%` : '0%' }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                     />
                  </div>
               </div>
            </div>

            {/* Device List */}
            <div className="relative z-10 flex-1 overflow-auto custom-scrollbar max-h-[500px] sm:max-h-[600px]">
               {onlineDevices.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center">
                     <Wifi className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                     <p className="text-slate-500 text-sm font-medium">No devices currently online</p>
                  </div>
               ) : (
                  <div className="divide-y divide-emerald-500/10 px-4 sm:px-6 py-4 sm:py-6">
                     {onlineDevices.map((device, idx) => (
                        <motion.div
                           key={device._id}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: idx * 0.05 }}
                           className="py-4 sm:py-5 hover:bg-white/5 rounded-lg px-3 transition-all group cursor-pointer"
                        >
                           <div className="flex items-start gap-3 sm:gap-4">
                              {/* Status Indicator */}
                              <div className="flex-shrink-0 mt-1">
                                 <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
                                 />
                              </div>

                              {/* Device Info */}
                              <div className="flex-1 min-w-0">
                                 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-2 mb-2 sm:mb-3">
                                    <div className="min-w-0">
                                       <p className="font-bold text-white text-sm sm:text-base truncate">
                                          {device.deviceName || 'Unnamed Device'}
                                       </p>
                                       <p className="text-xs text-slate-500 truncate font-mono mt-0.5">
                                          {device.deviceCode}
                                       </p>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full whitespace-nowrap mt-2 sm:mt-0 w-fit">
                                       ● Online
                                    </span>
                                 </div>

                                 {device.owner && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs bg-white/5 rounded-lg p-2 sm:p-3 border border-white/5">
                                       <div className="flex items-center gap-2 min-w-0">
                                          <User className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                          <span className="text-slate-400">Owner:</span>
                                          <span className="text-slate-200 font-medium truncate">{device.owner.name}</span>
                                       </div>
                                       <div className="flex items-center gap-2 min-w-0">
                                          <Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                          <span className="text-slate-400">Role:</span>
                                          <span className="text-amber-300 font-bold uppercase tracking-wider">{device.owner.role}</span>
                                       </div>
                                       <div className="col-span-1 sm:col-span-2 flex items-center gap-2 min-w-0">
                                          <Mail className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                          <span className="text-slate-400">Email:</span>
                                          <span className="text-slate-300 truncate text-xs">{device.owner.email}</span>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </div>
               )}
            </div>
         </motion.div>

         {/* Side Stats - Hidden on Mobile, Visible on Desktop */}
         <div className="hidden lg:flex flex-col gap-4">
            <motion.div
               variants={cardVariants}
               initial="hidden"
               animate="visible"
               custom={5}
               className="flex-1 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 p-5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all"
            >
               <div className="flex items-center gap-3 mb-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs text-emerald-300/80 uppercase tracking-wider font-semibold">Connected</p>
               </div>
               <p className="text-3xl font-bold text-emerald-400">{deviceStatus.online}</p>
               <p className="text-xs text-slate-400 mt-2">devices active</p>
            </motion.div>
            
            <motion.div
               variants={cardVariants}
               initial="hidden"
               animate="visible"
               custom={6}
               className="flex-1 rounded-2xl bg-gradient-to-br from-slate-600/20 to-slate-500/10 border border-slate-500/30 p-5 hover:border-slate-500/50 hover:shadow-lg hover:shadow-slate-500/10 transition-all"
            >
               <div className="flex items-center gap-3 mb-2">
                  <WifiOff className="w-4 h-4 text-slate-400" />
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Disconnected</p>
               </div>
               <p className="text-3xl font-bold text-slate-400">{Math.max(0, deviceStatus.total - deviceStatus.online)}</p>
               <p className="text-xs text-slate-500 mt-2">devices offline</p>
            </motion.div>

            <motion.div
               variants={cardVariants}
               initial="hidden"
               animate="visible"
               custom={7}
               className="flex-1 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
            >
               <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-blue-300/80 uppercase tracking-wider font-semibold">All Devices</p>
               </div>
               <p className="text-3xl font-bold text-blue-400">{deviceStatus.total}</p>
               <p className="text-xs text-slate-400 mt-2">in network</p>
            </motion.div>

            <motion.div
               variants={cardVariants}
               initial="hidden"
               animate="visible"
               custom={8}
               className="flex-1 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/30 p-5 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 transition-all"
            >
               <div className="flex items-center gap-3 mb-2">
                  <Signal className="w-4 h-4 text-violet-400" />
                  <p className="text-xs text-violet-300/80 uppercase tracking-wider font-semibold">Health</p>
               </div>
               <p className="text-3xl font-bold text-violet-400">
                  {deviceStatus.total > 0 ? `${Math.round((deviceStatus.online / deviceStatus.total) * 100)}%` : '0%'}
               </p>
               <p className="text-xs text-slate-400 mt-2">connectivity</p>
            </motion.div>
         </div>
      </div>

      {/* Recent Payments */}
      <div className="grid gap-6 grid-cols-1">
         {/* Recent Payments Feed */}
         <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={9}
            className="rounded-3xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 backdrop-blur-xl overflow-hidden flex flex-col shadow-xl hover:border-white/20 transition-all"
         >
            <div className="p-6 sm:p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
               <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">Recent Transactions</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">Verified transactions from the last 24 hours</p>
               </div>
               <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 text-violet-300 text-sm font-bold flex items-center gap-2 w-fit">
                  <Wallet className="w-4 h-4" />
                  ৳{Number(totalVolume || 0).toLocaleString()}
               </div>
            </div>

            <div className="flex-1 overflow-x-auto custom-scrollbar">
               <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-slate-950 z-10 text-xs uppercase text-slate-500 font-bold tracking-wider">
                     <tr>
                        <th className="px-4 sm:px-6 py-4">Transaction</th>
                        <th className="px-4 sm:px-6 py-4 hidden sm:table-cell">User</th>
                        <th className="px-4 sm:px-6 py-4 text-right">Amount</th>
                        <th className="px-4 sm:px-6 py-4 text-right hidden sm:table-cell">Time</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {loading ? (
                        [...Array(5)].map((_, i) => (
                           <tr key={i} className="animate-pulse">
                              <td colSpan={4} className="px-4 sm:px-6 py-4">
                                 <div className="h-6 bg-white/5 rounded w-full" />
                              </td>
                           </tr>
                        ))
                     ) : recentPayments.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="px-4 sm:px-6 py-12 text-center text-slate-500 italic text-sm">
                              No recent transactions found
                           </td>
                        </tr>
                     ) : (
                        recentPayments.map((p) => (
                           <tr key={p._id} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                              <td className="px-4 sm:px-6 py-4">
                                 <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                                       <ArrowUpRight className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                       <p className="font-mono text-white text-xs truncate max-w-[100px] sm:max-w-[120px] bg-slate-800/50 px-1.5 py-0.5 rounded border border-white/5">
                                          {p.trxID}
                                       </p>
                                       <p className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">
                                          {p.title || 'Unknown Method'}
                                       </p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                                 <div className="flex flex-col">
                                    <span className="text-slate-200 font-medium truncate max-w-[140px]">
                                       {p.owner?.name || 'Guest'}
                                    </span>
                                    <span className="text-xs text-slate-500 truncate max-w-[140px]">
                                       {p.owner?.email}
                                    </span>
                                 </div>
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-right">
                                 <span className="font-bold text-emerald-400 text-base">
                                    ৳{Number(p.amount).toLocaleString()}
                                 </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-right text-xs text-slate-500 font-mono hidden sm:table-cell">
                                 {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>

                {/* Today's per-user counts */}
                <div className="p-4 border-t border-white/5 bg-slate-900/20">
                   <h4 className="text-sm text-slate-300 font-semibold mb-2">Today's Paid Count by User</h4>
                   <div className="overflow-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                         <thead className="text-xs text-slate-500 uppercase font-bold">
                            <tr>
                               <th className="px-3 py-2">User</th>
                               <th className="px-3 py-2">Email / Device</th>
                               <th className="px-3 py-2">Count</th>
                               <th className="px-3 py-2">Amount</th>
                            </tr>
                         </thead>
                         <tbody>
                            {todayUserList && todayUserList.length ? todayUserList.map((r, i) => (
                               <tr key={i} className="border-t border-white/5">
                                  <td className="px-3 py-2">{r.name}</td>
                                  <td className="px-3 py-2 text-slate-400">{r.email || r.name}</td>
                                  <td className="px-3 py-2 font-semibold">{r.count}</td>
                                  <td className="px-3 py-2">৳{Number(r.amount || 0).toLocaleString()}</td>
                               </tr>
                            )) : (
                               <tr><td className="px-3 py-2" colSpan={4}>No payments today</td></tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
         </motion.div>
      </div>
    </div>
  )
}

function AnimatedSummaryCard({ title, value, icon: Icon, color, delay, custom, prefix = '', suffix = '', subtitle = '' }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: (i) => ({
          opacity: 1,
          y: 0,
          transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
        })
      }}
      initial="hidden"
      animate="visible"
      custom={custom}
      className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/5 p-6 backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/10 hover:border-white/10 shadow-lg hover:shadow-xl"
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${color} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity`} />
      
      <div className="relative z-10">
        <div className={`mb-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${color} p-3 shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        
        <div>
           <p className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">{title}</p>
           <h3 className="text-2xl font-bold text-white mt-1 tracking-tight">
              <span className="text-lg opacity-60 font-normal mr-1">{prefix}</span>
              {typeof value === 'number' ? value.toLocaleString() : value}
              <span className="text-lg opacity-60 font-normal ml-1">{suffix}</span>
           </h3>
           {subtitle && (
              <p className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</p>
           )}
        </div>
      </div>
    </motion.div>
  )
}