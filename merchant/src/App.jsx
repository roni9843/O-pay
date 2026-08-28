import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Login from './pages/Login'
import Register from './pages/Register'
import KYC from './pages/KYC'
import PaymentTest from './pages/PaymentTest'
import ApiDocs from './pages/ApiDocs'
import DepositAutoDocs from './pages/DepositAutoDocs'
import AutoWithdrawalDocs from './pages/AutoWithdrawalDocs'
import History from './pages/History'
import Withdrawal from './pages/Withdrawal'
import DashboardLayout from './components/DashboardLayout'
import PendingNagad from './pages/PendingNagad'
import { useAuthStore } from './store/authStore'
import Settings from './pages/Settings'
import CustomPaymentLink from './pages/CustomPaymentLink'
import AutoWithdrawalHistory from './pages/AutoWithdrawalHistory'
import AddBalance from './pages/AddBalance'
import TopupHistory from './pages/TopupHistory'
import PublicSuccessPage from './pages/PublicSuccessPage'
import MerchantActivation from './pages/MerchantActivation'
import Package from './pages/Package'
import { useEffect, useState } from 'react'
import { getDashboardOverview } from './lib/api'

function Dashboard() {
  const { user, fetchMe } = useAuthStore()

  if (!user) return <Navigate to="/login" />

  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Refresh user profile on mount to ensure latest KYC status is known
    fetchMe();
  }, [fetchMe])

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const res = await getDashboardOverview({ days: 30 })
        if (res.success) {
          setOverview(res.data)
        } else {
          setError(res.message || 'Failed to load stats')
        }
      } catch (e) {
        setError(e.message || 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user._id]) // use user._id to avoid infinite re-runs if user object ref changes

  const daily = overview?.daily || []
  const maxAmount = daily.reduce((m, d) => Math.max(m, d.successAmount || 0, d.withdrawAmount || 0), 0)
  const maxCount = daily.reduce((m, d) => Math.max(m, d.successCount || 0, d.withdrawCount || 0), 0)

  const hasData = daily.some(d => (d.successAmount || 0) > 0 || (d.successCount || 0) > 0 || (d.withdrawAmount || 0) > 0 || (d.withdrawCount || 0) > 0);
  const [hoveredIndex, setHoveredIndex] = useState(null)

  // SVG Area Chart points calculation
  const getPoints = (data, valueKey, max, height, width) => {
    if (data.length < 2) return ""
    const step = width / (data.length - 1)
    return data.map((d, i) => {
      const x = i * step
      const y = max > 0 ? height - (d[valueKey] / max) * height : height - 2
      return `${x},${y}`
    }).join(" ")
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-500 font-medium">Monitoring your payment performance</p>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
          user.kycStatus === 'approved' ? 'bg-emerald-500 border-emerald-600 text-white' :
          user.kycStatus === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {user.kycStatus}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 font-bold flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Available Balance', value: overview ? `${(overview.totals.availableBalance || 0).toLocaleString('en-BD')} BDT` : '...', color: 'text-violet-600', sub: overview ? `Auto-Withdraw Min: ৳${overview.withdrawalConfig?.minAutoWithdrawBalance || 0}` : 'Funds ready to withdraw' },
          { label: 'Total Revenue', value: overview ? `${(overview.totals.absoluteTotalSuccessAmount || 0).toLocaleString('en-BD')} BDT` : '...', color: 'text-emerald-600', sub: 'Lifetime success volume' },
          { label: 'Today (30d)', value: overview ? (overview.totals.totalSuccess || 0) : '...', color: 'text-slate-900', sub: 'Completed (Last 30d)' },
          { label: "Today's Volume", value: overview ? `${(overview.today.successAmountToday || 0).toLocaleString('en-BD')} BDT` : '...', color: 'text-slate-900', sub: `${overview ? overview.today.successToday : 0} successful links` }
        ].map((card, idx) => (
          <div key={idx} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group relative">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors uppercase">{card.label}</p>
            <div className="flex items-center justify-between relative z-10">
              <p className={`mt-2 text-2xl font-black ${card.color}`}>{card.value}</p>
              {idx === 0 && (
                <button 
                  onClick={() => window.location.href = '/add-balance'}
                  className="w-10 h-10 rounded-full bg-violet-100 hover:bg-violet-200 text-violet-600 flex items-center justify-center transition-all shadow-sm cursor-pointer hover:scale-110 active:scale-95"
                  title="Add Balance"
                  style={{ pointerEvents: 'auto' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-slate-400 font-bold">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[2rem] overflow-hidden border border-emerald-100 shadow-[0_18px_60px_rgba(16,185,129,0.12)] bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        <div className="p-6 md:p-8 border-b border-emerald-100/80 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Custom Payment Link</p>
            <h3 className="mt-2 text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Link performance at a glance</h3>
            <p className="mt-2 text-sm text-slate-500 font-medium max-w-2xl">Active links are still valid and unpaid. Success reflects completed custom links, and the total amount is the lifetime paid value for this feature.</p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-emerald-100 text-emerald-700 font-black text-[10px] uppercase tracking-widest shadow-sm w-fit">
            Live Merchant Stats
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 md:p-8">
          {[
            {
              label: 'Active Links',
              value: overview ? (overview.customStats?.activeCount || 0) : '...',
              sub: 'Currently usable custom links',
              accent: 'from-sky-500 to-cyan-500',
              ring: 'ring-sky-500/10',
            },
            {
              label: 'Success Links',
              value: overview ? (overview.customStats?.successCount || 0) : '...',
              sub: 'Completed custom payments',
              accent: 'from-emerald-500 to-teal-500',
              ring: 'ring-emerald-500/10',
            },
            {
              label: 'Total Success Amount',
              value: overview ? `${(overview.customStats?.successAmount || 0).toLocaleString('en-BD')} BDT` : '...',
              sub: 'Custom payment revenue',
              accent: 'from-violet-500 to-fuchsia-500',
              ring: 'ring-violet-500/10',
            },
          ].map((card) => (
            <div key={card.label} className={`relative rounded-[1.75rem] bg-white border border-white/70 shadow-sm p-5 ring-1 ${card.ring} overflow-hidden`}>
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{card.value}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500 leading-relaxed">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] overflow-hidden border border-fuchsia-100 shadow-[0_18px_60px_rgba(217,70,239,0.12)] bg-gradient-to-br from-fuchsia-50 via-white to-pink-50">
        <div className="p-6 md:p-8 border-b border-fuchsia-100/80 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-600">API Auto Withdrawals</p>
            <h3 className="mt-2 text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Withdrawal performance & Ratio</h3>
            <p className="mt-2 text-sm text-slate-500 font-medium max-w-2xl">Overview of all automated payout requests triggered via your API.</p>
          </div>
          <button onClick={() => window.location.href = '/auto-withdrawal-history'} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-fuchsia-100 text-fuchsia-700 font-black text-[10px] uppercase tracking-widest shadow-sm w-fit hover:bg-fuchsia-50 transition-colors">
            View History <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 md:p-8">
          {[
            {
              label: 'Total Requests',
              value: overview ? (overview.autoWithdrawalStats?.totalCount || 0) : '...',
              sub: 'All initiated withdrawals',
              accent: 'from-amber-500 to-orange-500',
              ring: 'ring-amber-500/10',
            },
            {
              label: 'Completed Payouts',
              value: overview ? (overview.autoWithdrawalStats?.completedCount || 0) : '...',
              sub: `Success Ratio: ${overview?.autoWithdrawalStats?.totalCount ? Math.round(((overview.autoWithdrawalStats?.completedCount || 0) / overview.autoWithdrawalStats.totalCount) * 100) : 0}%`,
              accent: 'from-fuchsia-500 to-pink-500',
              ring: 'ring-fuchsia-500/10',
            },
            {
              label: 'Completed Amount',
              value: overview ? `${(overview.autoWithdrawalStats?.completedAmount || 0).toLocaleString('en-BD')} BDT` : '...',
              sub: 'Total value of completed payouts',
              accent: 'from-indigo-500 to-violet-500',
              ring: 'ring-indigo-500/10',
            },
            {
              label: 'Success Rate Ratio',
              value: overview ? `${overview.autoWithdrawalStats?.totalCount ? Math.round(((overview.autoWithdrawalStats?.completedCount || 0) / overview.autoWithdrawalStats.totalCount) * 100) : 100}%` : '...',
              sub: 'Payout conversion efficiency',
              accent: 'from-emerald-500 to-teal-500',
              ring: 'ring-emerald-500/10',
            },
          ].map((card) => (
            <div key={card.label} className={`relative rounded-[1.75rem] bg-white border border-white/70 shadow-sm p-5 ring-1 ${card.ring} overflow-hidden`}>
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{card.value}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500 leading-relaxed">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="p-8 rounded-[2rem] bg-slate-900 text-white shadow-2xl lg:col-span-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            API Credentials
          </h3>
          {user.kycStatus === 'approved' ? (
            <div className="space-y-6 relative z-10">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Domain Authorized</label>
                <div className="mt-2 font-mono text-sm break-all text-emerald-400 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">{user.domain}</div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Private Secret Key</label>
                <div className="mt-2 font-mono text-xs bg-black/40 p-4 rounded-xl break-all text-amber-300 border border-white/5 shadow-inner leading-relaxed">
                  {user.apiToken}
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-white/5">
                <p className="text-[10px] text-slate-500 font-bold italic leading-relaxed">
                  Do not share your private key. Use this for server-side API calls only.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm font-medium leading-relaxed italic">
              Credential data is locked until KYC verification is complete.
            </div>
          )}
        </div>

        <div className="p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Payment & Withdrawal Trends</h3>
              <p className="text-xs font-bold text-slate-400">Success revenue vs withdrawal payout volume over time</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-fuchsia-500 shadow-sm shadow-fuchsia-500/50"></div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Withdrawal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Count</span>
              </div>
            </div>
          </div>

          <div className="relative h-64 group p-1">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30 transition-opacity"><div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div></div>}
            
            {!loading && !hasData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 z-10 space-y-2">
                <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Transaction History</p>
              </div>
            )}

            <div className="absolute inset-0 flex items-end justify-between px-2 pointer-events-none opacity-20">
               {[0,1,2,3,4].map(i => <div key={i} className="absolute w-full border-t border-slate-100" style={{bottom: `${i*25}%`}} />)}
            </div>

            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 200">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="areaGradientWithdraw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#d946ef" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="areaGradientCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Count Area */}
              {daily.length > 0 && (
                <>
                <path
                  d={`M 0,200 L ${getPoints(daily, 'successCount', maxCount, 200, 1000)} L 1000,200 Z`}
                  fill="url(#areaGradientCount)"
                />
                <polyline
                  points={getPoints(daily, 'successCount', maxCount, 200, 1000)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="opacity-40"
                />
                </>
              )}

              {/* Withdrawal Amount Area */}
              {daily.length > 0 && (
                <>
                <path
                  d={`M 0,200 L ${getPoints(daily, 'withdrawAmount', maxAmount, 200, 1000)} L 1000,200 Z`}
                  fill="url(#areaGradientWithdraw)"
                />
                <polyline
                  points={getPoints(daily, 'withdrawAmount', maxAmount, 200, 1000)}
                  fill="none"
                  stroke="#d946ef"
                  strokeWidth="3"
                  strokeDasharray="5 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                </>
              )}

              {/* Success Revenue Amount Area */}
              {daily.length > 0 && (
                <>
                <path
                  d={`M 0,200 L ${getPoints(daily, 'successAmount', maxAmount, 200, 1000)} L 1000,200 Z`}
                  fill="url(#areaGradient)"
                />
                <polyline
                  points={getPoints(daily, 'successAmount', maxAmount, 200, 1000)}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="drop-shadow-lg"
                />
                </>
              )}

              {/* Hover Interaction Area */}
              {daily.map((d, i) => (
                <rect
                  key={i}
                  x={i * (1000 / (daily.length - 1)) - (1000 / (daily.length - 1)) / 2}
                  y="0"
                  width={1000 / (daily.length - 1)}
                  height="200"
                  fill="transparent"
                  className="cursor-crosshair pointer-events-auto"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}

              {/* Active Indicator */}
              {hoveredIndex !== null && daily[hoveredIndex] && (
                <g>
                  <line
                    x1={hoveredIndex * (1000 / (daily.length - 1))}
                    y1="0"
                    x2={hoveredIndex * (1000 / (daily.length - 1))}
                    y2="200"
                    stroke="#6366f1"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={hoveredIndex * (1000 / (daily.length - 1))}
                    cy={maxAmount > 0 ? 200 - (daily[hoveredIndex].successAmount / maxAmount) * 200 : 198}
                    r="6"
                    fill="#10b981"
                    stroke="white"
                    strokeWidth="3"
                    className="drop-shadow-md"
                  />
                </g>
              )}
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && daily[hoveredIndex] && (
              <div 
                className="absolute z-40 bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl text-white pointer-events-none transition-all duration-75 min-w-[200px]"
                style={{
                  left: `${(hoveredIndex / (daily.length - 1)) * 100}%`,
                  top: '-10px',
                  transform: `translateX(${hoveredIndex > daily.length / 2 ? '-110%' : '10%'})`
                }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 border-b border-white/5 pb-1">{daily[hoveredIndex].date}</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-[10px] font-black uppercase text-slate-400">Net Sales</span>
                    <span className="text-xs font-black text-emerald-400">৳{daily[hoveredIndex].successAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-[10px] font-black uppercase text-slate-400">Withdrawal</span>
                    <span className="text-xs font-black text-fuchsia-400">৳{(daily[hoveredIndex].withdrawAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6 pt-1 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase text-slate-400">Paid Links</span>
                    <span className="text-xs font-black text-sky-400">{daily[hoveredIndex].successCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 flex justify-between px-2 pt-4 border-t border-slate-50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{daily[0]?.date ? new Date(daily[0].date).toLocaleDateString() : ''}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">30-Day performance window</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{daily[daily.length-1]?.date ? new Date(daily[daily.length-1].date).toLocaleDateString() : 'Today'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, authReady }) {
  const { user } = useAuthStore()
  if (!authReady) {
    // সার্ভার থেকে fresh user data আসার আগে কিছু দেখাবে না
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" />
  if (user.isLifetimePaid === false) {
    return <Navigate to="/lifetime-payment" />
  }
  return <DashboardLayout>{children}</DashboardLayout>
}

function ActivationRoute({ children, authReady }) {
  const { user } = useAuthStore()
  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" />
  if (user.isLifetimePaid === true) {
    return <Navigate to="/dashboard" />
  }
  return children
}

function App() {
  const { fetchMe, token } = useAuthStore()
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    // App load হলে সবসময় server থেকে fresh user data নিয়ে আসো
    // এতে admin manually paid করলে reload এ সঠিক status দেখাবে
    if (token) {
      fetchMe().finally(() => setAuthReady(true))
    } else {
      setAuthReady(true) // no token = no fetch needed, routes will redirect to login
    }
  }, [token])

  return (
    <Router>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <ProtectedRoute authReady={authReady}>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/package" element={
          <ProtectedRoute authReady={authReady}>
            <Package />
          </ProtectedRoute>
        } />
        <Route path="/lifetime-payment" element={
          <ActivationRoute authReady={authReady}>
            <MerchantActivation />
          </ActivationRoute>
        } />
        <Route path="/kyc" element={
          <ProtectedRoute authReady={authReady}>
            <KYC />
          </ProtectedRoute>
        } />
        <Route path="/payment-test" element={
          <ProtectedRoute authReady={authReady}>
            <PaymentTest />
          </ProtectedRoute>
        } />

        <Route path="/custom-payment-link" element={
          <ProtectedRoute authReady={authReady}>
            <CustomPaymentLink />
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute authReady={authReady}>
            <History />
          </ProtectedRoute>
        } />
        
        <Route path="/pending-nagad" element={
          <ProtectedRoute authReady={authReady}>
            <PendingNagad />
          </ProtectedRoute>
        } />
        
        <Route path="/withdrawal" element={
          <ProtectedRoute authReady={authReady}>
            <Withdrawal />
          </ProtectedRoute>
        } />
        
        <Route path="/auto-withdrawal-history" element={
          <ProtectedRoute authReady={authReady}>
            <AutoWithdrawalHistory />
          </ProtectedRoute>
        } />
        <Route path="/add-balance" element={
          <ProtectedRoute authReady={authReady}>
            <AddBalance />
          </ProtectedRoute>
        } />
        
        <Route path="/topup-history" element={
          <ProtectedRoute authReady={authReady}>
            <TopupHistory />
          </ProtectedRoute>
        } />


        <Route path="/settings" element={
          <ProtectedRoute authReady={authReady}>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/api-docs" element={
          <ProtectedRoute authReady={authReady}>
            <DepositAutoDocs />
          </ProtectedRoute>
        } />
        <Route path="/deposit-auto-docs" element={
          <ProtectedRoute authReady={authReady}>
            <DepositAutoDocs />
          </ProtectedRoute>
        } />
        <Route path="/auto-withdrawal-docs" element={
          <ProtectedRoute authReady={authReady}>
            <AutoWithdrawalDocs />
          </ProtectedRoute>
        } />
        <Route path="/success-page/:code" element={<PublicSuccessPage />} />
        <Route path="/sucess-page/:code" element={<PublicSuccessPage />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  )
}

export default App
