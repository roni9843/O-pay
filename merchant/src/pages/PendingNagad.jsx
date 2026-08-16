import React, { useEffect, useState } from 'react';
import { getPendingNagad } from '../lib/api';
import { Clock, RefreshCw, Loader2, CalendarClock, Briefcase, Eye } from 'lucide-react';

export default function PendingNagad() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPending = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getPendingNagad();
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setError(res.message || 'Failed to load pending payments');
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err.message || 'Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-8 h-8 text-orange-500 animate-pulse" />
            Pending Nagad Payments
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            View Nagad payments awaiting administrator manual verification.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPending}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-bold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
            Pending Transactions
          </h2>
          <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
            {items.length} Awaiting Approval
          </span>
        </div>

        <div className="relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] transition-all">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-3" />
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">Syncing Pending Records...</p>
            </div>
          )}

          {items.length === 0 && !loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Clock className="w-12 h-12 mb-4 opacity-20 text-orange-500" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No pending Nagad payments</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mt-1">All sessions verified or completed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Time & Date</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Code / Invoice</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Target TrxID</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 whitespace-nowrap font-bold text-slate-700">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 font-mono">{item.code}</div>
                        {item.invoiceNumber && <div className="text-[10px] text-slate-400 font-mono">#{item.invoiceNumber}</div>}
                      </td>
                      <td className="px-6 py-5 max-w-xs">
                        <div className="font-bold text-slate-900 truncate" title={item.userIdentityAddress}>
                          {item.userIdentityAddress || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-mono text-xs text-slate-500 font-bold">
                        {item.paymentMessage?.trxID || 'Awaiting TrxID'}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-black text-slate-900 text-sm">
                        ৳{Number(item.amount || 0).toLocaleString('en-BD')} <span className="text-[10px] font-bold text-slate-400">BDT</span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-black border bg-orange-100 text-orange-800 border-orange-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                          Awaiting Approval
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
