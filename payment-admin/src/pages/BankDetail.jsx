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
    status: 'active'
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
      status: acc.status || 'active'
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
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch Name</label>
                      <input type="text" value={agentForm.branchName} onChange={(e) => setAgentForm({ ...agentForm, branchName: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Routing Number</label>
                      <input type="text" value={agentForm.routingNumber} onChange={(e) => setAgentForm({ ...agentForm, routingNumber: e.target.value })} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-300 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
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
