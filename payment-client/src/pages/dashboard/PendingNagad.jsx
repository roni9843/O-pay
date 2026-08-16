import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Check, X, Clock, AlertTriangle, Briefcase } from 'lucide-react'
import api from '../../lib/api'

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
      const data = await api.getAgentPendingNagad(token)
      setItems(data.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load pending Nagad payments')
    } finally {
      setLoading(false)
    }
  }

  async function accept(code) {
    if (!token) return
    if (!window.confirm('Are you sure you want to approve this Nagad payment? Webhook callback and credit deduction will run.')) return
    try {
      const data = await api.acceptPendingNagad(token, code)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  async function reject(code) {
    if (!token) return
    if (!window.confirm('Are you sure you want to REJECT and CANCEL this Nagad payment session?')) return
    try {
      const data = await api.rejectPendingNagad(token, code)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[80px]" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              Pending Nagad Transactions
            </span>
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Review and approve Nagad transactions that require your confirmation.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-50 px-5 py-3 text-sm text-red-600 flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading pending transactions...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No pending Nagad transactions found.</div>
        ) : (
          items.map(it => (
            <div key={it._id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-0.5">Session Code</div>
                  <div className="font-bold text-gray-900 text-sm font-mono">{it.code}</div>
                  {it.invoiceNumber && <div className="text-[10px] text-purple-600 font-medium mt-0.5">Inv: {it.invoiceNumber}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 font-semibold mb-0.5">Amount</div>
                  <div className="font-mono font-bold text-orange-600 text-base">৳{Number(it.amount).toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-0.5">Notification</div>
                  <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    it.aiVerification?.pushNotificationStatus === 'Success'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    {it.aiVerification?.pushNotificationStatus || 'Pending'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 font-semibold mb-0.5">Date</div>
                  <div className="text-gray-600 text-xs">{it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '-'}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-xs text-gray-500 font-semibold mb-1">Matched Message Details</div>
                {it.paymentMessage ? (
                  <div>
                    <div className="text-gray-900 text-xs font-medium break-words">
                      {it.paymentMessage.fullMessage || it.paymentMessage.text || 'Empty message'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      Device: {it.paymentMessage.deviceName || it.paymentMessage.deviceId}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      TrxID: {it.paymentMessage.trxID || 'N/A'}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs italic">No matched message</span>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm"
                  onClick={() => accept(it.code)}
                >
                  <Check className="w-4 h-4" /> Accept
                </button>
                <button
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm"
                  onClick={() => reject(it.code)}
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto pb-4">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Session Code / Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Target TrxID / Amount</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Matched Message Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Notification</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td className="px-6 py-12 text-center text-gray-500" colSpan={6}>Loading pending transactions...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-6 py-12 text-center text-gray-500" colSpan={6}>No pending Nagad transactions found.</td></tr>
              ) : (
                items.map(it => (
                  <tr key={it._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-gray-900 text-sm font-mono">{it.code}</div>
                        {it.invoiceNumber && (
                          <div className="text-[10px] text-purple-600 font-medium">Inv: {it.invoiceNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-mono font-bold text-orange-600 text-base">
                          ৳{Number(it.amount).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono mt-1">
                          TrxID: {it.paymentMessage?.trxID || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {it.paymentMessage ? (
                        <div>
                          <div className="text-gray-900 text-xs font-medium truncate" title={it.paymentMessage.fullMessage || it.paymentMessage.text}>
                            {it.paymentMessage.fullMessage || it.paymentMessage.text || 'Empty message'}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Device: {it.paymentMessage.deviceName || it.paymentMessage.deviceId}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">No matched message</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        it.aiVerification?.pushNotificationStatus === 'Success'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {it.aiVerification?.pushNotificationStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-green-500/20"
                          onClick={() => accept(it.code)}
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-red-500/20"
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
