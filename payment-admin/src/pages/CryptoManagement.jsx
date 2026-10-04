import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Coins, Plus, Trash2, Loader2, Edit, Users, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function CryptoManagement() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [cryptos, setCryptos] = useState([]);
  const [agentAccounts, setAgentAccounts] = useState([]);
  const [globalMinTnx, setGlobalMinTnx] = useState(0);
  const [savingMinTnx, setSavingMinTnx] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cryptosRes, agentsRes, minTnxRes] = await Promise.all([
        api.getCryptoList(token),
        api.getAgentCryptoAccounts(token),
        api.getGlobalMinCryptoTnx(token)
      ]);
      
      if (cryptosRes?.success) {
        setCryptos(cryptosRes.data || []);
      }
      if (agentsRes?.success) {
        setAgentAccounts(agentsRes.data || []);
      }
      if (minTnxRes?.success) {
        setGlobalMinTnx(minTnxRes.amount || 0);
      }
    } catch (err) {
      toast.error('Failed to load crypto data');
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
    if (!window.confirm('Are you sure you want to delete this crypto method?')) return;
    try {
      const res = await api.deleteCrypto(token, id);
      if (res.success) {
        toast.success('Crypto method deleted');
        fetchData();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete crypto');
    }
  };

  const handleEdit = (id, e) => {
    e.stopPropagation();
    navigate(`/crypto-management/edit/${id}`);
  };

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const activeCount = cryptos.filter(c => c.status === 'active').length;

  const handleUpdateGlobalMinTnx = async () => {
    try {
      setSavingMinTnx(true);
      const res = await api.updateGlobalMinCryptoTnx(token, globalMinTnx);
      if (res.success) {
        toast.success('Global Minimum Transaction Amount updated successfully');
      } else {
        toast.error(res.message || 'Failed to update minimum transaction amount');
      }
    } catch (err) {
      toast.error('Failed to update minimum transaction amount');
    } finally {
      setSavingMinTnx(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ================= HEADER ================= */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600/20 via-teal-600/10 to-transparent p-8 border border-white/5 backdrop-blur-md"
      >
        <div className="absolute top-0 right-0 p-8 opacity-20">
           <Coins className="h-32 w-32 text-emerald-400" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
               <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                 Crypto Management
               </span>
            </h2>
            <p className="text-slate-400 max-w-xl">
               Manage Crypto payment methods, exchange rates, and agent wallets.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
             <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md flex items-center gap-3 min-w-[200px]">
                <div>
                   <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Global Min Tnx</p>
                   <div className="flex items-center gap-2">
                     <span className="text-lg font-bold text-slate-300">৳</span>
                     <input 
                       type="number" 
                       min="0"
                       value={globalMinTnx}
                       onChange={(e) => setGlobalMinTnx(Number(e.target.value) || 0)}
                       className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-sm font-bold focus:border-emerald-500 focus:outline-none"
                     />
                   </div>
                </div>
                <button 
                  onClick={handleUpdateGlobalMinTnx}
                  disabled={savingMinTnx}
                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold transition-colors ml-auto"
                >
                  {savingMinTnx ? 'Saving...' : 'Save'}
                </button>
             </div>
             <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md text-center min-w-[100px]">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Total</p>
                <p className="text-2xl font-bold text-white">{cryptos.length}</p>
             </div>
             <div className="bg-white/5 border border-emerald-500/20 p-4 rounded-2xl backdrop-blur-md text-center min-w-[100px]">
                <p className="text-xs text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">Active</p>
                <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
             </div>
             <button
               onClick={() => navigate('/crypto-management/add')}
               className="ml-0 md:ml-4 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-2 h-full"
             >
               <Plus className="w-5 h-5" /> Add New Crypto
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
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          </div>
        ) : cryptos.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
             <Coins className="w-16 h-16 mx-auto opacity-30 text-emerald-400 mb-4" />
             <p className="font-medium text-lg text-slate-300">No Crypto methods added yet</p>
             <button onClick={() => navigate('/crypto-management/add')} className="mt-4 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors">
               Add First Crypto Method
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {cryptos.map((crypto, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={crypto._id}
                onClick={() => navigate(`/crypto-management/edit/${crypto._id}`)}
                className="bg-black/20 border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                 {/* Agent Count Badge */}
                 <div className="absolute top-0 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/20 px-3 py-1.5 rounded-bl-xl backdrop-blur-md flex items-center gap-1.5">
                   <Users className="w-3.5 h-3.5 text-emerald-400" />
                   <span className="text-xs font-bold text-emerald-300">
                     {agentAccounts.filter(acc => acc.cryptoName === crypto.name).length} Agents
                   </span>
                 </div>
                 <div className="flex items-start gap-4 mb-4">
                   <div 
                     className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-md border border-white/10"
                     style={{ backgroundColor: crypto.bgColor || '#0f172a' }}
                   >
                     {crypto.logo ? (
                       <img src={formatImgUrl(crypto.logo)} alt={crypto.name} className="w-10 h-10 object-contain p-1" />
                     ) : (
                       <Coins className="w-7 h-7" style={{ color: crypto.textColor || '#10b981' }} />
                     )}
                   </div>
                   <div className="flex-1 min-w-0 pt-1">
                      <h4 className="font-bold text-white text-base line-clamp-1">{crypto.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                         <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                           {crypto.currency || 'USDT'}
                         </span>
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${crypto.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            {crypto.status}
                         </span>
                      </div>
                   </div>
                 </div>

                 <div className="bg-white/5 rounded-xl p-3 mb-4 text-xs space-y-1">
                   <div className="flex justify-between text-slate-300 font-medium">
                     <span className="text-slate-400">Rate:</span>
                     <span className="font-bold text-emerald-400">1 {crypto.currency || 'USDT'} = {crypto.rate} BDT</span>
                   </div>
                   {crypto.chargePercent > 0 && (
                     <div className="flex justify-between text-slate-300 font-medium">
                       <span className="text-slate-400">Converting Charge:</span>
                       <span className="font-bold text-amber-400">{crypto.chargePercent}%</span>
                     </div>
                   )}
                 </div>
                 
                 <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 hover:text-emerald-300 transition-colors">
                      <DollarSign className="w-4 h-4 text-emerald-400" /> Details & Rate
                    </span>
                    <div className="flex gap-2">
                       <button onClick={(e) => handleEdit(crypto._id, e)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20" title="Edit Crypto">
                         <Edit className="w-4 h-4" />
                       </button>
                       <button onClick={(e) => handleDelete(crypto._id, e)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20" title="Delete Crypto">
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
