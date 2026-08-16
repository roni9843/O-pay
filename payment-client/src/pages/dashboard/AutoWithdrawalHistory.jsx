import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, History, ArrowDown, UploadCloud, Play, Copy } from 'lucide-react';

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

  return <>{timeLeft || '10:00'} Min</>;
}

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
    } catch (e) {
      alert(e.message || "Failed to book request");
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Please enter a reason for cancelling this transfer:");
    if (reason === null) return; // User cancelled prompt
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
      loadData();
    } catch (e) {
      alert(e.message || "Failed to complete transfer");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 5); // Max 5 files
      setProofFiles(prev => [...prev, ...filesArray].slice(0, 5));
    }
  };

  const removeProofFile = (index) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold uppercase">Pending</span>;
      case 'booked': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">Booked</span>;
      case 'completed': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold uppercase">Completed</span>;
      case 'rejected': return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold uppercase">Rejected</span>;
      case 'failed': return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold uppercase">Failed</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase">{status}</span>;
    }
  };

  const filteredHistoryItems = historyItems.filter(item => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = item._id && item._id.toLowerCase().includes(q);
      const matchUser = item.userIdentityAddress && item.userIdentityAddress.toLowerCase().includes(q);
      if (!matchId && !matchUser) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in zoom-in duration-500 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-emerald-500" />
            Auto Withdrawals Hub
          </h1>
          <p className="text-emerald-700/70 font-medium mt-1">Accept and manage automatic withdrawal requests</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <input 
            type="text"
            placeholder="Search History by ID or User..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white border border-emerald-100 text-emerald-900 focus:outline-none focus:border-emerald-400 text-sm w-full sm:w-64"
          />
          <button 
            onClick={loadData}
            className="flex items-center justify-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-colors border border-emerald-100 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {loading && historyItems.length === 0 && pendingItems.length === 0 && !activeBooking && (
        <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
          <RefreshCw className="w-10 h-10 animate-spin mb-4" />
          <p className="font-bold">Loading data...</p>
        </div>
      )}

      {/* Active Booking Section */}
      {activeBooking && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-6 shadow-xl relative overflow-hidden animate-in slide-in-from-top-4">
          <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 rounded-bl-xl font-bold text-xs uppercase shadow-sm">
            Action Required
          </div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-black text-blue-900 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-500" /> Active Transfer
            </h2>
            <span className="text-xs bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5 shadow-sm border border-red-200">
              <Clock className="w-3.5 h-3.5" />
              <CountdownTimer bookedAt={activeBooking.bookedAt} />
            </span>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <p className="text-xs text-blue-400 font-bold uppercase mb-1">Target Account</p>
                <div className="font-mono text-xl text-blue-900 font-black">{activeBooking.userIdentityAddress}</div>
                {activeBooking.accountNumber && (
                  <div className="flex items-center gap-2 mt-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                    <div className="font-mono text-sm text-blue-800 font-bold flex-1">Acc: {activeBooking.accountNumber}</div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(activeBooking.accountNumber);
                        setCopyState('copied');
                        setTimeout(() => setCopyState(''), 2000);
                      }}
                      className="p-1.5 hover:bg-blue-100 rounded-md transition-colors text-blue-600 flex items-center gap-1 text-xs font-bold uppercase"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copyState === 'copied' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
                <div className="mt-2 inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">{activeBooking.paymentMethod}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <p className="text-xs text-blue-400 font-bold uppercase mb-1">Amount to Transfer</p>
                <div className="text-3xl text-emerald-600 font-black">৳{activeBooking.amount?.toLocaleString()}</div>
              </div>
              {activeBooking.checkoutItems && activeBooking.checkoutItems.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-2">Checkout Items (References)</p>
                  <div className="space-y-1.5">
                    {activeBooking.checkoutItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 text-xs font-mono text-slate-600 bg-white p-2 rounded border border-slate-100">
                        {Object.entries(item).map(([k, v]) => (
                          <span key={k}><span className="font-bold text-slate-400">{k}:</span> {v}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs text-blue-400 font-bold uppercase mb-2">Upload Proof Screenshots</p>
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
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50 hover:border-blue-400 transition-colors"
                >
                  <UploadCloud className="w-5 h-5" /> Select Images
                </button>
                {proofFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {proofFiles.map((file, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden border border-blue-200 shadow-sm">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="proof" 
                          className="w-16 h-16 object-cover"
                        />
                        <button
                          onClick={() => removeProofFile(index)}
                          className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow transition-colors"
                          title="Remove image"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button 
                  onClick={() => handleReject(activeBooking._id)}
                  disabled={uploading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-200 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 w-full sm:w-auto"
                >
                  <XCircle className="w-4 h-4" /> Cancel & Release
                </button>
                <button 
                  onClick={handleComplete}
                  disabled={uploading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-md shadow-blue-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 w-full sm:w-auto"
                >
                  {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirm Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Requests Section */}
      {!loading && pendingItems.length > 0 && (
        <div className="bg-amber-50 rounded-3xl border border-amber-200 overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50">
            <h2 className="font-black text-amber-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" /> Pending Requests ({pendingItems.length})
            </h2>
          </div>
          <div className="p-4 sm:p-6 bg-amber-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingItems.map((item) => (
                <div key={item._id} className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:-translate-y-1">
                  <div className="mb-4 pt-4 flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-slate-400 font-bold uppercase mb-2">Transfer Amount</p>
                    <p className="font-black text-5xl text-emerald-600 tracking-tighter">৳{item.amount?.toLocaleString()}</p>
                  </div>
                  <div className="mb-6 flex justify-center items-center">
                    <span className="bg-amber-100 text-amber-700 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                      {item.paymentMethod}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleBook(item._id)}
                    disabled={!!activeBooking}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-sm transition-colors text-sm uppercase tracking-wider flex justify-center items-center gap-2"
                  >
                    Accept Transfer
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-emerald-100">
           <h2 className="font-black text-emerald-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" /> Past History
           </h2>
        </div>
        
        {historyItems.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <History className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-bold">No history found</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredHistoryItems.map((item) => (
                <div key={item._id} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:border-emerald-300 transition-colors flex flex-col justify-between hover:shadow-md">
                  <div>
                    <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                      <div>
                        <div className="text-xs text-slate-500 font-bold">{new Date(item.createdAt).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {item._id}</div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Target ({item.paymentMethod})</p>
                        <p className="font-mono font-black text-slate-700">{item.userIdentityAddress}</p>
                        {item.accountNumber && (
                          <p className="font-mono font-bold text-slate-600 text-sm mt-0.5">Acc: {item.accountNumber}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Amount</p>
                        <p className="font-black text-2xl text-emerald-600 tracking-tight">৳{item.amount?.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Details / Proofs</p>
                      {item.status === 'completed' && item.proofImages && item.proofImages.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {item.proofImages.map((img, i) => (
                            <a key={i} href={img.startsWith('http') ? img : `http://localhost:5000${img}`} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg border border-slate-200 overflow-hidden hover:border-emerald-500 transition-all shadow-sm hover:scale-105">
                              <img src={img.startsWith('http') ? img : `http://localhost:5000${img}`} alt="Proof" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {item.status === 'rejected' && item.rejectReason && (
                        <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-medium">
                          <span className="font-bold">Reason:</span> {item.rejectReason}
                        </div>
                      )}
                      {item.status === 'pending' && <span className="text-xs text-slate-400 italic">Waiting for an agent...</span>}
                      {item.status === 'booked' && <span className="text-xs text-slate-400 italic">In progress...</span>}
                    </div>
                  </div>
                  
                  {item.status === 'completed' && (
                    <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-center mt-auto">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Earned Credit</span>
                      <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-md text-xs border border-emerald-100">
                        <ArrowDown className="w-3 h-3" /> ৳{item.amount}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
