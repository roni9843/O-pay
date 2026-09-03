import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Plus, Trash2, Loader2, Building, Edit, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function BankManagement() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [agentAccounts, setAgentAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [banksRes, agentsRes] = await Promise.all([
        api.getBankList(token),
        api.getAgentBankAccounts(token)
      ]);
      
      if (banksRes.success) {
        setBanks(banksRes.data || []);
      }
      if (agentsRes.success) {
        setAgentAccounts(agentsRes.data || []);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this bank?')) return;
    try {
      const res = await api.deleteBank(token, id);
      if (res.success) {
        toast.success('Bank deleted');
        fetchData();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete bank');
    }
  };

  const handleEdit = (id, e) => {
    e.stopPropagation();
    navigate(`/bank-management/edit/${id}`);
  };

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const activeCount = banks.filter(b => b.status === 'active').length;

  return (
    <div className="space-y-8">
      
      {/* ================= HEADER ================= */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-8 border border-white/5 backdrop-blur-md"
      >
        <div className="absolute top-0 right-0 p-8 opacity-20">
           <Landmark className="h-32 w-32 text-violet-400" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
               <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                 Bank Management
               </span>
            </h2>
            <p className="text-slate-400 max-w-xl">
               Manage supported banks and view associated wallet agents.
            </p>
          </div>
          
          <div className="flex gap-4 items-center">
             <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md text-center min-w-[120px]">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Total</p>
                <p className="text-2xl font-bold text-white">{banks.length}</p>
             </div>
             <div className="bg-white/5 border border-emerald-500/20 p-4 rounded-2xl backdrop-blur-md text-center min-w-[120px]">
                <p className="text-xs text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">Active</p>
                <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
             </div>
             <button
               onClick={() => navigate('/bank-management/add')}
               className="ml-4 px-6 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all flex items-center justify-center gap-2"
             >
               <Plus className="w-5 h-5" /> Add New Bank
             </button>
          </div>
        </div>
      </motion.div>

      {/* ================= MAIN CONTENT ================= */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-white/5 border border-white/5 rounded-[24px] p-6 backdrop-blur-xl shadow-lg min-h-[50vh]"
      >
        {loading ? (
          <div className="flex justify-center items-center h-[40vh]">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
             <Building className="w-16 h-16 mx-auto opacity-30 text-indigo-400 mb-4" />
             <p className="font-medium text-lg text-slate-300">No banks added yet</p>
             <button onClick={() => navigate('/bank-management/add')} className="mt-4 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-500/20 transition-colors">
               Add First Bank
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {banks.map((bank, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={bank._id}
                onClick={() => navigate(`/bank-management/${bank._id}`)}
                className="bg-black/20 border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                 {/* Agent Count Badge */}
                 <div className="absolute top-0 right-0 bg-indigo-500/10 border-b border-l border-indigo-500/20 px-3 py-1.5 rounded-bl-xl backdrop-blur-md flex items-center gap-1.5">
                   <Users className="w-3.5 h-3.5 text-indigo-400" />
                   <span className="text-xs font-bold text-indigo-300">
                     {agentAccounts.filter(acc => acc.bankName === bank.name).length} Agents
                   </span>
                 </div>
                 <div className="flex items-start gap-4 mb-5">
                   <div 
                     className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-md border border-white/10"
                     style={{ backgroundColor: bank.bgColor || '#1E293B' }}
                   >
                     {bank.logo ? (
                       <img src={formatImgUrl(bank.logo)} alt={bank.name} className="w-10 h-10 object-contain p-1" />
                     ) : (
                       <Building className="w-7 h-7" style={{ color: bank.textColor || '#94a3b8' }} />
                     )}
                   </div>
                   <div className="flex-1 min-w-0 pt-1">
                      <h4 className="font-bold text-white text-base line-clamp-1">{bank.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                         <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">{bank.code || 'NO-CODE'}</span>
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${bank.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            {bank.status}
                         </span>
                      </div>
                   </div>
                 </div>
                 
                 <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 hover:text-indigo-300 transition-colors">
                      <Users className="w-4 h-4" /> View Wallet Agents
                    </span>
                    <div className="flex gap-2">
                       <button onClick={(e) => handleEdit(bank._id, e)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20" title="Edit Bank">
                         <Edit className="w-4 h-4" />
                       </button>
                       <button onClick={(e) => handleDelete(bank._id, e)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20" title="Delete Bank">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
