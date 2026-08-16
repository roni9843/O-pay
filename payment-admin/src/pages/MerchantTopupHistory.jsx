import React, { useEffect, useState } from 'react'
import { getMerchantTopupHistory } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { Wallet, Search, RefreshCw, ChevronLeft, ChevronRight, User, Loader2 } from 'lucide-react'

export default function MerchantTopupHistory() {
  const token = useAuthStore(s => s.token)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')

  async function loadData(p = 1) {
    setLoading(true)
    try {
      const res = await getMerchantTopupHistory(token, p)
      if (res?.success) {
        setItems(res.data)
        setTotalPages(res.pagination?.pages || 1)
        setPage(res.pagination?.page || 1)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) loadData(page)
  }, [token, page])

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    const bName = item.merchantId?.businessName?.toLowerCase() || '';
    const trxId = item.trxId?.toLowerCase() || '';
    return bName.includes(q) || trxId.includes(q);
  })

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-emerald-400" />
            Merchant Topup History
          </h2>
          <p className="text-slate-400 mt-1">View all balance topups made by merchants, including fee deductions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search business or TrxID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 min-w-[220px]"
            />
          </div>
          <button 
            onClick={() => loadData(page)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-colors text-white flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-black/40 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">Date</th>
                <th className="px-6 py-4">Merchant</th>
                <th className="px-6 py-4">Transaction Details</th>
                <th className="px-6 py-4">Base Added</th>
                <th className="px-6 py-4">Opay Fee</th>
                <th className="px-6 py-4">Total Paid</th>
                <th className="px-6 py-4 text-center">Balance (Old &rarr; New)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-500" />
                    Loading history...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No topup history found.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-slate-300 font-medium">{new Date(item.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                           <User className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-slate-200 font-bold">{item.merchantId?.businessName || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{item.merchantId?.phone || 'No phone'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-slate-300 font-mono text-xs">{item.trxId}</div>
                       <div className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mt-1">{item.method || 'OPAY'}</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-emerald-400 font-bold">৳ {item.baseAmount || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-rose-400 font-semibold">৳ {item.feeAmount || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-white font-bold">৳ {item.amount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                       <div className="inline-flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700">
                          <span className="text-slate-400 text-xs line-through">৳{item.previousBalance || 0}</span>
                          <span className="text-slate-500">&rarr;</span>
                          <span className="text-emerald-400 font-bold text-sm">৳{item.newBalance || (item.previousBalance || 0) + (item.baseAmount || 0)}</span>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && totalPages > 1 && (
          <div className="border-t border-white/5 px-6 py-4 flex items-center justify-between bg-black/20">
            <p className="text-sm text-slate-400">
              Showing page <span className="font-medium text-white">{page}</span> of <span className="font-medium text-white">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
