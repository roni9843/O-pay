import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  listOpayBusinesses,
  createOpayBusiness,
  updateOpayBusiness,
  regenerateOpayBusinessToken,
  api
} from '../lib/api'
import {
  Loader2, RefreshCw, Lock, Globe2, Mail, KeyRound, Check, Copy, Power, RotateCw,
  FileText, X, ExternalLink, ShieldCheck, AlertCircle, Building2, MapPin, Phone, CreditCard,
  Clock, TrendingUp
} from 'lucide-react'

import { useNavigate } from 'react-router-dom'

export default function OpayBusiness() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [regenLoading, setRegenLoading] = useState({})
  const [copiedId, setCopiedId] = useState(null)



  const [form, setForm] = useState({
    name: '',
    domain: '',
    email: '',
    password: '',
    enabled: true,
  })

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await listOpayBusinesses(token)
      setItems(res?.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load Opay businesses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!token) return
    setCreating(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        domain: form.domain,
        email: form.email,
        password: form.password,
        enabled: form.enabled,
      }
      const res = await createOpayBusiness(token, payload)
      const created = res?.data
      if (created) {
        setItems((prev) => [created, ...prev])
        setForm({ name: '', domain: '', email: '', password: '', enabled: true })
      }
    } catch (e) {
      setError(e.message || 'Failed to create brand')
    } finally {
      setCreating(false)
    }
  }

  const toggleEnabled = async (item) => {
    if (!token) return
    try {
      // Use new toggle endpoint
      const res = await api.post(`/opay-business/kyc/toggle-status/${item._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const updatedEnabled = res.data.enabled
      setItems((prev) => prev.map((b) => (b._id === item._id ? { ...b, enabled: updatedEnabled } : b)))
    } catch (e) {
      alert('Failed to update status: ' + (e.response?.data?.message || e.message))
    }
  }

  const handleRegenerate = async (item) => {
    if (!token) return
    if (!window.confirm('Are you sure you want to regenerate this API token? Old token will stop working.')) {
      return
    }
    setRegenLoading((prev) => ({ ...prev, [item._id]: true }))
    try {
      const res = await regenerateOpayBusinessToken(token, item._id)
      const updated = res?.data || item
      setItems((prev) => prev.map((b) => (b._id === updated._id ? updated : b)))
    } catch (e) {
      alert('Failed to regenerate token')
    } finally {
      setRegenLoading((prev) => ({ ...prev, [item._id]: false }))
    }
  }

  const handleCopyToken = async (item) => {
    if (!navigator.clipboard || !item?.apiToken) return
    try {
      await navigator.clipboard.writeText(item.apiToken)
      setCopiedId(item._id)
      setTimeout(() => {
        setCopiedId((prev) => (prev === item._id ? null : prev))
      }, 1500)
    } catch (e) {
      // ignore
    }
  }




  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  return (
    <div className="space-y-8 relative">


      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px]" />

        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              Opay Business
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Manage enterprise brands, domains, and API access tokens.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm text-rose-200 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {error}
        </div>
      )}

      {/* List of brands */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>
            Registered Brands
          </h3>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 hover:border-white/10 transition-all font-medium text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-indigo-400/60 w-full bg-black/20 rounded-3xl border border-white/5 backdrop-blur-md">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <span className="font-bold tracking-widest uppercase text-xs">Loading Brands...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white/5 rounded-3xl border border-dashed border-white/10 backdrop-blur-md">
            <Building2 className="w-12 h-12 mb-4 opacity-50" />
            <span className="font-bold text-lg text-slate-400">No brands found</span>
            <span className="text-xs uppercase tracking-widest mt-1 opacity-60">System is empty</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item._id} className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/40 backdrop-blur-xl p-6 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:border-indigo-500/30 transition-all duration-500 group overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] group-hover:bg-indigo-500/20 transition-all" />
                
                <div className="relative z-10 flex flex-col h-full">
                  
                  {/* Top Header: Title & Badges */}
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h4 className="text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent group-hover:from-indigo-100 group-hover:to-white transition-colors">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${item.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                          {item.enabled ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
                          {item.enabled ? 'Active' : 'Disabled'}
                        </span>
                        
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                          item.kycStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          item.kycStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {item.kycStatus === 'approved' && <ShieldCheck className="w-3 h-3" />}
                          {item.kycStatus === 'pending' && <Clock className="w-3 h-3" />}
                          KYC: {item.kycStatus || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Domain & Email */}
                  <div className="flex flex-col gap-2 text-sm font-medium text-slate-300 mb-5">
                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 border-l-2 border-l-violet-500">
                      <Globe2 className="w-4 h-4 text-violet-400" />
                      {item.domain}
                    </div>
                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 border-l-2 border-l-sky-500">
                      <Mail className="w-4 h-4 text-sky-400" />
                      {item.email}
                    </div>
                  </div>

                  {/* Financial & Analytics Dashboard */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between px-1">
                      <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                         <TrendingUp className="w-3 h-3" /> Analytics Dashboard
                      </h5>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">Real-time stats</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-[1.5rem] bg-indigo-500/5 border border-indigo-500/10 transition-all hover:bg-indigo-500/10 group/stat relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 blur-xl group-hover/stat:bg-indigo-500/10 transition-colors" />
                        <p className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest mb-1 group-hover/stat:text-indigo-400 transition-colors">Available Balance</p>
                        <p className="text-xl font-black text-indigo-200 tracking-tight">৳{(item.availableBalance || 0).toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Ready to withdraw</p>
                      </div>

                      <div className="p-4 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/10 transition-all hover:bg-emerald-500/10 group/stat relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 blur-xl group-hover/stat:bg-emerald-500/10 transition-colors" />
                        <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1 group-hover/stat:text-emerald-400 transition-colors">Total Revenue</p>
                        <p className="text-xl font-black text-emerald-400 tracking-tight">৳{(item.totalSuccessAmount || 0).toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-emerald-900/60 mt-1 uppercase tracking-tighter">Lifetime success</p>
                      </div>

                      <div className="p-4 rounded-[1.5rem] bg-white/5 border border-white/10 transition-all hover:bg-white/10 group/stat col-span-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover/stat:text-slate-300 transition-colors">Today's Volume</p>
                        <p className="text-lg font-black text-white tracking-tight">৳{(item.today?.amountToday || 0).toLocaleString()}</p>
                        <div className="flex items-center gap-1 mt-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{item.today?.successToday || 0} Successful links</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-[1.5rem] bg-white/5 border border-white/10 transition-all hover:bg-white/10 group/stat col-span-1">
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover/stat:text-slate-300 transition-colors">Total Sessions</p>
                         <p className="text-lg font-black text-white tracking-tight">{item.today?.generatedToday || 0}</p>
                         <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Generated today</p>
                      </div>
                    </div>
                  </div>

                  {/* Auth Token (Collapsible or compact) */}
                  <div className="mt-auto bg-[#0a0a0f]/60 rounded-2xl p-4 border border-indigo-500/10 shadow-[inner_0_0_20px_rgba(99,102,241,0.02)] relative group/token group-hover:bg-[#0a0a0f] transition-all">
                    <div className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest mb-2 flex items-center justify-between">
                      <span>Auth Token</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="text-[10px] text-indigo-200/40 font-mono flex-1 truncate bg-indigo-500/5 px-3 py-2 rounded-lg border border-indigo-500/10 group-hover:text-indigo-200/80 transition-colors">
                        {item.apiToken}
                      </code>
                      <button
                        onClick={() => handleCopyToken(item)}
                        className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg text-indigo-400 hover:text-white transition-all border border-indigo-500/10"
                        title="Copy API Token"
                      >
                        {copiedId === item._id ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Bottom Actions Row */}
                  <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-white/10">
                    <div className="flex gap-2">
                       <button
                        onClick={() => navigate(`/opay-business/${item._id}/history`, { state: { business: item } })}
                        className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-white transition-all hover:shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                        title="View Billing/History"
                      >
                        <Clock className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => navigate(`/opay-business/${item._id}`, { state: { business: item } })}
                        className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                        title="View Full Identity & KYC Details"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      
                      <button
                        onClick={() => toggleEnabled(item)}
                        className={`p-3 rounded-xl border transition-all ${item.enabled ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]'}`}
                        title={item.enabled ? "Suspend Brand" : "Activate Brand"}
                      >
                        <Power className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleRegenerate(item)}
                      disabled={regenLoading[item._id]}
                      className="group/regen flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-600 hover:text-white hover:border-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 group-hover/regen:rotate-180 transition-transform duration-500 ${regenLoading[item._id] ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-300 text-right">{value}</span>
    </div>
  )
}

function DocPreview({ label, url, apiUrl }) {
  if (!url) return null;
  return (
    <a href={`${apiUrl}${url}`} target="_blank" rel="noreferrer" className="block group relative aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all">
      <img src={`${apiUrl}${url}`} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm p-2 text-xs font-bold text-center text-slate-300 border-t border-white/10">
        {label}
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <ExternalLink className="w-5 h-5 text-white drop-shadow-md" />
      </div>
    </a>
  )
}
