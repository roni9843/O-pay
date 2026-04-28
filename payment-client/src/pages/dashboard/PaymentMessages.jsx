import React, { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { getPaymentMessages, getMyPaymentMethods } from "../../lib/api";
import { Filter, Search, MessageSquare, Calendar, Hash, CheckCircle, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Smartphone, Bell, Eye } from "lucide-react";

const PROVIDER_LOGOS = {
  bkash: "https://www.logo.wine/a/logo/BKash/BKash-bKash-Logo.wine.svg",
  nagad: "https://www.logo.wine/a/logo/Nagad/Nagad-Logo.wine.svg",
  rocket: "https://images.seeklogo.com/logo-png/31/1/dutch-bangla-rocket-logo-png_seeklogo-317692.png",
  upay: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDQKuSFxbB73PIy0QStMx3BBkf1-rGVAz74Q&s",
};

export default function PaymentMessages() {
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [methods, setMethods] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [expandedId, setExpandedId] = useState(null);

  const [provider, setProvider] = useState("all");
  const [search, setSearch] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = useMemo(() => {
    const p = { page, limit };
    if (provider && provider !== "all") p.provider = provider;
    if (search) p.search = search;
    if (min) p.min = min;
    if (max) p.max = max;
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [page, limit, provider, search, min, max, from, to]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [msgRes, methRes] = await Promise.all([
        getPaymentMessages(token, params),
        getMyPaymentMethods(token)
      ]);
      setItems(msgRes.data || []);
      setTotal(msgRes.total || 0);
      setMethods(methRes.data || []);
    } catch (e) {
      setError(e?.message || "Failed to load messages");
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
  }

  function resetFilters() {
    setProvider("all"); setSearch(""); setMin(""); setMax(""); setFrom(""); setTo(""); setPage(1);
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Helper to format BD time
  const formatBDTime = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      timeZone: "Asia/Dhaka",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // Helper to determine Source (SMS vs Notification)
  const getSourceType = (item) => {
    // If 'from' is present and seems like a shortcode/number, it's SMS.
    // If 'from' is null/unknown, or typically for notifications it might be 'System' or empty?
    // We assume if 'from' has value, it's SMS. If 'from' is 'null' string (from model default) or empty, it's Notification.
    // Model default is "null".
    if (item.from && item.from !== "null" && item.from !== "unknown") {
      return "SMS";
    }
    return "Notification";
  };

  // Helper to find Account Type (Personal/Merchant) from loaded methods
  const getAccountType = (item) => {
    // If item.type is explicitly set by app, use it (fallback)
    // Try to find matching method
    // Match criteria: method.provider == item.title (lowercase check) AND method.device._id (or logic) matches item.deviceId
    // Note: item.deviceId is a string. method.device._id is string.
    
    if (!methods.length) return item.type && item.type !== 'unknown' ? item.type : "Personal"; // Default to Personal if unknown

    const providerName = (item.title || "").toLowerCase();
    
    const match = methods.find(m => {
      // Check provider match
      if (m.provider !== providerName && !providerName.includes(m.provider)) return false;
      
      // Check device match (try exact ID match first)
      // item.deviceId might be the device _id or deviceCode
      if (m.device && (m.device._id === item.deviceId || m.device.deviceCode === item.deviceId)) {
        return true;
      }
      return false;
    });

    if (match) {
      if (match.gateway === 'merchant') return "Agent";
      // capitalize first letter
      return match.gateway.charAt(0).toUpperCase() + match.gateway.slice(1);
    }

    // Fallback: Default to "Personal". Do NOT use item.type if it contains random strings like "sms"
    return "Personal";
  };

  return (
    <div className="min-h-screen bg-emerald-50 text-slate-800 p-4 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header - Clean & Simple */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-emerald-900 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-emerald-600" />
              Payment Messages
            </h1>
            <p className="text-emerald-600/80 mt-1">
              Raw transaction logs • <span className="font-semibold">{total}</span> total records
            </p>
          </div>
          <button 
            onClick={load} 
            className="p-2 rounded-full bg-white text-emerald-600 shadow hover:shadow-md transition-all hover:bg-emerald-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Filters - Accordion Style or Simple Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4 text-emerald-800 font-semibold">
            <Filter className="w-5 h-5" />
            <span>Filter Logs</span>
          </div>
          
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-emerald-700 ml-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-900 text-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Providers</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="upay">Upay</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-semibold text-emerald-700 ml-1">Search TrxID / Msg</label>
                <input
                  placeholder="Enter TrxID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-900 placeholder-emerald-400 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-xs font-semibold text-emerald-700 ml-1">Min Amount</label>
                 <input
                  type="number"
                  placeholder="0.00"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-900 placeholder-emerald-400 text-sm"
                />
              </div>
              
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-semibold text-emerald-700 ml-1">Max Amount</label>
                 <input
                  type="number"
                  placeholder="∞"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-900 placeholder-emerald-400 text-sm"
                />
              </div>

               <div className="flex flex-col gap-1">
                 <label className="text-xs font-semibold text-emerald-700 ml-1">Start Date</label>
                 <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-900 placeholder-emerald-400 text-sm"
                />
               </div>

          <div className="flex justify-end gap-3 mt-4">
            <button 
              onClick={resetFilters} 
              className="px-4 py-2 rounded-lg text-emerald-600 hover:bg-emerald-50 text-sm font-medium transition-colors"
            >
              Reset
            </button>
            <button 
              onClick={resetAndSearch} 
              className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Apply
            </button>
          </div>
        </div>

        {/* Data List - Simple Card/Table Hybrid */}
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="text-center py-12 text-emerald-600/60 animate-pulse">
              Loading transactions...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-emerald-200 text-emerald-600/60">
              No messages found matching your criteria.
            </div>
          ) : (
            items.map((item) => {
              const providerLower = (item.title || "").toLowerCase();
              let logoUrl = null;
              if (providerLower.includes("bkash")) logoUrl = PROVIDER_LOGOS.bkash;
              else if (providerLower.includes("nagad")) logoUrl = PROVIDER_LOGOS.nagad;
              else if (providerLower.includes("rocket")) logoUrl = PROVIDER_LOGOS.rocket;
              else if (providerLower.includes("upay")) logoUrl = PROVIDER_LOGOS.upay;

              const sourceType = getSourceType(item);
              const accountType = getAccountType(item);

              return (
                <div 
                  key={item._id} 
                  className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
                    expandedId === item._id 
                      ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20' 
                      : 'border-emerald-100 hover:border-emerald-300 hover:shadow-sm'
                  }`}
                >
                  {/* Main Row - Clickable */}
                  <div 
                    onClick={() => toggleExpand(item._id)}
                    className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Logo or Icon */}
                      <div className="shrink-0 flex flex-col items-center gap-1">
                         {logoUrl ? (
                           <img src={logoUrl} alt={item.title} className="w-10 h-10 object-contain" />
                         ) : (
                           <div className={`p-2.5 rounded-full ${
                            item.verify ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                           }`}>
                             {item.verify ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                           </div>
                         )}
                         {/* SMS/Notification indicator hidden as per user request */}
                      </div>

                      <div>
                        <div className="flex flex-col mb-1">
                          <span className="font-bold text-slate-700 text-base">{item.title || "Unknown"}</span>
                          {/* Account Type (Personal/Merchant) */}
                          <span className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded-md self-start mt-0.5">
                            {accountType}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3" />
                          {formatBDTime(item.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0">
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-700">
                          ৳{Number(item.amount).toFixed(2)}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                           <div className={`w-1.5 h-1.5 rounded-full ${item.verify ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                           <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                             {item.verify ? 'Verified' : 'Unverified'}
                           </span>
                        </div>
                      </div>
                      <div className="text-emerald-300 transform transition-transform duration-200">
                        {expandedId === item._id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === item._id && (
                    <div className="bg-emerald-50/50 border-t border-emerald-100 p-4 sm:p-6 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Full Message */}
                        <div className="md:col-span-2">
                          <h4 className="text-xs font-bold uppercase text-emerald-800 tracking-wider mb-2 flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" /> Raw Message Content
                          </h4>
                          <div className="bg-white p-3 rounded-lg border border-emerald-100 text-sm text-slate-600 font-mono leading-relaxed whitespace-pre-wrap shadow-sm">
                            {item.fullMessage || "No message content available."}
                          </div>
                        </div>

                        {/* Technical Details */}
                        <div>
                          <h4 className="text-xs font-bold uppercase text-emerald-800 tracking-wider mb-2 flex items-center gap-2">
                             <Hash className="w-3 h-3" /> Device Info
                          </h4>
                          <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-2 text-sm shadow-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Device Name:</span>
                              <span className="font-medium text-slate-700">{item.deviceName || "Unknown"}</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-slate-500">Device ID:</span>
                               <span className="font-mono text-xs text-slate-600 bg-slate-50 px-1 rounded">{item.deviceId}</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-slate-500">Sender:</span>
                               <span className="font-medium text-slate-700">{item.from || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">TRX ID:</span>
                                <span className="font-mono text-xs text-emerald-600">{item.trxID || "—"}</span>
                             </div>
                          </div>
                        </div>

                        {/* Verification Status */}
                        <div>
                          <h4 className="text-xs font-bold uppercase text-emerald-800 tracking-wider mb-2 flex items-center gap-2">
                             <CheckCircle className="w-3 h-3" /> System Status
                          </h4>
                          <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-2 text-sm shadow-sm">
                             <div className="flex justify-between">
                               <span className="text-slate-500">Status:</span>
                               <span className={`font-bold ${item.verify ? 'text-emerald-600' : 'text-amber-500'}`}>
                                 {item.verify ? "Verified Transaction" : "Unverified / Pending"}
                               </span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-slate-500">BD Time:</span>
                               <span className="text-slate-700">{formatBDTime(item.createdAt)}</span>
                             </div>
                             
                             {/* Footprint Button if verified and linked to session */}
                             {item.paymentSession && item.paymentSession.footprintUrlNonMask && (
                               <div className="mt-2 pt-2 border-t border-slate-100">
                                 <a 
                                   href={item.paymentSession.footprintUrlNonMask} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="flex items-center justify-center gap-2 w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-xs font-semibold transition"
                                 >
                                   <Eye className="w-3.5 h-3.5" /> View Footprint
                                 </a>
                               </div>
                             )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination - Simple */}
        {items.length > 0 && (
          <div className="flex justify-center items-center gap-4 mt-8 pb-8">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-emerald-800">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
            >
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
