import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { RefreshCw, Copy, Timer, Calendar, Globe, CheckCircle, Zap, X, ShieldCheck } from 'lucide-react';

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function YourPlan() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);
  const [countdowns, setCountdowns] = useState({});
  const [selectedRenew, setSelectedRenew] = useState(null); // { sub, plan }

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsData, plansData] = await Promise.all([
        api.getMySubscriptions(token),
        api.getSubscriptionPlans()
      ]);
      setSubs(subsData || []);
      setPlans(plansData || []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  // Live Countdown
  const updateCountdown = useCallback(() => {
    const newCountdowns = {};
    subs.forEach((s) => {
      const end = new Date(s.endDate);
      const now = new Date();
      const diff = end - now;
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        newCountdowns[s._id] = { days, hours, minutes };
      } else {
        newCountdowns[s._id] = { days: 0, hours: 0, minutes: 0 };
      }
    });
    setCountdowns(newCountdowns);
  }, [subs]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getPlanColor = (color) => {
    const colors = {
      green: "from-emerald-500 to-teal-600",
      blue: "from-blue-500 to-cyan-600",
      red: "from-rose-500 to-pink-600",
      purple: "from-purple-500 to-indigo-600",
    };
    return colors[color?.toLowerCase()] || "from-gray-500 to-gray-600";
  };

  // Renewal Modal Component
  const RenewModal = () => {
    if (!selectedRenew) return null;
    const { sub, plan } = selectedRenew;

    const options = [
      { m: 1, label: "Monthly", price: plan.pricing.monthly, save: 0 },
      { m: 6, label: "6 Months", price: plan.pricing.sixMonths?.price ?? 0, save: plan.pricing.sixMonths?.save ?? 0 },
      { m: 12, label: "1 Year", price: plan.pricing.yearly?.price ?? 0, save: plan.pricing.yearly?.save ?? 0, best: true },
    ].filter(opt => opt.price > 0);

    const [selectedOption, setSelectedOption] = useState(options[0]);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    const [message, setMessage] = useState(null);

    const handleRenew = async () => {
      setLoadingPurchase(true);
      setMessage(null);
      try {
        const payload = { 
          planId: plan._id, 
          durationMonths: selectedOption.m,
          domain: sub.domains?.[0] || '' // Use existing domain if any
        };
        const res = await api.purchaseSubscription(token, payload);
        setMessage({ type: 'success', text: res.message || 'Renewed successfully!' });
        if (res.user) setUser(res.user);
        setTimeout(() => {
          setSelectedRenew(null);
          fetchData();
        }, 1500);
      } catch (err) {
        setMessage({ type: 'error', text: err.message || 'Renewal failed' });
      } finally {
        setLoadingPurchase(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedRenew(null)}>
        <div className="relative w-full max-w-md my-auto" onClick={e => e.stopPropagation()}>
          <div className={`absolute -inset-1 bg-gradient-to-r ${getPlanColor(plan.color)} rounded-[2rem] blur-xl opacity-50`}></div>
          <div className="relative bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className={`bg-gradient-to-r ${getPlanColor(plan.color)} p-6 text-center relative`}>
              <button onClick={() => setSelectedRenew(null)} className="absolute top-4 right-4 text-white/60 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
              <Zap className="w-10 h-10 text-white mx-auto mb-2 drop-shadow-lg" />
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Renew {plan.name}</h3>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Extend your access instantly</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Info Column */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Current Domain</span>
                  <span className="text-emerald-400 font-mono italic">{sub.domains?.[0] || 'Wallet Agent'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Current Status</span>
                  <span className={sub.active ? 'text-blue-400' : 'text-rose-400'}>{sub.active ? 'Active' : 'Expired'}</span>
                </div>
              </div>

              {/* Billing Cycle Options */}
              <div className="grid gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.m}
                    onClick={() => setSelectedOption(opt)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center relative group
                      ${selectedOption.m === opt.m
                        ? "border-violet-500 bg-violet-600/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                        : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      }`}
                  >
                    <div>
                      <span className={`block font-black text-sm uppercase tracking-wide ${selectedOption.m === opt.m ? 'text-violet-400' : 'text-slate-300'}`}>
                        {opt.label}
                      </span>
                      {opt.save > 0 && (
                        <span className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter">
                          Save ৳{opt.save}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white">৳{opt.price}</div>
                      {opt.m > 1 && <div className="text-[10px] text-slate-500 font-bold">৳{Math.round(opt.price / opt.m)}/mo</div>}
                    </div>
                    {opt.best && (
                      <span className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[9px] px-3 py-1 rounded-full font-black shadow-lg">
                        POPULAR
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              <button
                onClick={handleRenew}
                disabled={loadingPurchase}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2
                  ${loadingPurchase ? 'bg-slate-700 text-slate-400' : `bg-gradient-to-r ${getPlanColor(plan.color)} text-white hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20`}
                `}
              >
                {loadingPurchase ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                  <><ShieldCheck className="w-5 h-5" /> Confirm Renewal</>
                )}
              </button>

              {message && (
                <div className={`p-4 rounded-xl text-xs font-bold text-center animate-in zoom-in-95 ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <X className="w-10 h-10 text-white" />
          </div>
          <p className="text-xl font-bold text-white">Please login to view subscriptions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f111a] p-4 md:p-8 text-white font-sans selection:bg-violet-500/30">
      {/* Background Glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header Section */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black bg-gradient-to-r from-white via-violet-200 to-slate-400 bg-clip-text text-transparent tracking-tighter">
              Subscription Management
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1 flex items-center gap-2">
              <span className="w-8 h-px bg-violet-600"></span>
              Your active license records
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="group relative flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-violet-400 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="text-xs font-black uppercase tracking-widest text-slate-200">Sync Status</span>
          </button>
        </section>

        {/* Status Messages */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-4">
            <X className="w-5 h-5" /> {error}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 rounded-[2.5rem] bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && subs.length === 0 && (
          <div className="py-20 text-center space-y-6">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full" />
              <div className="relative w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center">
                <Globe className="w-10 h-10 text-slate-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">No active licenses found</h3>
              <p className="text-slate-500 text-sm">Purchase a package to unlock premium tools.</p>
            </div>
          </div>
        )}

        {/* Subscription Grid */}
        {!loading && !error && subs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {subs.map((s) => {
              const cd = countdowns[s._id] || { days: 0, hours: 0, minutes: 0 };
              const isExpiring = s.active && cd.days === 0 && cd.hours < 72; // Warn 3 days before
              const planGradient = getPlanColor(s.plan?.color);
              const relatedPlan = plans.find(p => p._id === s.planId || p.name === s.plan?.name);

              return (
                <div
                  key={s._id}
                  className="group relative rounded-[2.5rem] bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 hover:border-white/20 transition-all duration-500 flex flex-col p-2 shadow-2xl"
                >
                  {/* Glass Card Internal */}
                  <div className="bg-[#1a1c29]/80 backdrop-blur-3xl rounded-[2.2rem] h-full flex flex-col p-6 space-y-6 relative overflow-hidden">
                    
                    {/* Header: Plan & Status */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r ${planGradient} shadow-lg shadow-black/20`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {s.plan?.name || "Premium Plan"}
                        </div>
                        <h4 className="text-2xl font-black text-white pl-1">৳{s.purchasePrice || s.plan?.pricing?.monthly}</h4>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${s.active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        {s.active ? 'Active' : 'Expired'}
                      </div>
                    </div>

                    {/* Timeline Info */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px]">
                        <div className="space-y-1">
                          <span className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Issued On
                          </span>
                          <span className="text-white font-mono">{formatDate(s.startDate)}</span>
                        </div>
                        <div className="space-y-1 text-right">
                          <span className="text-slate-500 font-bold uppercase tracking-widest flex items-center justify-end gap-1">
                            Valid Until <Calendar className="w-3 h-3" />
                          </span>
                          <span className="text-white font-mono">{formatDate(s.endDate)}</span>
                        </div>
                      </div>

                      {/* Progress/Countdown Bar */}
                      <div className={`p-4 rounded-2xl relative overflow-hidden group/timer ${isExpiring ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-white/5 border border-white/10'}`}>
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2">
                            <Timer className={`w-4 h-4 ${isExpiring ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time Remaining</span>
                          </div>
                          <div className="flex gap-2 text-sm font-black text-white font-mono">
                            {cd.days > 0 && <span>{cd.days}D</span>}
                            <span>{cd.hours}H</span>
                            <span>{cd.minutes}M</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Domains Section */}
                    {s.domains?.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <Globe className="w-3.5 h-3.5 text-violet-400" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Linked Domain</span>
                        </div>
                        <div className="group/domain relative flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 hover:border-violet-500/30 transition-all">
                          <span className="text-xs font-mono text-slate-300 truncate pr-4">{s.domains[0]}</span>
                          <button 
                            onClick={() => copyToClipboard(s.domains[0])}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all shadow-sm"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Area */}
                    <div className="pt-4 mt-auto">
                      <button 
                        onClick={() => setSelectedRenew({ sub: s, plan: relatedPlan || s.plan })}
                        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl
                          ${!s.active || isExpiring 
                            ? `bg-gradient-to-r ${planGradient} text-white hover:scale-[1.02] shadow-emerald-500/20` 
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                          }
                        `}
                      >
                        <Zap className={`w-3.5 h-3.5 ${!s.active || isExpiring ? 'fill-current' : ''}`} />
                        {!s.active ? 'Renew Subscription' : isExpiring ? 'Renew Early' : 'Renew Plan'}
                      </button>
                    </div>

                    {/* Decorative Element */}
                    <div className={`absolute -bottom-10 -right-10 w-24 h-24 bg-gradient-to-br ${planGradient} blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RenewModal />
    </div>
  );
}
