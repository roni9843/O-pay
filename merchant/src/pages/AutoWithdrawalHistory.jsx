import React, { useEffect, useState } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Layers, ArrowUpRight, Trash2, Search, Calendar, Calculator } from 'lucide-react'
import { getAutoWithdrawalHistory, cancelAutoWithdrawal } from '../lib/api'
const getProofImageUrl = (path) => {
  if (!path) return '';
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) {
    try {
      const urlObj = new URL(path);
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return `${API_BASE}${urlObj.pathname}${urlObj.search}`;
      }
    } catch (e) {}
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};

export default function AutoWithdrawalHistory() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')

  async function loadData() {
    setLoading(true)
    try {
      const res = await getAutoWithdrawalHistory({ status: statusFilter })
      setItems(res.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this auto withdrawal? The balance will be refunded.")) return;
    try {
      await cancelAutoWithdrawal(id);
      loadData();
    } catch (e) {
      alert(e.response?.data?.message || "Failed to cancel withdrawal");
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Pending</span>;
      case 'booked': return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Processing (Booked)</span>;
      case 'completed': return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Completed</span>;
      case 'rejected': return <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Rejected (Retry)</span>;
      case 'failed': return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Failed</span>;
      default: return <span className="bg-slate-500/20 text-slate-300 border border-slate-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">{status}</span>;
    }
  }

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchSearch = q === '' || 
      (item.userIdentityAddress && item.userIdentityAddress.toLowerCase().includes(q)) || 
      (item.paymentMethod && item.paymentMethod.toLowerCase().includes(q)) ||
      (item.accountNumber && item.accountNumber.toLowerCase().includes(q)) ||
      (item._id && item._id.toLowerCase().includes(q));

    let matchDate = true;
    if (dateFilter !== 'all') {
      const itemDate = new Date(item.createdAt);
      const now = new Date();
      if (dateFilter === 'today') {
        matchDate = itemDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'this_week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchDate = itemDate >= weekAgo;
      } else if (dateFilter === 'this_month') {
        matchDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
    }

    return matchSearch && matchDate;
  });

  const totalAmount = filteredItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const completedAmount = filteredItems.filter(i => i.status === 'completed').reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Layers className="w-8 h-8 text-fuchsia-600" />
            API Auto Withdrawals
          </h2>
          <p className="text-slate-500 mt-1">History of withdrawals initiated via your API endpoint.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search ID, Account, Method..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-fuchsia-500/50 shadow-sm text-sm min-w-[200px]"
            />
          </div>
          <select 
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-fuchsia-500/50 shadow-sm text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="this_week">Last 7 Days</option>
            <option value="this_month">This Month</option>
          </select>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-fuchsia-500/50 shadow-sm text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="booked">Processing</option>
            <option value="completed">Completed</option>
          </select>
          <button 
            onClick={loadData}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 transition-colors text-slate-700 flex items-center gap-2 shadow-sm text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase">Filtered Total</p>
              <h3 className="text-2xl font-black text-slate-800">৳{totalAmount.toLocaleString()}</h3>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase">Completed Amount</p>
              <h3 className="text-2xl font-black text-emerald-600">৳{completedAmount.toLocaleString()}</h3>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase">Total Items</p>
              <h3 className="text-2xl font-black text-slate-800">{filteredItems.length}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Date</th>
                <th className="px-6 py-4 whitespace-nowrap">Amount / Method</th>
                <th className="px-6 py-4 whitespace-nowrap">Target Details</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Proofs / Details</th>
                <th className="px-6 py-4 whitespace-nowrap">Callback Status</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-fuchsia-400" />
                    Loading data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 italic">No auto withdrawals found for these filters.</td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      <div>{new Date(item.createdAt).toLocaleString()}</div>
                      <div className="text-[10px] font-mono mt-1" title="Withdrawal ID">ID: {item._id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-emerald-600 text-base">৳{item.amount?.toLocaleString()}</div>
                      {item.feeAmount > 0 && (
                        <div className="text-xs text-rose-500 font-medium">+ ৳{item.feeAmount?.toLocaleString()} Fee</div>
                      )}
                      <div className="text-xs text-slate-500 uppercase">{item.paymentMethod}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono text-slate-700 text-sm">{item.userIdentityAddress}</div>
                      {item.accountNumber && (
                        <div className="font-mono text-emerald-600 font-bold text-xs mt-1">Acc: {item.accountNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-6 py-4 min-w-[200px]">
                      {item.status === 'rejected' && item.rejectReason && (
                        <div className="text-xs text-rose-500 font-medium bg-rose-50 p-1.5 rounded border border-rose-100">
                          Note: {item.rejectReason}
                        </div>
                      )}
                      {item.status === 'completed' && item.proofImages && item.proofImages.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-1">
                          {item.proofImages.map((img, i) => (
                            <a key={i} href={getProofImageUrl(img)} target="_blank" rel="noreferrer" className="block w-10 h-10 rounded border border-slate-200 overflow-hidden hover:border-emerald-500 transition-colors">
                              <img src={getProofImageUrl(img)} alt="Proof" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {item.status === 'pending' && <span className="text-xs text-slate-400 italic">No details yet</span>}
                      {item.status === 'booked' && <span className="text-xs text-slate-400 italic">In progress...</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.callbackUrl ? (
                        item.status === 'completed' || item.status === 'rejected' || item.status === 'cancelled' ? (
                          <span className={`${item.status === 'completed' ? 'text-emerald-600' : 'text-rose-600'} text-xs flex items-center gap-1 font-medium`}><CheckCircle className="w-3 h-3" /> Sent</span>
                        ) : (
                          <span className="text-amber-500 text-xs flex items-center gap-1 font-medium"><Clock className="w-3 h-3" /> Waiting</span>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs italic">No Webhook</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {item.status === 'pending' ? (
                        <button 
                          onClick={() => handleCancel(item._id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-2 text-xs font-bold"
                          title="Cancel Withdrawal"
                        >
                          <Trash2 className="w-4 h-4" /> Cancel
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
