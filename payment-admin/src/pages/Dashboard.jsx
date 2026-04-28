import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { getStats, listDevicesOnlineStatus, listPayments } from '../lib/api'
import {
  Users,
  MonitorSmartphone,
  CheckCircle2,
  Clock,
  Wallet,
  ArrowUpRight,
  Sparkles,
  Activity
} from 'lucide-react'

export default function Dashboard() {
  const token = useAuthStore((s) => s.token)
  const [stats, setStats] = React.useState(null)
  const [deviceStatus, setDeviceStatus] = React.useState({ online: 0, total: 0 })
  const [recentPayments, setRecentPayments] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [statsRes, devicesRes, paymentsRes] = await Promise.all([
          getStats(token),
          listDevicesOnlineStatus(token),
          listPayments(token, { page: 1, limit: 50, status: 'verified' }),
        ])

        if (cancelled) return

        setStats(statsRes?.data || null)
        const devs = devicesRes?.data || []
        const online = devs.filter((d) => d.online).length
        setDeviceStatus({ online, total: devs.length })
        
        // Filter payments to last 24h and verified
        const now = Date.now()
        const oneDay = 24 * 60 * 60 * 1000
        const verified24h = (paymentsRes?.data || [])
          .filter(p => p.verify === true || p.status === 'verified')
          .filter(p => new Date(p.createdAt).getTime() > now - oneDay)
        
        setRecentPayments(verified24h.slice(0, 8))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token])

  const totalVolume = React.useMemo(
    () => recentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [recentPayments]
  )

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
          custom={1}
          title="Total Devices"
          value={stats?.devicesCount ?? '--'}
          icon={MonitorSmartphone}
          color="from-fuchsia-500 to-pink-600"
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
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
         {/* Live Device Status */}
         <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={4}
            className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/5 p-6 backdrop-blur-xl transition-all hover:bg-white/10"
         >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-8">
                  <div>
                     <h3 className="text-lg font-semibold text-white">Network Status</h3>
                     <p className="text-xs text-slate-400">Live devices connectivity</p>
                  </div>
                  <div className="relative">
                     <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-20 animate-pulse" />
                     <MonitorSmartphone className="h-6 w-6 text-emerald-400 relative z-10" />
                  </div>
               </div>

               <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-4xl font-bold text-white tracking-tight">
                     {deviceStatus.online}
                  </span>
                  <span className="text-sm text-slate-400 font-medium">
                     / {deviceStatus.total} Devices Online
                  </span>
               </div>

               {/* Progress Bar */}
               <div className="h-3 w-full bg-slate-800/50 rounded-full overflow-hidden mb-6 ring-1 ring-white/5">
                  <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: deviceStatus.total > 0 ? `${(deviceStatus.online / deviceStatus.total) * 100}%` : '0%' }}
                     transition={{ duration: 1.5, ease: "circOut" }}
                     className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                     <p className="text-xs text-emerald-300/80 mb-1">Online</p>
                     <p className="text-xl font-bold text-emerald-400">{deviceStatus.online}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-800/50 border border-white/5 text-center">
                     <p className="text-xs text-slate-400 mb-1">Offline</p>
                     <p className="text-xl font-bold text-slate-300">
                        {Math.max(0, deviceStatus.total - deviceStatus.online)}
                     </p>
                  </div>
               </div>
            </div>
         </motion.div>

         {/* Recent Payments Feed */}
         <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={5}
            className="xl:col-span-2 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-xl overflow-hidden flex flex-col"
         >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
               <div>
                  <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
                  <p className="text-xs text-slate-400">Showing verified transactions from the last 24 hours</p>
               </div>
               <div className="px-4 py-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-300 text-sm font-medium flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  ৳{totalVolume.toFixed(2)} Vol
               </div>
            </div>

            <div className="flex-1 overflow-auto max-h-[400px] custom-scrollbar p-0">
               <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#0a0a1a] z-10 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                     <tr>
                        <th className="px-6 py-4">Status & TrxID</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-right">Time</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {loading ? (
                        [...Array(5)].map((_, i) => (
                           <tr key={i} className="animate-pulse">
                              <td colSpan={4} className="px-6 py-4">
                                 <div className="h-6 bg-white/5 rounded w-full" />
                              </td>
                           </tr>
                        ))
                     ) : recentPayments.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                              No recent transactions found
                           </td>
                        </tr>
                     ) : (
                        recentPayments.map((p) => (
                           <tr key={p._id} className="group hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                                       <ArrowUpRight className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                       <p className="font-mono text-white text-xs truncate max-w-[120px] bg-slate-800/50 px-1.5 py-0.5 rounded border border-white/5">
                                          {p.trxID}
                                       </p>
                                       <p className="text-[10px] text-slate-400 mt-1 truncate">
                                          {p.title || 'Unknown Method'}
                                       </p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex flex-col">
                                    <span className="text-slate-200 font-medium truncate max-w-[140px]">
                                       {p.owner?.name || 'Guest'}
                                    </span>
                                    <span className="text-xs text-slate-500 truncate max-w-[140px]">
                                       {p.owner?.email}
                                    </span>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <span className="font-bold text-emerald-400 text-base">
                                    ৳{Number(p.amount).toLocaleString()}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">
                                 {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </motion.div>
      </div>
    </div>
  )
}

function AnimatedSummaryCard({ title, value, icon: Icon, color, delay, custom, prefix = '' }) {
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
           </h3>
        </div>
      </div>
    </motion.div>
  )
}