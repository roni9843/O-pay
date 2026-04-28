import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getOpayBusiness, listOpayBusinesses, getOpayBusinessPaymentHistory, getOpayBusinessDashboardOverview } from '../lib/api';
import { 
  ArrowLeft, Clock, Loader2, Globe2, Mail, Link2, ExternalLink, 
  ChevronDown, ChevronUp, Code2, Play, CalendarClock, TrendingUp,
  RefreshCw, CheckCircle2, XCircle
} from 'lucide-react';

export default function OpayBusinessHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);

  const [business, setBusiness] = useState(location.state?.business || null);
  const [loadingBusiness, setLoadingBusiness] = useState(!business);
  const [businessError, setBusinessError] = useState('');

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedCode, setExpandedCode] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const loadBusiness = async () => {
    if (!token || !id) return;
    if (business) return;
    setLoadingBusiness(true);
    setBusinessError('');
    try {
      const res = await getOpayBusiness(token, id);
      setBusiness(res.data);
    } catch (e) {
      try {
        const res = await listOpayBusinesses(token);
        const found = res.data.find((b) => b._id === id);
        if (found) setBusiness(found);
        else throw new Error('Business not found');
      } catch (err) {
        setBusinessError(err.message || 'Failed to load business');
      }
    } finally {
      setLoadingBusiness(false);
    }
  };

  const loadHistory = async () => {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const [historyRes, overviewRes] = await Promise.all([
        getOpayBusinessPaymentHistory(token, id, { page: 1, limit: 100 }),
        getOpayBusinessDashboardOverview(token, id)
      ]);

      if (historyRes.success) {
        setItems(historyRes.data);
        setSummary(historyRes.summary);
      }
      
      if (overviewRes.success) {
        setDaily(overviewRes.data.daily || []);
      }
    } catch (e) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!business) loadBusiness();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const maxAmount = Math.max(...daily.map(d => d.successAmount || 0), 1000);
  const maxCount = Math.max(...daily.map(d => d.totalGenerated || 0), 5);

  const getPoints = (data, key, max, height, width) => {
    if (!data.length) return '';
    return data.map((d, i) => {
      const x = i * (width / (data.length - 1));
      const y = height - ((d[key] || 0) / max) * height;
      return `${x},${y}`;
    }).join(' ');
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  const toggleExpand = (code) => {
    setExpandedCode(expandedCode === code ? null : code);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/opay-business/${id}`)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-violet-400" />
              Brand Performance Audit
            </h1>
            <p className="text-xs text-slate-500 font-medium">Monitoring {business?.name || 'Loading...'} transaction lifecycle.</p>
          </div>
        </div>

        <button
          onClick={loadHistory}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-violet-600/10 text-violet-400 text-xs font-black border border-violet-500/20 hover:bg-violet-600/20 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Audit
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest uppercase">Available Balance</p>
          <p className="mt-2 text-2xl font-black text-indigo-400">{summary ? (summary.availableBalance || 0).toLocaleString('en-BD') : '...'} <span className="text-[10px] text-indigo-600/60">BDT</span></p>
          <p className="mt-1 text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Funds ready to withdraw</p>
        </div>
        
        <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest uppercase">Total Revenue</p>
          <p className="mt-2 text-2xl font-black text-white">{summary ? (summary.successAmount || 0).toLocaleString('en-BD') : '...'} <span className="text-[10px] text-slate-500">BDT</span></p>
          <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lifetime success volume</p>
        </div>

        <div className="p-6 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest uppercase">Success Ratio</p>
          <p className="mt-2 text-2xl font-black text-emerald-400">{summary ? summary.successCount : '...'} <span className="text-[10px] text-emerald-600">Links</span></p>
          <p className="mt-1 text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Completed Payments</p>
        </div>

        <div className="p-6 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-3xl rounded-full" />
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest uppercase">Dropped/Pending</p>
          <p className="mt-2 text-2xl font-black text-rose-400">{summary ? (summary.unsuccessfulAmount || 0).toLocaleString('en-BD') : '...'} <span className="text-[10px] text-rose-600/60">BDT</span></p>
          <p className="mt-1 text-[10px] text-rose-600 font-bold uppercase tracking-widest">{summary ? summary.unsuccessfulCount : '...'} Failed Sessions</p>
        </div>
      </div>

      {/* Graph Section */}
      <div className="rounded-[2.5rem] bg-black/40 border border-white/5 p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/5 blur-[120px] rounded-full -mr-64 -mt-64" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Performance Trend (30 Days)
            </h2>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] opacity-50" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tx Count</span>
              </div>
            </div>
          </div>

          <div className="relative h-64 h-80-md">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-30"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>}
            
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 200">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="areaGradientCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Count Path */}
              <polyline
                points={getPoints(daily, 'totalGenerated', maxCount, 200, 1000)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-20"
              />

              {/* Amount Area */}
              <path
                d={`M 0,200 L ${getPoints(daily, 'successAmount', maxAmount, 200, 1000)} L 1000,200 Z`}
                fill="url(#areaGradient)"
              />
              <polyline
                points={getPoints(daily, 'successAmount', maxAmount, 200, 1000)}
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              />

              {/* Interactions */}
              {daily.map((d, i) => (
                <rect
                  key={i}
                  x={i * (1000 / (daily.length - 1)) - (1000 / (daily.length - 1)) / 2}
                  y="0"
                  width={1000 / (daily.length - 1)}
                  height="200"
                  fill="transparent"
                  className="cursor-crosshair pointer-events-auto"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}

              {hoveredIndex !== null && daily[hoveredIndex] && (
                <g>
                   <line x1={hoveredIndex * (1000 / (daily.length - 1))} y1="0" x2={hoveredIndex * (1000 / (daily.length - 1))} y2="200" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4" />
                   <circle cx={hoveredIndex * (1000 / (daily.length - 1))} cy={200 - ((daily[hoveredIndex].successAmount || 0) / maxAmount) * 200} r="6" fill="#10b981" stroke="#000" strokeWidth="2" />
                </g>
              )}
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && daily[hoveredIndex] && (
              <div 
                className="absolute z-50 bg-slate-900 border border-white/10 p-3 rounded-2xl shadow-2xl pointer-events-none"
                style={{ 
                  left: `${(hoveredIndex / (daily.length - 1)) * 100}%`,
                  top: '-40px',
                  transform: 'translateX(-50%)'
                }}
              >
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{daily[hoveredIndex].date}</p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-black text-emerald-400">{daily[hoveredIndex].successAmount.toLocaleString()} BDT</p>
                  <p className="text-[9px] font-bold text-slate-300">{daily[hoveredIndex].successCount} Success / {daily[hoveredIndex].totalGenerated} Total</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-[2rem] bg-[#111] border border-white/5 overflow-hidden shadow-2xl">
        <div className="px-8 py-6 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Audit Logs</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Detailed lifecycle of each session</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-black/40 border border-white/5 text-[10px] font-black text-slate-400">
            {items.length} Entries Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-white/5 text-slate-400 border-b border-white/5">
                <th className="px-8 py-4 font-black uppercase tracking-widest text-[9px]">Timestamp</th>
                <th className="px-8 py-4 font-black uppercase tracking-widest text-[9px]">Amount</th>
                <th className="px-8 py-4 font-black uppercase tracking-widest text-[9px]">Customer Identity</th>
                <th className="px-8 py-4 font-black uppercase tracking-widest text-[9px]">Invoice</th>
                <th className="px-8 py-4 font-black uppercase tracking-widest text-[9px]">Status</th>
                <th className="px-8 py-4 font-black uppercase tracking-widest text-[9px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((item) => (
                <React.Fragment key={item.code}>
                  <tr 
                    onClick={() => toggleExpand(item.code)}
                    className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${expandedCode === item.code ? 'bg-white/[0.04]' : ''}`}
                  >
                    <td className="px-8 py-5">
                      <div className="text-slate-200 font-bold">{formatDateTime(item.createdAt).split(',')[0]}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{formatDateTime(item.createdAt).split(',')[1]}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-white">{Number(item.amount).toLocaleString('en-BD')} <span className="text-[10px] text-slate-500">BDT</span></div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-slate-300 font-medium max-w-[150px] truncate" title={item.user_identity_address}>
                        {item.user_identity_address || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-slate-500 font-mono">
                      #{item.invoice_number?.slice(-8) || 'N/A'}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                        item.status === 'paid' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5' 
                          : item.status === 'cancelled' || item.status === 'expired'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5'
                      }`}>
                        {item.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {item.status === 'pending' ? 'Unsuccessful' : item.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {expandedCode === item.code ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors ml-auto" />}
                    </td>
                  </tr>

                  {/* Expandable Details */}
                  {expandedCode === item.code && (
                    <tr>
                      <td colSpan="6" className="p-0 bg-black/40">
                        <div className="p-10 border-b border-white/5 relative overflow-hidden">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                              <div className="space-y-6">
                                <div>
                                  <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                                    <Globe2 className="w-4 h-4 text-violet-400" /> Web Integrations
                                  </h4>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Callback Endpoint</p>
                                      <p className="text-[11px] text-slate-300 font-medium break-all bg-black/40 p-2 rounded-lg border border-white/5">{item.callbackUrl || 'No Endpoint Provided'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Success Redirect</p>
                                      <p className="text-[11px] text-slate-300 font-medium break-all bg-black/40 p-2 rounded-lg border border-white/5">{item.successRedirectUrl || 'No Redirect Provided'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                                  <Play className="w-4 h-4 text-emerald-400" /> Admin Capture Audit
                                </h4>
                                <div className="space-y-4">
                                  {item.footprintUrl ? (
                                    <a
                                      href={item.footprintUrl}
                                      target="_blank" rel="noreferrer"
                                      className="inline-flex items-center justify-center w-full gap-2 px-6 py-4 rounded-2xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                    >
                                      Play Masked Session
                                      <Play className="w-3 h-3 fill-current" />
                                    </a>
                                  ) : (
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-bold text-slate-600 text-center italic">No Masked Data</div>
                                  )}

                                  {item.footprintUrlNonMask && (
                                    <a
                                      href={item.footprintUrlNonMask}
                                      target="_blank" rel="noreferrer"
                                      className="inline-flex items-center justify-center w-full gap-2 px-6 py-4 rounded-2xl border border-white/10 text-white text-xs font-black hover:bg-white/5 transition-all"
                                    >
                                      View Non-Masked Original
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                                  <Code2 className="w-4 h-4 text-sky-400" /> Transaction Payload
                                </h4>
                                <div className="bg-[#050505] rounded-2xl border border-white/10 p-5 font-mono text-[10px] text-sky-200 overflow-auto max-h-[160px] shadow-inner custom-scrollbar">
                                  {item.checkoutItems ? (
                                    <pre className="whitespace-pre-wrap">{JSON.stringify(item.checkoutItems, null, 2)}</pre>
                                  ) : (
                                    <div className="italic text-slate-600 py-4 text-center">Empty Payload Context</div>
                                  )}
                                </div>
                              </div>
                           </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
