import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Users, Loader2, Building, Search, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';

export default function BankDetail() {
  const { id } = useParams();
  const { token } = useAuthStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [bank, setBank] = useState(null);
  
  const [agentAccounts, setAgentAccounts] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');

  const [editingAgentAccount, setEditingAgentAccount] = useState(null);
  const [agentForm, setAgentForm] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    branchName: '',
    division: '',
    district: '',
    upazilaThana: '',
    routingNumber: '',
    status: 'active',
    minAmount: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getBankList(token);
      if (res.success && res.data) {
        const foundBank = res.data.find(b => b._id === id);
        if (foundBank) {
          setBank(foundBank);
          fetchAgentAccounts(foundBank.name);
        } else {
          toast.error('Bank not found');
          navigate('/bank-management');
        }
      }
    } catch (err) {
      toast.error('Failed to load bank details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentAccounts = async (bankName) => {
    try {
      setAgentLoading(true);
      const res = await api.getAgentBankAccounts(token);
      if (res.success && res.data) {
        // Filter agents that belong to this specific bank
        const filtered = res.data.filter(acc => acc.bankName === bankName);
        setAgentAccounts(filtered);
      }
    } catch (err) {
      toast.error('Failed to load agent bank accounts');
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    if (token && id) {
      fetchData();
    }
  }, [token, id]);

  const handleEditAgentAccountClick = (acc) => {
    setEditingAgentAccount(acc);
    setAgentForm({
      bankName: acc.bankName || '',
      accountHolderName: acc.accountHolderName || '',
      accountNumber: acc.accountNumber || '',
      branchName: acc.branchName || '',
      division: acc.division || '',
      district: acc.district || '',
      upazilaThana: acc.upazilaThana || '',
      routingNumber: acc.routingNumber || '',
      status: acc.status || 'active',
      minAmount: acc.minAmount || 0
    });
  };

  const handleSaveAgentAccount = async (e) => {
    e.preventDefault();
    if (!editingAgentAccount) return;
    try {
      const res = await api.updateAgentBankAccount(token, editingAgentAccount._id, agentForm);
      if (res.success) {
        toast.success('Agent bank account updated!');
        setEditingAgentAccount(null);
        if (bank) fetchAgentAccounts(bank.name);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update agent account');
    }
  };

  const handleDeleteAgentAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this Agent bank account?')) return;
    try {
      const res = await api.deleteAgentBankAccount(token, accountId);
      if (res.success) {
        toast.success('Agent bank account deleted');
        if (bank) fetchAgentAccounts(bank.name);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete agent account');
    }
  };

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  if (loading || !bank) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ================= HEADER ================= */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl p-8 border border-white/5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6"
        style={{ background: `linear-gradient(135deg, ${bank.bgColor}30, ${bank.bgColor}10)` }}
      >
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/bank-management')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 shrink-0"
            style={{ backgroundColor: bank.bgColor || '#ffffff' }}
          >
             {bank.logo ? (
               <img src={formatImgUrl(bank.logo)} alt={bank.name} className="w-14 h-14 object-contain" />
             ) : (
               <Building className="w-10 h-10" style={{ color: bank.textColor || '#1e293b' }} />
             )}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">
               {bank.name}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-1 rounded-md border border-white/5">{bank.code || 'NO-CODE'}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider ${bank.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                 {bank.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
           <div className="bg-black/30 border border-white/5 p-4 rounded-2xl backdrop-blur-md text-center min-w-[140px]">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Wallet Agents</p>
              <p className="text-3xl font-bold text-white">{agentAccounts.length}</p>
           </div>
        </div>
      </motion.div>

      {/* ================= LIVE CLIENT PREVIEW ================= */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/5 border border-white/5 rounded-[24px] overflow-hidden backdrop-blur-xl shadow-lg p-8"
      >
        <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-6">
           <span className="text-indigo-400">📱</span> Live Client Preview
           <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">How users see it</span>
        </h3>
        
        <div className="bg-[#ececec] rounded-2xl p-8 shadow-inner border border-gray-200 flex flex-col items-center">
           {/* Mock Mobile Device Container */}
           <div className="w-full max-w-[360px] h-[720px] bg-white rounded-[40px] border-[8px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col font-sans">
              {/* Header */}
              <div className="bg-white border-b border-gray-100 p-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs">O</div>
                    <span className="font-bold text-gray-800 text-sm">Opay</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Session #88test20</span>
                    <span className="text-[10px] text-[#0EB78C] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0EB78C] animate-pulse"></span> Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Content Scrollable Area */}
              <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 flex flex-col relative custom-scrollbar">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Amount To Pay</p>
                  <h2 className="text-2xl font-black text-gray-800">
                    500.00 <span className="text-sm font-bold text-gray-500">BDT</span>
                  </h2>
                </div>

                {/* Bank Details Card */}
                <div 
                  className="rounded-t-2xl p-4 flex items-center gap-3 shadow-md relative overflow-hidden"
                  style={{ backgroundColor: bank.bgColor || '#1E5631', color: bank.textColor || '#ffffff' }}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Building className="w-16 h-16" style={{ color: bank.textColor || '#ffffff' }} />
                  </div>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner shrink-0 relative z-10 p-1">
                    {bank.logo ? (
                      <img src={formatImgUrl(bank.logo)} alt={bank.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-lg font-black text-gray-800">{(bank.name || 'B').charAt(0)}</span>
                    )}
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <h2 className="text-base font-black uppercase tracking-wide line-clamp-1 truncate">{bank.name || 'Bank Name'}</h2>
                    <p className="text-[9px] font-bold uppercase tracking-wider line-clamp-1 truncate" style={{ color: bank.labelColor || '#bbf7d0' }}>BRANCH: GULSHAN BRANCH</p>
                  </div>
                </div>

                <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-md p-4 space-y-3 mb-4">
                  {[
                    { icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', label: 'A/C NAME', value: 'JOHN DOE' },
                    { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'A/C NUMBER', value: '1502203948001' },
                    { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'BRANCH', value: 'GULSHAN BRANCH' },
                    { icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'ROUTING NO', value: '125271294' },
                    { icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l5.447-2.724A1 1 0 0116 5.618v10.764a1 1 0 01-1.447.894L9 20z', label: 'DISTRICT', value: 'DHAKA' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                      </div>
                      <div className="flex items-center justify-between group">
                        <span className="text-xs font-black text-gray-800 font-mono tracking-wide">{item.value}</span>
                        <span className="text-[9px] font-bold text-[#0EB78C] bg-[#0EB78C]/10 px-1.5 py-0.5 rounded cursor-pointer transition-opacity">
                          COPY
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex gap-2">
                  <div className="mt-0.5">
                    <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-red-700 font-medium leading-relaxed">
                    <strong className="font-bold">নোট:</strong> এন পি এস বি ব্যাংক টাকা ট্রান্সফার করার ক্ষেত্রে কোন রকম সেন্ড মানি বা পেমেন্ট অপশন নির্বাচন করবেন না। সেন্ড মানি নির্বাচন করলে আপনার পেমেন্ট আমাদের একাউন্টে আসবে না।
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-4">
                  <label className="block text-xs font-bold text-gray-700 mb-2">Upload Payment Proof</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-700">Select files to upload</span>
                    <p className="text-[9px] text-gray-400 mt-1">JPG, PNG, PDF (Max 5MB)</p>
                  </div>
                </div>
                
                <div className="mt-auto pt-4">
                  <button className="w-full py-3.5 bg-gradient-to-r from-[#0EB78C] to-[#16007A] text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 text-sm">
                    Pay ৳500.00
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <p className="text-center text-[9px] text-gray-500 mt-3">
                    By continuing, you agree to our <a href="#" className="text-[#0EB78C] underline">Terms & Conditions</a>
                  </p>
                  <p className="text-center text-[9px] text-gray-400 mt-1 flex items-center justify-center gap-1">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Secured & powered by olinuks
                  </p>
                </div>
              </div>
           </div>
        </div>
      </motion.div>

      {/* ================= AGENT ACCOUNTS LIST ================= */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="bg-white/5 border border-white/5 rounded-[24px] overflow-hidden backdrop-blur-xl shadow-lg"
      >
         <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Users className="w-6 h-6 text-indigo-400" /> 
                Configured Agent Accounts
              </h3>
              <p className="text-sm text-slate-400 mt-1">Wallet agents who have added an account for {bank.name}</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                 type="text"
                 placeholder="Search agent or account..."
                 value={agentSearch}
                 onChange={(e) => setAgentSearch(e.target.value)}
                 className="pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white placeholder-slate-500 outline-none w-full sm:w-72 transition-all shadow-inner"
              />
            </div>
         </div>

         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
               <thead className="bg-black/30 text-xs uppercase font-bold text-slate-500">
                  <tr>
                     <th className="px-6 py-5 border-b border-white/5">Account Info</th>
                     <th className="px-6 py-5 border-b border-white/5">Branch Details</th>
                     <th className="px-6 py-5 border-b border-white/5">Agent Owner</th>
                     <th className="px-6 py-5 border-b border-white/5 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {agentLoading ? (
                    <tr><td colSpan="4" className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></td></tr>
                  ) : agentAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-16 text-slate-500">
                        <Landmark className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-base font-medium">No agents have configured accounts for {bank.name}.</p>
                      </td>
                    </tr>
                  ) : (
                    agentAccounts.filter((acc) => {
                      const q = agentSearch.toLowerCase();
                      return !q || acc.accountNumber?.toLowerCase().includes(q) || acc.accountHolderName?.toLowerCase().includes(q) || acc.owner?.name?.toLowerCase().includes(q);
                    }).map(acc => (
                      <tr key={acc._id} className="hover:bg-white/[0.03] transition-colors">
                         <td className="px-6 py-5">
                            <p className="font-bold text-indigo-300 text-base font-mono tracking-tight bg-indigo-500/10 px-2 py-1 rounded w-fit mb-1">{acc.accountNumber}</p>
                            <p className="text-sm text-slate-300 font-medium">{acc.accountHolderName}</p>
                         </td>
                         <td className="px-6 py-5">
                            <p className="font-bold text-slate-200">{acc.branchName || 'No Branch'}</p>
                            <p className="text-xs text-slate-500 mt-1">{acc.routingNumber ? `Routing: ${acc.routingNumber}` : 'No Routing No.'}</p>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold border border-violet-500/20">
                                {acc.owner?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-200">{acc.owner?.name || 'Unknown Agent'}</p>
                                <p className="text-xs text-slate-500">{acc.owner?.email || 'N/A'}</p>
                              </div>
                            </div>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-3">
                               <button onClick={() => handleEditAgentAccountClick(acc)} className="p-2.5 bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-400 rounded-xl transition-colors border border-white/5">
                                 <Edit className="w-4 h-4" />
                               </button>
                               <button onClick={() => handleDeleteAgentAccount(acc._id)} className="p-2.5 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl transition-colors border border-white/5">
                                 <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                         </td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </motion.div>

      {/* Edit Agent Modal */}
      {editingAgentAccount && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
             className="bg-slate-900 border border-white/10 rounded-[24px] w-full max-w-lg overflow-hidden shadow-2xl"
           >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <Edit className="w-5 h-5 text-indigo-400" /> Edit Agent Account
                 </h3>
                 <button onClick={() => setEditingAgentAccount(null)} className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors">✕</button>
              </div>
              <form onSubmit={handleSaveAgentAccount} className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Bank Name</label>
                      <input type="text" value={agentForm.bankName} onChange={(e) => setAgentForm({ ...agentForm, bankName: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" required />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Number</label>
                      <input type="text" value={agentForm.accountNumber} onChange={(e) => setAgentForm({ ...agentForm, accountNumber: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" required />
                   </div>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Holder Name</label>
                    <input type="text" value={agentForm.accountHolderName} onChange={(e) => setAgentForm({ ...agentForm, accountHolderName: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" required />
                 </div>
                 <div className="grid grid-cols-3 gap-4">
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch Name</label>
                      <input type="text" value={agentForm.branchName} onChange={(e) => setAgentForm({ ...agentForm, branchName: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Routing Number</label>
                      <input type="text" value={agentForm.routingNumber} onChange={(e) => setAgentForm({ ...agentForm, routingNumber: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-300 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Min Amount (৳)</label>
                      <input type="number" min="0" step="0.01" value={agentForm.minAmount} onChange={(e) => setAgentForm({ ...agentForm, minAmount: Number(e.target.value) || 0 })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                   </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-white/5">
                    <button type="button" onClick={() => setEditingAgentAccount(null)} className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">Save Changes</button>
                 </div>
              </form>
           </motion.div>
        </div>
      )}
    </div>
  );
}
