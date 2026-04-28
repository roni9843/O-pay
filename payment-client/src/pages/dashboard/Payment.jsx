import React, { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { getPayments } from "../../lib/api";
import { 
  Filter, 
  Search, 
  DollarSign, 
  Calendar, 
  Smartphone, 
  Hash, 
  Sparkles, 
  X, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  CreditCard,
  Layers,
  FileText,
  Sun,
  Moon
} from "lucide-react";

export default function Payment() {
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);

  const [provider, setProvider] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const params = useMemo(() => {
    const p = { page, limit };
    if (provider) p.provider = provider.trim();
    if (min) p.min = min;
    if (max) p.max = max;
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [page, limit, provider, min, max, from, to]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await getPayments(token, params);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, token]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function resetAndSearch() {
    setPage(1);
    load();
    setShowFilters(false);
  }

  function resetFilters() {
    setProvider(""); setMin(""); setMax(""); setFrom(""); setTo(""); setPage(1);
  }

  return (
    <div className="min-h-screen bg-[#0f111a] text-slate-200 p-4 md:p-8 lg:p-12 relative overflow-x-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white">
                Payment History
              </h1>
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Financial Inteligence Dashboard</p>
          </div>

          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-3xl p-4 backdrop-blur-xl">
             <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase">Volume</p>
                   <p className="text-sm font-black text-white">{total}</p>
                </div>
             </div>
             <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-3 rounded-xl transition-all ${
                  darkMode ? "bg-white/5 text-yellow-400 border border-white/10 hover:bg-white/10" : "bg-white text-indigo-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
             <button 
               onClick={() => setShowFilters(!showFilters)}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                 showFilters ? "bg-white text-black" : "bg-white/5 hover:bg-white/10 text-slate-300"
               }`}
             >
                <Filter className="w-3.5 h-3.5" /> {showFilters ? "Close" : "Filter"}
             </button>
          </div>
        </div>

        {/* Dynamic Filter Panel */}
        {showFilters && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 rounded-[2.5rem] bg-slate-900/50 border border-white/5 p-6 md:p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gateway Provider</label>
                  <input
                    placeholder="e.g. bkash, nagad"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-white placeholder-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min Amount (BDT)</label>
                  <input
                    type="number"
                    placeholder="Min Value"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-white placeholder-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Amount (BDT)</label>
                  <input
                    type="number"
                    placeholder="Max Value"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-white placeholder-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">From Date</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">To Date</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-white"
                  />
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-white/5">
                <button
                  onClick={resetAndSearch}
                  className="px-8 py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" /> Apply Sequence
                </button>
                <button
                  onClick={resetFilters}
                  className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                >
                  Reset Core
                </button>
                <div className="sm:ml-auto flex items-center gap-4 bg-black/20 px-4 py-2 rounded-2xl">
                   <p className="text-[10px] font-black text-slate-500 uppercase">Limit</p>
                   <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="bg-transparent text-sm font-black text-white outline-none cursor-pointer"
                   >
                    {[10, 20, 50, 100].map(n => (
                      <option key={n} value={n} className="bg-slate-900 font-black">{n}</option>
                    ))}
                  </select>
                </div>
             </div>
          </div>
        )}

        {/* Transactions Table Section */}
        <div className={`rounded-[2.5rem] border overflow-hidden relative shadow-2xl ${darkMode ? "bg-slate-900 border-white/5" : "bg-white border-slate-200"}`}>
          <div className="p-1 md:p-2">
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                 <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                 <p className="text-xs font-black uppercase tracking-widest text-slate-500">Syncing Transactions...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                 <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-slate-600">
                    <FileText className="w-8 h-8" />
                 </div>
                 <p className="text-xs font-black uppercase tracking-widest text-slate-500">No transactions recorded</p>
              </div>
            ) : (
              <>
                {/* Responsive Table for Tablet/Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                        <th className="py-6 px-8">Sequence Date</th>
                        <th className="py-6 px-4 text-center">Identity</th>
                        <th className="py-6 px-4">Transaction Hub</th>
                        <th className="py-6 px-4">Reference Info</th>
                        <th className="py-6 px-4 text-right">Magnitude</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {items.map((it, i) => (
                        <tr key={`${it.trxID}-${i}`} className="group hover:bg-white/5 transition-colors">
                          <td className="py-6 px-8">
                             <div className="flex flex-col">
                                <span className="text-sm font-black text-white">{new Date(it.createdAt).toLocaleDateString()}</span>
                                <span className="text-[10px] font-bold text-slate-500">{new Date(it.createdAt).toLocaleTimeString()}</span>
                             </div>
                          </td>
                          <td className="py-6 px-4">
                             <div className="flex items-center justify-center">
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                  it.provider?.toLowerCase() === 'bkash' ? 'bg-pink-500/10 text-pink-500 border-pink-500/20' :
                                  it.provider?.toLowerCase() === 'nagad' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                  'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                                }`}>
                                   {it.provider || "-"}
                                </span>
                             </div>
                          </td>
                          <td className="py-6 px-4">
                             <div className="flex flex-col">
                                <span className="text-sm font-mono font-bold text-slate-300 tracking-tighter">{it.trxID || "-"}</span>
                                <span className="text-[10px] font-bold text-slate-500">Global ID Sequence</span>
                             </div>
                          </td>
                          <td className="py-6 px-4">
                             <div className="flex flex-col max-w-[200px]">
                                <span className="text-[11px] font-bold text-slate-400 truncate group-hover:whitespace-normal group-hover:bg-slate-800/80 group-hover:p-2 group-hover:rounded-xl group-hover:shadow-2xl transition-all" title={it.fullMessage}>
                                   {it.fullMessage || "-"}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                   <Smartphone className="w-3 h-3 text-slate-600" />
                                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{it.deviceName || "Cluster-1"}</span>
                                </div>
                             </div>
                          </td>
                          <td className="py-6 px-8 text-right">
                             <div className="flex flex-col items-end">
                                <span className="text-xl font-black text-emerald-500 tracking-tighter">৳{Number(it.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[9px] font-black text-emerald-500/40 uppercase tracking-widest">Verified Sequence</span>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grid for Mobile and Tablet */}
                <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {items.map((it, i) => (
                    <div key={`${it.trxID}-${i}-mobile`} className="relative overflow-hidden p-6 rounded-[2rem] bg-white/5 border border-white/10 shadow-xl group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                         <Layers className="w-16 h-16" />
                      </div>
                      
                      <div className="flex justify-between items-start mb-6">
                         <div className="space-y-1">
                            <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
                              it.provider?.toLowerCase() === 'bkash' ? 'bg-pink-500/10 text-pink-500 border-pink-500/20' : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                            }`}>
                               {it.provider || "-"}
                            </span>
                            <p className="text-[10px] font-bold text-slate-500 mt-2">{new Date(it.createdAt).toLocaleString()}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-2xl font-black text-emerald-500 tracking-tighter">৳{Number(it.amount).toLocaleString()}</p>
                            <p className="text-[9px] font-black text-emerald-500/40 uppercase tracking-widest">Magnitude</p>
                         </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/10">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                  <Hash className="w-4 h-4 text-slate-500" />
                                </div>
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trx ID</p>
                            </div>
                            <p className="text-xs font-mono font-bold text-slate-300">{it.trxID || "-"}</p>
                         </div>
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                  <Smartphone className="w-4 h-4 text-slate-500" />
                                </div>
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Terminal</p>
                            </div>
                            <p className="text-xs font-black text-slate-300">{it.deviceName || "-"}</p>
                         </div>
                         <div className="bg-black/30 p-4 rounded-2xl">
                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2">Message Payload</p>
                            <p className="text-xs font-bold text-slate-400 italic leading-relaxed break-all">"{it.fullMessage || "-"}"</p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-8 border-t border-white/5 flex-col sm:flex-row gap-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest order-2 sm:order-1">
                Sequence <span className="text-white">{(page-1)*limit + 1}</span> to <span className="text-white">{Math.min(page*limit, total)}</span> of <span className="text-white">{total}</span>
              </p>
              
              <div className="flex items-center gap-3 order-1 sm:order-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-2">
                   {[...Array(Math.min(5, totalPages))].map((_, i) => {
                     const p = i + 1;
                     return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-10 h-10 rounded-xl text-xs font-black tracking-widest transition-all ${
                          page === p ? "bg-white text-black shadow-lg" : "bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                     );
                   })}
                </div>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        ::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

const Loader2 = ({ className }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

