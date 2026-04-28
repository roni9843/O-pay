import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { Wallet, Save, Loader2, Check } from 'lucide-react'

export default function BinanceAddress(){
  const token = useAuthStore(s=>s.token)
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load(){
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/settings/binance-address`)
        const data = await res.json()
        if (res.status === 401 || res.status === 403) { useAuthStore.getState().logout(); window.location.href = '/login'; }
        if (res.ok) setAddress(data.address || '')
      } catch (_) {}
    }
    load()
  }, [])

  async function save(){
    if (!token) return
    setLoading(true); setError(''); setSaved(false)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/settings/binance-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address })
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) { useAuthStore.getState().logout(); window.location.href = '/login'; }
      if (!res.ok) throw new Error(data?.message || 'Save failed')
      setSaved(true)
      setTimeout(()=>setSaved(false), 2000)
    } catch(e){
      setError(e.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-orange-600/20 via-yellow-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[80px]" />
         <div className="relative z-10">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
               <span className="bg-gradient-to-r from-orange-300 to-yellow-300 bg-clip-text text-transparent">
                  Binance Settings
               </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
               Configure the Binance wallet address for user deposits.
            </p>
         </div>
      </div>

      <div className="max-w-2xl">
         {error && <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 text-sm">{error}</div>}
         
         <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-8 shadow-xl">
            <div className="space-y-6">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block pl-1">Wallet Address</label>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                         <Wallet className="w-5 h-5 text-orange-400" />
                      </div>
                      <input
                        value={address}
                        onChange={e=>setAddress(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-orange-500 focus:border-orange-500/50 outline-none transition-all font-mono text-sm"
                        placeholder="Enter Binance wallet address (e.g. 0x...)"
                      />
                   </div>
                   <p className="mt-2 text-xs text-slate-500 pl-1">
                      This address will be displayed to users when they choose Binance as their deposit method.
                   </p>
                </div>

                <div className="flex items-center gap-4">
                   <button 
                      disabled={loading} 
                      onClick={save} 
                      className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-xs uppercase tracking-wider flex items-center gap-2"
                   >
                     {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                     {loading ? 'Saving...' : 'Save Configuration'}
                   </button>
                   
                   {saved && (
                      <span className="text-emerald-400 text-sm font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                         <Check className="w-4 h-4" /> Changes saved successfully
                      </span>
                   )}
                </div>
            </div>
         </div>
      </div>
    </div>
  )
}
