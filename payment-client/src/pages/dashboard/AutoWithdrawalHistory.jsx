import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, History, ArrowUpRight, UploadCloud, Play, Copy, TrendingUp, DollarSign, ArrowUp, Sparkles, ShieldCheck, Layers, ExternalLink, ChevronRight } from 'lucide-react';

function CountdownTimer({ bookedAt }) {
  const [timeLeft, setTimeLeft] = React.useState('');

  React.useEffect(() => {
    if (!bookedAt) return;
    const expiry = new Date(bookedAt).getTime() + 10 * 60 * 1000;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bookedAt]);

  return <>{timeLeft || '10:00'}</>;
}

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
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  
  const [loading, setLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copyState, setCopyState] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [proofFiles, setProofFiles] = useState([]);
  const fileInputRef = useRef(null);

  const commRate = user?.autoWithdrawalCommissionRate || 0;

  async function loadData() {
    setLoading(true);
    try {
      const [historyRes, pendingRes] = await Promise.all([
        api.getAutoWithdrawalHistory(token).catch(() => ({ data: [] })),
        api.getPendingAutoWithdrawals(token).catch(() => ({ pending: [], active: null }))
      ]);
      
      setHistoryItems(historyRes?.data || []);
      
      const pendingData = pendingRes?.pending || [];
      const activeData = pendingRes?.active || null;
      
      setActiveBooking(activeData);
      setPendingItems(pendingData);
      setProofFiles([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleBook = async (id) => {
    if (activeBooking) {
      alert("You already have an active booking! Complete it first.");
      return;
    }
    try {
      await api.bookAutoWithdrawal(token, id);
      alert("Withdrawal request booked successfully!");
      loadData();
    } catch (err) {
      alert(err.message || "Failed to book");
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("State reason for releasing/cancelling this booking:");
    if (reason === null) return;
    if (reason.trim() === "") {
      alert("A reason is required to cancel.");
      return;
    }
    
    setUploading(true);
    try {
      await api.rejectAutoWithdrawal(token, id, reason);
      setActiveBooking(null);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel request');
    } finally {
      setUploading(false);
    }
  };

  const handleComplete = async () => {
    if (!activeBooking) return;
    if (proofFiles.length === 0) {
      alert("Please upload at least one proof screenshot.");
      return;
    }
    setUploading(true);
    try {
      await api.completeAutoWithdrawal(token, activeBooking._id, proofFiles);
      alert("Transfer completed and proof submitted!");
      api.me(token).then(updatedUser => {
        if (updatedUser) useAuthStore.getState().setUser(updatedUser);
      }).catch(console.warn);
      loadData();
    } catch (e) {
      alert(e.message || "Failed to complete transfer");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 5);
      setProofFiles(prev => [...prev, ...filesArray].slice(0, 5));
    }
  };

  const removeProofFile = (index) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': 
        return <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"><Clock className="w-3.5 h-3.5 animate-spin" /> Pending</span>;
      case 'booked': 
        return <span className="bg-sky-500/10 text-sky-600 border border-sky-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"><Play className="w-3.5 h-3.5" /> Booked</span>;
      case 'completed': 
        return <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"><CheckCircle className="w-3.5 h-3.5" /> Completed</span>;
      case 'rejected': 
        return <span className="bg-rose-500/10 text-rose-600 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"><XCircle className="w-3.5 h-3.5" /> Rejected</span>;
      case 'failed': 
        return <span className="bg-red-500/10 text-red-600 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"><AlertCircle className="w-3.5 h-3.5" /> Failed</span>;
      default: 
        return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold uppercase">{status}</span>;
    }
  };

  const filteredHistoryItems = historyItems.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (item._id && item._id.toLowerCase().includes(q)) ||
      (item.userIdentityAddress && item.userIdentityAddress.toLowerCase().includes(q)) ||
      (item.accountNumber && item.accountNumber.toLowerCase().includes(q)) ||
      (item.paymentMethod && item.paymentMethod.toLowerCase().includes(q))
    );
  });

  const completedItems = historyItems.filter(i => i.status === 'completed');
  const calculatedProfitSum = completedItems
    .reduce((sum, i) => sum + (i.agentCommissionAmount ?? ((i.amount * commRate) / 100)), 0);
  const totalCompletedProfit = (user?.autoWithdrawalCommission || 0) + (user?.autoWithdrawalBonus || 0) || calculatedProfitSum;
  const totalCompletedVolume = completedItems
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-3 sm:p-6 md:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Top Premium Header Card */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 p-6 sm:p-8 text-white shadow-2xl border border-indigo-500/30 backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold backdrop-blur-md mb-3">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" /> Auto Withdrawal Terminal
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <History className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
                উইথড্রয়াল হিস্ট্রি ও কমিশন রিপোর্ট
              </h1>
              <p className="text-slate-300 font-medium text-xs sm:text-sm mt-2 max-w-xl">
                আপনার সম্পন্ন করা সমস্ত স্বয়ংক্রিয় ক্যাশ-আউট ট্রানজেকশন এবং অ্যারো দিয়ে চিহ্নিত যুক্তকৃত কমিশনের রিয়েল-টাইম তালিকা।
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input 
                  type="text"
                  placeholder="Search ID, Account..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-xs sm:text-sm font-medium backdrop-blur-md transition-all shadow-inner"
                />
              </div>
              <button 
                onClick={loadData}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-indigo-900/50 transition-all border border-indigo-400/30 active:scale-95 whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> রিফ্রেশ
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Analytics Stat Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Main Profit Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900/90 via-teal-900/90 to-slate-900/90 text-white p-6 shadow-2xl border border-emerald-500/40 group hover:border-emerald-400/60 transition-all backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> মোট অর্জিত উইথড্রয়াল কমিশন
                </p>
                <h2 className="text-2xl sm:text-3xl font-black font-mono mt-3 text-white tracking-tight drop-shadow-md">
                  ৳{totalCompletedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-300 backdrop-blur-sm">
                  <span>কমিশন রেট:</span>
                  <span className="text-white font-mono text-xs">{commRate}%</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner group-hover:rotate-12 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Total Processed Volume Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-purple-950/90 text-white p-6 shadow-2xl border border-indigo-500/40 group hover:border-indigo-400/60 transition-all backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-400" /> মোট ক্যাশ-আউট ভলিউম
                </p>
                <h2 className="text-2xl sm:text-3xl font-black font-mono mt-3 text-white tracking-tight drop-shadow-md">
                  ৳{totalCompletedVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <p className="text-xs text-indigo-300 font-bold mt-3 flex items-center gap-1">
                  সফলভাবে সম্পন্নকৃত ক্যাশ-আউট
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner group-hover:rotate-12 transition-transform">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Completed Count */}
          <div className="bg-slate-900/80 rounded-3xl p-6 shadow-xl border border-slate-800 backdrop-blur-xl flex items-center justify-between group hover:border-indigo-500/40 hover:shadow-2xl transition-all">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">সম্পন্ন উইথড্রয়াল সংখ্যা</p>
              <h2 className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
                {completedItems.length} <span className="text-base font-bold text-slate-400 font-sans">টি</span>
              </h2>
              <p className="text-xs text-emerald-400 font-bold mt-3 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> ১০০% সফল ট্রানজিশন
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          {/* Pending Queue Count */}
          <div className="bg-slate-900/80 rounded-3xl p-6 shadow-xl border border-slate-800 backdrop-blur-xl flex items-center justify-between group hover:border-amber-500/40 hover:shadow-2xl transition-all">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">পেন্ডিং ও অ্যাক্টিভ রিকোয়েস্ট</p>
              <h2 className="text-2xl sm:text-3xl font-black font-mono text-amber-400 mt-2">
                {pendingItems.length + (activeBooking ? 1 : 0)} <span className="text-base font-bold text-slate-400 font-sans">টি</span>
              </h2>
              <p className="text-xs text-amber-400 font-bold mt-3 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> তাত্ক্ষণিক সুযোগ
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {loading && historyItems.length === 0 && pendingItems.length === 0 && !activeBooking && (
          <div className="flex flex-col items-center justify-center py-24 text-indigo-600 bg-white rounded-3xl border border-slate-200 shadow-sm animate-pulse">
            <RefreshCw className="w-12 h-12 animate-spin mb-3 text-indigo-500" />
            <p className="font-bold text-slate-700 text-sm">ডেটা লোড করা হচ্ছে...</p>
          </div>
        )}

        {/* --- Active Booking Transfer Card --- */}
        {activeBooking && (
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 border-2 border-blue-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl text-white animate-in zoom-in-95 duration-300">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/15">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/30 border border-blue-400/40 text-blue-300 flex items-center justify-center shadow-inner">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">অ্যাক্টিভ ক্যাশ-আউট বুকিং</h2>
                  <p className="text-xs text-blue-200">পেমেন্ট সম্পন্ন করে স্ক্রিনশট সাবমিট করুন</p>
                </div>
              </div>
              
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-black tracking-wider uppercase shadow-inner backdrop-blur-md">
                <Clock className="w-4 h-4 text-rose-400 animate-spin" />
                <span>সময় বাকি: <CountdownTimer bookedAt={activeBooking.bookedAt} /></span>
              </div>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div className="bg-white/10 border border-white/15 p-5 rounded-2xl backdrop-blur-md">
                  <p className="text-xs text-blue-300 font-bold uppercase tracking-wider mb-1">Target Account Address</p>
                  <div className="font-mono text-xl sm:text-2xl text-white font-black">{activeBooking.userIdentityAddress}</div>
                  
                  {activeBooking.accountNumber && (
                    <div className="flex items-center justify-between gap-2 mt-3 bg-black/30 p-3 rounded-xl border border-white/10">
                      <div className="font-mono text-xs sm:text-sm text-emerald-400 font-bold">Acc: {activeBooking.accountNumber}</div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(activeBooking.accountNumber);
                          setCopyState('copied');
                          setTimeout(() => setCopyState(''), 2000);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all flex items-center gap-1.5 text-xs font-bold uppercase shadow"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copyState === 'copied' ? 'কপি হয়েছে!' : 'কপি করুন'}
                      </button>
                    </div>
                  )}
                  <div className="mt-3 inline-block px-3 py-1 bg-white/15 text-white rounded-lg text-xs font-bold uppercase border border-white/20">
                    {activeBooking.paymentMethod}
                  </div>
                </div>

                <div className="bg-white/10 border border-white/15 p-5 rounded-2xl backdrop-blur-md flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">পাঠাতে হবে</p>
                    <div className="text-3xl sm:text-4xl text-emerald-400 font-black font-mono">৳{activeBooking.amount?.toLocaleString()}</div>
                  </div>
                  <div className="text-right bg-emerald-500/20 border border-emerald-400/30 p-3 rounded-xl backdrop-blur-sm">
                    <p className="text-[11px] font-bold text-emerald-300 uppercase">কমিশন লাভ</p>
                    <p className="text-lg font-black font-mono text-emerald-300">
                      +৳{((activeBooking.amount * commRate) / 100).toFixed(2)} ({commRate}%)
                    </p>
                  </div>
                </div>
              </div>
              
              {/* File Upload Section */}
              <div className="bg-white/10 border border-white/15 p-5 rounded-2xl backdrop-blur-md flex flex-col justify-between">
                <div>
                  <p className="text-xs text-blue-200 font-bold uppercase tracking-wider mb-3">পেমেন্টের প্রমাণ (Proof Screenshot)</p>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2.5 py-4 border-2 border-dashed border-blue-300/40 rounded-xl text-white font-bold hover:bg-white/10 transition-all text-xs sm:text-sm bg-black/20"
                  >
                    <UploadCloud className="w-5 h-5 text-blue-400" /> স্ক্রিনশট ছবি সিলেক্ট করুন
                  </button>

                  {proofFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      {proofFiles.map((file, index) => (
                        <div key={index} className="relative group rounded-xl overflow-hidden border border-white/20 shadow-md">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="proof" 
                            className="w-16 h-16 object-cover"
                          />
                          <button
                            onClick={() => removeProofFile(index)}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 shadow hover:scale-110 transition-transform"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button 
                    onClick={() => handleReject(activeBooking._id)}
                    disabled={uploading}
                    className="px-4 py-3.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-xs sm:text-sm border border-rose-500/40"
                  >
                    <XCircle className="w-4 h-4" /> বাতিল করুন
                  </button>
                  <button 
                    onClick={handleComplete}
                    disabled={uploading}
                    className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-xs sm:text-sm uppercase tracking-wider active:scale-95"
                  >
                    {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    পেমেন্ট সম্পন্ন করুন (+৳{((activeBooking.amount * commRate) / 100).toFixed(2)})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Pending Available Requests Grid --- */}
        {!loading && pendingItems.length > 0 && (
          <div className="bg-slate-900/80 rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="px-6 py-4 border-b border-amber-500/20 bg-amber-500/10 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-black text-amber-300 flex items-center gap-2 text-base sm:text-lg">
                <Clock className="w-5 h-5 text-amber-400" /> উপলব্ধ ক্যাশ-আউট রিকোয়েস্ট ({pendingItems.length} টি)
              </h2>
              <span className="text-xs font-bold text-amber-200 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                ইন্সট্যান্ট ক্রেডিটে যুক্ত হবে
              </span>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {pendingItems.map((item) => {
                  const estProfit = (item.amount * commRate) / 100;
                  return (
                    <div key={item._id} className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800 shadow-lg hover:border-amber-500/50 transition-all flex flex-col justify-between group">
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-400/30">
                            {item.paymentMethod}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-400">ID: {item._id?.slice(-8)}</span>
                        </div>

                        <div className="my-4 text-center">
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">ক্যাশ-আউট পরিমাণ</p>
                          <p className="font-black text-3xl sm:text-4xl text-white tracking-tight font-mono">৳{item.amount?.toLocaleString()}</p>
                        </div>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center my-3">
                          <span className="text-xs font-bold text-emerald-300">উইথড্রয়াল কমিশন লাভ: </span>
                          <span className="text-sm font-black text-emerald-400 font-mono">+৳{estProfit.toFixed(2)} ({commRate}%)</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleBook(item._id)}
                        disabled={!!activeBooking}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all text-xs sm:text-sm uppercase tracking-wider flex justify-center items-center gap-2 mt-2 active:scale-95"
                      >
                        একসেপ্ট করুন (+৳{estProfit.toFixed(2)}) <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- History Table / Grid Section --- */}
        <div className="bg-slate-900/80 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden backdrop-blur-xl">
          <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-2">
             <h2 className="font-black text-white flex items-center gap-2 text-base sm:text-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> অটো উইথড্রয়াল ইতিহাস (Past History)
             </h2>
             <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
               মোট {filteredHistoryItems.length} টি রেকর্ড
             </span>
          </div>
          
          {historyItems.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <History className="w-12 h-12 mb-3 opacity-30 text-slate-400" />
              <p className="font-bold text-slate-400 text-sm">কোনো হিস্ট্রি পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHistoryItems.map((item) => {
                  const profit = item.agentCommissionAmount ?? ((item.amount * commRate) / 100);

                  return (
                    <div key={item._id} className="bg-slate-950/70 rounded-2xl p-5 border border-slate-800 shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between group">
                      <div>
                        {/* Card Header */}
                        <div className="flex justify-between items-start mb-3 border-b border-slate-800/80 pb-3 gap-2">
                          <div>
                            <div className="text-xs text-slate-300 font-bold">{new Date(item.createdAt).toLocaleString()}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {item._id}</div>
                          </div>
                          <div>
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                        
                        {/* Target & Amount */}
                        <div className="flex justify-between items-baseline mb-3 bg-black/40 p-3.5 rounded-xl border border-white/5">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">মেথড: {item.paymentMethod}</p>
                            <p className="font-mono font-black text-white text-xs sm:text-sm mt-0.5">{item.userIdentityAddress}</p>
                            {item.accountNumber && (
                              <p className="font-mono font-bold text-slate-400 text-xs mt-0.5">Acc: {item.accountNumber}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">পরিমাণ</p>
                            <p className="font-black text-xl sm:text-2xl text-white font-mono">৳{item.amount?.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Proof / Details */}
                        <div className="bg-black/30 rounded-xl p-3 border border-white/5 mb-3">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">প্রমাণ / ছবি</p>
                          {item.status === 'completed' && item.proofImages && item.proofImages.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {item.proofImages.map((img, i) => (
                                <a 
                                  key={i} 
                                  href={getProofImageUrl(img)} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="block w-12 h-12 rounded-lg border border-slate-700 overflow-hidden hover:border-indigo-400 hover:scale-105 transition-all shadow-md"
                                >
                                  <img src={getProofImageUrl(img)} alt="Proof" className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          ) : item.status === 'rejected' && item.rejectReason ? (
                            <div className="text-xs text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 font-medium">
                              <span className="font-bold">বাতিলের কারণ:</span> {item.rejectReason}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">কোনো অতিরিক্ত তথ্য নেই</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Commission Profit Footer with Upward Arrow */}
                      {item.status === 'completed' && (
                        <div className="pt-3 border-t border-emerald-500/30 flex justify-between items-center bg-gradient-to-r from-emerald-950/60 to-teal-950/60 -mx-5 -mb-5 p-4 rounded-b-2xl">
                          <div>
                            <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">কমিশন লাভ</span>
                            <span className="text-xs text-emerald-400 font-bold font-mono">+৳{profit.toFixed(2)} ({commRate}%)</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-300 font-black bg-emerald-500/20 px-3 py-1.5 rounded-xl text-xs shadow-sm border border-emerald-500/40 backdrop-blur-sm">
                            <ArrowUp className="w-4 h-4 text-emerald-400 stroke-[3]" /> ৳{profit.toFixed(2)} কমিশনে জমা
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
