import React, { useEffect, useState } from 'react'
import { getTopupHistory } from '../lib/api'
import { Wallet, Search, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export default function TopupHistory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')

  async function loadData(p = 1) {
    setLoading(true)
    try {
      const res = await getTopupHistory({ page: p })
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
    loadData(page)
  }, [page])

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    const trxId = item.trxId?.toLowerCase() || '';
    return trxId.includes(q);
  })

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-emerald-500" />
            Topup History
          </h2>
          <p className="text-slate-500 mt-1">View all your balance topups and fee deductions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search TrxID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500/50 min-w-[220px]"
            />
          </div>
          <button 
            onClick={() => loadData(page)}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition-colors text-slate-700 flex items-center gap-2 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Transaction Details</th>
                <th className="px-6 py-4">Base Added</th>
                <th className="px-6 py-4">Fee Deducted</th>
                <th className="px-6 py-4">Total Paid</th>
                <th className="px-6 py-4 text-center">Balance (Old &rarr; New)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-500" />
                    Loading history...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No topup history found.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{new Date(item.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-slate-900 font-mono text-xs">{item.trxId}</div>
                       <div className="text-xs text-emerald-600 uppercase tracking-wider font-semibold mt-1">{item.method || 'OPAY'}</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-emerald-600 font-bold">৳ {item.baseAmount || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-rose-500 font-semibold">৳ {item.feeAmount || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-slate-900 font-bold">৳ {item.amount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                       <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 text-xs line-through">৳{item.previousBalance || 0}</span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="text-emerald-600 font-bold text-sm">৳{item.newBalance || (item.previousBalance || 0) + (item.baseAmount || 0)}</span>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && totalPages > 1 && (
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500">
              Showing page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
