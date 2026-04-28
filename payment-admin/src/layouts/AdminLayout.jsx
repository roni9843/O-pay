import React from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import logo from '../asstes/appstore.png'
import {
  LayoutDashboard,
  Users,
  Wallet,
  Smartphone,
  CreditCard,
  Clock,
  Coins,
  Settings as SettingsIcon,
  LogOut,
  Activity,
  Briefcase,
  MessageSquareText,
  Link as LinkIcon,
  Landmark,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'from-violet-500 to-indigo-500' },
  { to: '/users', label: 'Users', icon: Users, accent: 'from-emerald-500 to-teal-500' },
  { to: '/wallet-agents', label: 'Wallet Agents', icon: Wallet, accent: 'from-pink-500 to-rose-500' },
  { to: '/agent-applications', label: 'Applications', icon: Users, accent: 'from-blue-500 to-indigo-500' },
  { to: '/opay-business', label: 'Opay Business', icon: Briefcase, accent: 'from-sky-500 to-cyan-500' },
  { to: '/merchant-withdraws', label: 'Merchant Withdraws', icon: Landmark, accent: 'from-orange-500 to-amber-500' },
  { to: '/payment-link-sessions', label: 'Payment Links', icon: LinkIcon, accent: 'from-sky-500 to-blue-500' },
  { to: '/device-online', label: 'Device Online', icon: Smartphone, accent: 'from-amber-500 to-orange-500' },
  { to: '/devices', label: 'Devices', icon: Smartphone, accent: 'from-fuchsia-500 to-purple-500' },
  { to: '/payment-messages', label: 'Payment Messages', icon: MessageSquareText, accent: 'from-blue-600 to-cyan-400' },
  { to: '/payments', label: 'Payments', icon: CreditCard, accent: 'from-emerald-500 to-lime-500' },
  { to: '/pending-balances', label: 'Pending Balances', icon: Clock, accent: 'from-cyan-500 to-blue-500' },
  { to: '/balance-adjustment', label: 'Balance Adjustment', icon: Coins, accent: 'from-teal-500 to-emerald-500' },
  { to: '/binance-address', label: 'Binance Address', icon: Coins, accent: 'from-yellow-400 to-orange-500' },
  { to: '/credit-plans', label: 'Credit Panel', icon: CreditCard, accent: 'from-violet-500 to-fuchsia-500' },
  { to: '/credit-topup-methods', label: 'Topup Methods', icon: SettingsIcon, accent: 'from-blue-500 to-indigo-500' },
  { to: '/credit-topup-requests', label: 'Topup Requests', icon: Wallet, accent: 'from-emerald-500 to-green-500' },
  { to: '/add-payment-method', label: 'Add Payment Method', icon: CreditCard, accent: 'from-violet-500 to-indigo-500' },

  { to: '/settings', label: 'Settings', icon: SettingsIcon, accent: 'from-slate-500 to-slate-400' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const activeItem = navItems.find((item) => location.pathname.startsWith(item.to))

  return (
    <div className="h-screen flex bg-[#030014] text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 h-full bg-slate-900/30 backdrop-blur-2xl border-r border-white/5 relative z-20 transition-all duration-300">

        {/* Logo Section */}
        <div className="flex-none flex items-center gap-4 px-6 py-6 border-b border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-0.5 shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform duration-300">
            <div className="h-full w-full rounded-2xl bg-slate-950 flex items-center justify-center overflow-hidden">
              <img src={logo} alt="Oracle Admin" className="h-9 w-9 object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-violet-200 transition-all">
              Oracle
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/80">Control Center</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${item.accent} opacity-20 border border-white/10`} />
                    )}
                    {isActive && (
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b ${item.accent} shadow-[0_0_12px_rgba(139,92,246,0.6)]`} />
                    )}

                    <div
                      className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 ${isActive
                          ? `bg-gradient-to-br ${item.accent} text-white shadow-lg`
                          : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <span className="relative z-10 flex-1 truncate transition-transform group-hover:translate-x-1">
                      {item.label}
                    </span>

                    {isActive && (
                      <Activity className="w-4 h-4 text-violet-300 animate-pulse" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="flex-none p-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 p-[2px]">
              <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center">
                <span className="font-bold text-white text-sm">{user?.name?.[0] || 'A'}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate max-w-[8rem] group-hover:text-violet-200 transition-colors">
                {user?.name || 'Administrator'}
              </p>
              <p className="text-xs text-slate-400 truncate">Super Admin</p>
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 hover:scale-105 transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">
        {/* Header */}
        <header className="flex-none sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 supports-[backdrop-filter]:bg-slate-900/20">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              {/* Mobile Toggle would go here */}
              <div className="h-8 w-8 rounded-lg bg-white/10" />
            </div>
            <div className="flex items-center gap-3">
              <div className={`hidden md:flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${activeItem?.accent || 'from-slate-700 to-slate-800'} text-white shadow-lg`}>
                {activeItem ? <activeItem.icon className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {activeItem?.label || 'Dashboard'}
                </h2>
                <p className="hidden md:block text-xs font-medium text-slate-400/80">
                  Overview & Analytics
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300">System Operational</span>
            </div>
            {/* Add Notifications / Search here later if needed */}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent relative custom-scrollbar">
          {/* Content Wrapper */}
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
