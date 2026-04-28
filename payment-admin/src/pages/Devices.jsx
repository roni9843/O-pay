import React, { useEffect, useState } from 'react'
import { listDevices, deleteDevice } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { Smartphone, Trash2, Search, Zap, Shield, User } from 'lucide-react'

export default function Devices(){
  const token = useAuthStore(s=>s.token)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let ignore = false
    async function load(){
      if (!token) return
      setLoading(true); setError('')
      try {
        const res = await listDevices(token, { page: 1, limit: 100 })
        if (!ignore) setItems(res.data || [])
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load devices')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [token])

  async function handleDelete(id){
    if (!token) return
    setActionError('')
    const ok = window.confirm('Are you sure you want to delete this device and all related data?')
    if (!ok) return
    try {
      setDeletingId(id)
      await deleteDevice(token, id)
      setItems(list => list.filter(d => d._id !== id))
    } catch (err) {
      setActionError(err.message || 'Failed to delete device')
    } finally {
      setDeletingId('')
    }
  }

  const filteredItems = items.filter(d => 
     (d.deviceName?.toLowerCase() || '').includes(search.toLowerCase()) ||
     (d.deviceCode?.toLowerCase() || '').includes(search.toLowerCase()) ||
     (d.owner?.name?.toLowerCase() || '').includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Registered Devices
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
             Manage all active devices in the payment network. Monitor verification stats and device health.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
           <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
              </div>
              <input 
                 type="text" 
                 placeholder="Search devices..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-black/20 text-white text-sm focus:outline-none focus:border-violet-500/50 focus:bg-black/40 w-full md:w-64 transition-all"
              />
           </div>
        </div>
      </div>

      {error && (
         <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-200 text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 mb-0.5" /> {error}
         </div>
      )}
      {actionError && (
         <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-200 text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 mb-0.5" /> {actionError}
         </div>
      )}

      {/* Table Card */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Device Info</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Stats</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                   <td className="px-6 py-12 text-center text-slate-400" colSpan={5}>
                      <div className="flex flex-col items-center justify-center gap-3">
                         <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                         Scanning devices...
                      </div>
                   </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                   <td className="px-6 py-12 text-center text-slate-500" colSpan={5}>
                      No devices found matching your search.
                   </td>
                </tr>
              ) : (
                filteredItems.map(d => (
                  <tr key={d._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                             {(d.owner?.name?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                             <div className="font-medium text-white">{d.owner?.name || 'Unknown'}</div>
                             <div className="text-[11px] text-slate-400">{d.owner?.email || '-'}</div>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-200">
                             <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                             {d.deviceName || 'Generic Device'}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                             <User className="w-3 h-3" />
                             {d.deviceUserName || 'No user'}
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/5 border border-white/10 font-mono text-xs text-emerald-300">
                          {d.deviceCode || '---'}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-300 flex items-center gap-1.5">
                             <Shield className="w-3 h-3 text-emerald-400" />
                             {d.verifiedPayments ?? 0} Verified
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono pl-4">
                             ৳{d.verifiedAmount ?? 0}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(d._id)}
                        disabled={!!deletingId}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                        title="Delete Device"
                      >
                         {deletingId === d._id ? (
                            <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 animate-spin rounded-full" />
                         ) : (
                            <Trash2 className="w-4 h-4" />
                         )}
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
