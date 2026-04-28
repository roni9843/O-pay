import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { Check, ExternalLink, Clock, AlertTriangle, Wallet } from 'lucide-react'

export default function PendingBalances(){
  const token = useAuthStore(s=>s.token)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(){
    if (!token) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/balance-topups/pending?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) { useAuthStore.getState().logout(); window.location.href = '/login'; }
      if (!res.ok) throw new Error(data?.message || 'Failed to load')
      setItems(data.data || [])
    } catch(e){
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function approve(id){
    if (!token) return
    if (!confirm('Are you sure you want to approve this balance request?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/balance-topups/approve/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) { useAuthStore.getState().logout(); window.location.href = '/login'; }
      if (!res.ok) throw new Error(data?.message || 'Approve failed')
      await load()
    } catch(e){
      alert(e.message)
    }
  }

  useEffect(()=>{ load() }, [token])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px]" />
         <div className="relative z-10">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
               <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                  Pending Balances
               </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
               Review and approve user balance top-up requests.
            </p>
         </div>
      </div>

      {error && (
         <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
         </div>
      )}

      {/* Table */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Screenshot</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td className="px-6 py-12 text-center text-slate-400" colSpan={5}>Loading requests...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-6 py-12 text-center text-slate-500" colSpan={5}>No pending requests found.</td></tr>
              ) : (
                items.map(it => (
                  <tr key={it._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-white text-xs font-bold">
                             {it.user?.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                             <div className="font-bold text-white text-sm">{it.user?.name || 'Unknown User'}</div>
                             <div className="text-[10px] text-slate-400 font-mono">{it.user?.email || '-'}</div>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-mono font-bold text-emerald-400 text-sm">
                          ${Number(it.amount).toFixed(2)}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      {it.screenshotUrl ? (
                        <a 
                           href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${it.screenshotUrl}`} 
                           target="_blank" 
                           rel="noreferrer" 
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                        >
                           <ExternalLink className="w-3.5 h-3.5" /> View Proof
                        </a>
                      ) : <span className="text-slate-500 text-xs italic">No screenshot</span> }
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                       {it.createdAt ? new Date(it.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                         className="px-4 py-2 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 ml-auto hover:shadow-lg hover:shadow-emerald-900/20"
                         onClick={()=>approve(it._id)}
                      >
                         <Check className="w-4 h-4" /> Approve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
