import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { Link } from 'react-router-dom'

import { listUsers, listDevicesOnlineStatus, getDevicePaymentMethods, getUserPaymentMethods, updatePaymentMethodStatus, addCredit, updateUser, addMinimumCredit } from '../lib/api'
import { User as UserIcon, Smartphone, CreditCard, PhoneCall, ChevronDown, ChevronUp, Wallet } from 'lucide-react'

export default function WalletAgents() {
  const token = useAuthStore((s) => s.token)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agents, setAgents] = useState([])
  const [devices, setDevices] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [deviceMethods, setDeviceMethods] = useState({}) // deviceId -> methods[]
  const [loadingMethods, setLoadingMethods] = useState({}) // deviceId -> bool
  const [agentNumbers, setAgentNumbers] = useState({}) // userId -> methods[]
  const [updatingStatus, setUpdatingStatus] = useState({}) // methodId -> bool
  const [creditInputs, setCreditInputs] = useState({}) // userId -> string
  const [creditSaving, setCreditSaving] = useState({}) // userId -> bool
  const [minCreditInputs, setMinCreditInputs] = useState({}) // userId -> string
  const [minCreditSaving, setMinCreditSaving] = useState({}) // userId -> bool

  useEffect(() => {
    if (!token) return
    let ignore = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [uRes, dRes] = await Promise.all([
          listUsers(token, { page: 1, limit: 200 }),
          listDevicesOnlineStatus(token),
        ])
        if (ignore) return
        const allUsers = uRes?.data || []
        const walletAgents = allUsers.filter((u) => u.role === 'wallet_agent')
        setAgents(walletAgents)
        const allDevices = dRes?.data || []
        const walletAgentDevices = allDevices.filter((d) => d.owner && d.owner.role === 'wallet_agent')
        setDevices(walletAgentDevices)
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load wallet agents')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [token])

  const handleToggleAgent = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleLoadMethods = async (device) => {
    if (!device?.deviceCode) return
    const deviceId = device._id
    setLoadingMethods((m) => ({ ...m, [deviceId]: true }))
    try {
      const res = await getDevicePaymentMethods(device.deviceCode)
      const methods = res?.data || []
      setDeviceMethods((prev) => ({ ...prev, [deviceId]: methods }))
    } catch (e) {
      // basic inline error by storing empty list
      setDeviceMethods((prev) => ({ ...prev, [deviceId]: [] }))
    } finally {
      setLoadingMethods((m) => ({ ...m, [deviceId]: false }))
    }
  }

  const handleLoadAgentNumbers = async (agent) => {
    if (!token || !agent?._id) return
    try {
      const res = await getUserPaymentMethods(token, { owner: agent._id })
      const methods = res?.data || []
      setAgentNumbers((prev) => ({ ...prev, [agent._id]: methods }))
    } catch (e) {
      setAgentNumbers((prev) => ({ ...prev, [agent._id]: [] }))
    }
  }

  const handleToggleStatus = async (agentId, method) => {
    if (!token || !method?._id) return
    const nextStatus = method.status === 'active' ? 'inactive' : 'active'
    setUpdatingStatus((m) => ({ ...m, [method._id]: true }))
    try {
      const res = await updatePaymentMethodStatus(token, method._id, nextStatus)
      const updated = res?.data || method
      setAgentNumbers((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] || []).map((m) => (m._id === updated._id ? updated : m)),
      }))
    } catch (e) {
      // ignore, status remains
    } finally {
      setUpdatingStatus((m) => ({ ...m, [method._id]: false }))
    }
  }

  const handleAddCredit = async (agent) => {
    if (!token || !agent?._id) return
    const raw = creditInputs[agent._id]
    const amount = Number(raw)
    if (!amount || !Number.isFinite(amount)) return

    setCreditSaving((prev) => ({ ...prev, [agent._id]: true }))
    try {
      const res = await addCredit(token, agent._id, amount, 'inc')
      const updated = res?.data || agent
      setAgents((prev) => prev.map((a) => (a._id === updated._id ? { ...a, credit: updated.credit } : a)))
      setCreditInputs((prev) => ({ ...prev, [agent._id]: '' }))
    } catch (e) {
      setError(e.message || 'Failed to add credit')
    } finally {
      setCreditSaving((prev) => ({ ...prev, [agent._id]: false }))
    }
  }

  const handleUpdateMinCredit = async (agent) => {
    if (!token || !agent?._id) return
    const raw = minCreditInputs[agent._id]
    const val = Number(raw)
    if (isNaN(val)) return

    setMinCreditSaving((prev) => ({ ...prev, [agent._id]: true }))
    try {
      // Use "inc" mode by default as per requirement (additive)
      const res = await addMinimumCredit(token, agent._id, val, 'inc')
      const updated = res?.data || agent
      setAgents((prev) => prev.map((a) => (a._id === updated._id ? { ...a, minimumCredit: updated.minimumCredit } : a)))
      setMinCreditInputs((prev) => ({ ...prev, [agent._id]: '' }))
    } catch (e) {
      setError(e.message || 'Failed to update minimum credit')
    } finally {
      setMinCreditSaving((prev) => ({ ...prev, [agent._id]: false }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        {/* Background shine */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Wallet Agents Cluster
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Watch all wallet agents, devices, SIM numbers, and credit activity in real-time.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 text-xs relative z-10">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 backdrop-blur-md">
            <UserIcon className="w-4 h-4 text-violet-400" />
            <span className="text-slate-300 font-medium">Agents:</span>
            <span className="text-white font-bold text-sm bg-violet-500/20 px-2 py-0.5 rounded-md">{agents.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hidden sm:flex items-center gap-2 backdrop-blur-md">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">Devices:</span>
            <span className="text-white font-bold text-sm bg-emerald-500/20 px-2 py-0.5 rounded-md">{devices.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hidden md:flex items-center gap-2 backdrop-blur-md">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </div>
            <span className="text-slate-300 font-medium">Online:</span>
            <span className="text-white font-bold text-sm bg-sky-500/20 px-2 py-0.5 rounded-md">
              {devices.filter((d) => d.online).length}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-3 text-sm text-rose-200 flex items-center gap-3 backdrop-blur-md">
           <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]" />
           {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-white/5 bg-white/5 px-8 py-12 text-sm text-slate-400 flex flex-col items-center justify-center gap-4 animate-pulse">
           <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
           <p>Scanning wallet network...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-white/5 px-8 py-16 text-center text-slate-500 backdrop-blur-sm">
          No wallet agents detected in the system.
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => {
            const agentDevices = devices.filter((d) => d.owner && d.owner._id === agent._id)
            const numbers = agentNumbers[agent._id] || []
            return (
              <div
                key={agent._id}
                className="group rounded-3xl border border-white/5 bg-white/5 hover:bg-white/[0.07] hover:border-violet-500/20 backdrop-blur-xl transition-all duration-300 shadow-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggleAgent(agent._id)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-[1px] shadow-lg shadow-violet-500/20">
                       <div className="h-full w-full rounded-2xl bg-[#0a0a1a] flex items-center justify-center">
                          <span className="text-lg font-bold text-white">{(agent.name || agent.email || 'A').charAt(0).toUpperCase()}</span>
                       </div>
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                         <div className="font-bold text-base text-white truncate max-w-[200px]">{agent.name || agent.email}</div>
                         <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
                            {agent._id.slice(-6).toUpperCase()}
                         </div>
                      </div>
                      
                      <div className="text-xs text-slate-400 truncate mt-0.5">{agent.email}</div>
                      
                      <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                          <Smartphone className="w-3 h-3" />
                          <span>{agent.devicesCount ?? agentDevices.length} Devices</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300">
                          <Wallet className="w-3 h-3" />
                          <span>Bal: ৳{(agent.balance ?? 0).toFixed(2)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300">
                          <CreditCard className="w-3 h-3" />
                          <span>Credit: ৳{(agent.credit ?? 0).toFixed(2)}</span>
                        </span>
                        
                        <Link 
                          to={`/wallet-agents/${agent._id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <UserIcon className="w-3 h-3" />
                          <span>View Profile</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <span className={`text-xs text-slate-500 transition-transform duration-300 ${expandedId === agent._id ? 'opacity-100' : 'opacity-0 -translate-x-2'}`}>
                        {expandedId === agent._id ? 'Close' : ''}
                     </span>
                     <div className={`p-2 rounded-full bg-white/5 border border-white/5 text-slate-400 transition-all duration-300 ${expandedId === agent._id ? 'rotate-180 bg-white/10 text-white' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                     </div>
                  </div>
                </button>

                {expandedId === agent._id && (
                  <div className="border-t border-white/5 px-6 py-6 text-xs grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 bg-[#050510]/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-bold text-white text-sm">Connected Devices</h4>
                      </div>
                      
                      {agentDevices.length === 0 ? (
                        <div className="text-xs text-slate-500 italic px-1">No devices linked to this agent.</div>
                      ) : (
                        <div className="grid gap-3">
                          {agentDevices.map((d) => {
                            const methods = deviceMethods[d._id] || []
                            const loadingSim = loadingMethods[d._id]
                            return (
                              <div
                                key={d._id}
                                className="border border-white/5 rounded-2xl p-4 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                       <div className="font-semibold text-white text-sm">
                                          {d.deviceUserName || d.deviceName || 'Unnamed device'}
                                       </div>
                                       <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-400 font-mono">
                                          {d.deviceCode || 'N/A'}
                                       </span>
                                    </div>
                                    
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                        d.online
                                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                          : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${d.online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                      {d.online ? 'Online' : 'Offline'}
                                    </span>
                                    
                                    {d.subscriptionEndDate && (
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        Exp: {new Date(d.subscriptionEndDate).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <button
                                    type="button"
                                    onClick={() => handleLoadMethods(d)}
                                    className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-violet-600/20 hover:text-violet-300 text-slate-300 border border-white/5 transition-all shadow-sm whitespace-nowrap"
                                    disabled={loadingSim}
                                  >
                                    {loadingSim ? 'Scanning...' : 'Load Activity'}
                                  </button>
                                </div>

                                {methods.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-white/5">
                                    <div className="font-medium mb-2 text-slate-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                                      <PhoneCall className="w-3 h-3 text-sky-400" />
                                      SIM / Gateways
                                    </div>
                                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                                      {methods.map((m) => (
                                        <div
                                          key={m._id}
                                          className="flex items-center justify-between border border-white/5 rounded-lg px-3 py-2 bg-black/20"
                                        >
                                          <div>
                                            <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                                               <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                              {m.provider?.toUpperCase()} - {m.gateway}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 pl-3">
                                              {m.accountNumber} • SIM {m.simIndex}
                                            </div>
                                          </div>
                                          <div className={`text-[9px] font-bold uppercase ${m.status === 'active' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                             {m.status}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-white/5 lg:pl-6 pt-4 lg:pt-0">
                      
                      {/* Wallet Credit Control */}
                      <div className="p-4 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-violet-400" /> Wallet Credit
                          </span>
                          <span className="text-[10px] bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20 font-mono">
                            ৳{(agent.credit ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            className="flex-1 px-3 py-2 text-xs rounded-xl border border-white/10 bg-black/20 focus:outline-none focus:border-violet-500/50 text-white placeholder:text-slate-600 transition-colors"
                            placeholder="Amount"
                            value={creditInputs[agent._id] ?? ''}
                            onChange={(e) =>
                              setCreditInputs((prev) => ({ ...prev, [agent._id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCredit(agent)}
                            disabled={creditSaving[agent._id] || !creditInputs[agent._id]}
                            className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 shadow-lg shadow-violet-900/20 font-medium transition-all"
                          >
                            {creditSaving[agent._id] ? '...' : 'Add'}
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">
                          Adjust balance for agent operations.
                        </p>
                      </div>

                      {/* Min Credit Control */}
                      <div className="p-4 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Min Credit
                          </span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                            ৳{(agent.minimumCredit ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            className="flex-1 px-3 py-2 text-xs rounded-xl border border-white/10 bg-black/20 focus:outline-none focus:border-amber-500/50 text-white placeholder:text-slate-600 transition-colors"
                            placeholder="Amount"
                            value={minCreditInputs[agent._id] ?? ''}
                            onChange={(e) =>
                              setMinCreditInputs((prev) => ({ ...prev, [agent._id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateMinCredit(agent)}
                            disabled={minCreditSaving[agent._id]}
                            className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 shadow-lg shadow-amber-900/20 font-medium transition-all"
                          >
                            {minCreditSaving[agent._id] ? '...' : 'Set'}
                          </button>
                        </div>
                      </div>

                      {/* Numbers Status */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-400" /> Active Numbers
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleLoadAgentNumbers(agent)}
                            className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          >
                            Refresh
                          </button>
                        </div>
                        
                        {numbers.length === 0 ? (
                          <div className="text-[10px] text-slate-500 border border-dashed border-white/10 rounded-xl p-3 text-center">No active numbers found.</div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {numbers.map((m) => (
                              <div
                                key={m._id}
                                className="flex items-center justify-between border border-white/5 rounded-xl px-3 py-2 bg-black/20 hover:border-white/10 transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="font-mono text-[11px] text-white truncate">
                                    {m.accountNumber}
                                  </div>
                                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                                    {m.provider} <span className="text-slate-700">•</span> {m.gateway}
                                  </div>
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(agent._id, m)}
                                  disabled={updatingStatus[m._id]}
                                  className={`text-[9px] px-2 py-1 rounded border transition-all ${
                                    m.status === 'active'
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                                  }`}
                                >
                                  {m.status === 'active' ? 'Active' : 'Inactive'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
