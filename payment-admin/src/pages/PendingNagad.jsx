import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { Check, X, ExternalLink, Clock, AlertTriangle, Briefcase, CreditCard } from 'lucide-react'

export default function PendingNagad() {
  const token = useAuthStore(s => s.token)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/pending-nagad?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
      if (!res.ok) throw new Error(data?.message || 'Failed to load pending Nagad payments')
      setItems(data.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load pending Nagad payments')
    } finally {
      setLoading(false)
    }
  }

  async function accept(code) {
    if (!token) return
    if (!confirm('Are you sure you want to approve this Nagad payment? Webhook callback and credit deduction will run.')) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/pending-nagad/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
      if (!res.ok) throw new Error(data?.message || 'Accept failed')
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  async function reject(code) {
    if (!token) return
    if (!confirm('Are you sure you want to REJECT and CANCEL this Nagad payment session?')) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/pending-nagad/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
      if (!res.ok) throw new Error(data?.message || 'Reject failed')
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-orange-600/20 via-rose-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[80px]" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
              Pending Nagad Approval
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Review and approve Nagad transactions that require administrator confirmation.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm text-rose-200 flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Session Code / Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Merchant / Business</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Target TrxID / Amount</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Matched Message Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Notification</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td className="px-6 py-12 text-center text-slate-400" colSpan={7}>Loading pending transactions...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-6 py-12 text-center text-slate-500" colSpan={7}>No pending Nagad transactions found.</td></tr>
              ) : (
                items.map(it => (
                  <tr key={it._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-white text-sm font-mono">{it.code}</div>
                        {it.invoiceNumber && (
                          <div className="text-[10px] text-indigo-400">Inv: {it.invoiceNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-sky-400" />
                        <div>
                          <div className="font-bold text-white">{it.business?.name || 'Unknown Merchant'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{it.business?.domain || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-mono font-bold text-orange-400 text-sm">
                          ৳{Number(it.amount).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          TrxID: {it.paymentMessage?.trxID || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {it.paymentMessage ? (
                        <div>
                          <div className="text-white text-xs font-medium truncate" title={it.paymentMessage.fullMessage || it.paymentMessage.text}>
                            {it.paymentMessage.fullMessage || it.paymentMessage.text || 'Empty message'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Device: {it.paymentMessage.deviceName || it.paymentMessage.deviceId}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">No matched message</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        it.aiVerification?.pushNotificationStatus === 'Success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {it.aiVerification?.pushNotificationStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:shadow-lg hover:shadow-emerald-900/20"
                          onClick={() => accept(it.code)}
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-lg bg-rose-600/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:shadow-lg hover:shadow-rose-900/20"
                          onClick={() => reject(it.code)}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
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
