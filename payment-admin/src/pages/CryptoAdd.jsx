import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Coins, Plus, Loader2, Upload, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function CryptoAdd() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    logo: '',
    status: 'active',
    currency: 'USDT',
    rate: 120, // 1 USDT = 120 BDT default example
    chargePercent: 0,
    sortOrder: 0,
    textColor: '#ffffff',
    labelColor: '#94a3b8',
    instructions: '',
    minAmount: 0,
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await api.uploadPaymentPageImage(token, file);
      if (data && data.url) {
        setFormData((prev) => ({ ...prev, logo: data.url }));
        toast.success('Logo uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (err) {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return toast.error('Crypto name is required');
    }
    if (!formData.currency.trim()) {
      return toast.error('Currency string is required');
    }
    if (!formData.rate || Number(formData.rate) <= 0) {
      return toast.error('Valid exchange rate is required');
    }

    setSaving(true);
    try {
      const res = await api.createCrypto(token, formData);
      if (res.success) {
        toast.success('Crypto method added successfully');
        navigate('/crypto-management');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save crypto');
    } finally {
      setSaving(false);
    }
  };

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
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
        
        <div className="relative z-10 flex items-center gap-6">
          <button onClick={() => navigate('/crypto-management')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
               <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                 Add New Crypto Method
               </span>
            </h2>
            <p className="text-slate-400 max-w-xl">
               Create a new supported Crypto currency / payment option with rate calculations.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ================= FORM ================= */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="bg-white/5 border border-white/5 rounded-[24px] p-8 backdrop-blur-xl shadow-lg relative overflow-hidden"
        >
           <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
             <Plus className="w-5 h-5 text-emerald-400" />
             Crypto Configuration
           </h3>

           <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Crypto Method Name <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Binance Pay, USDT TRC20, Touch and Go"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-medium text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Currency String <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. USDT, RM, USD"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 text-sm font-medium text-white placeholder-slate-600 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Rate (1 {formData.currency || 'Currency'} = X BDT) <span className="text-rose-400">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 120 (for USDT) or 32 (for RM)"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 text-sm font-medium text-white placeholder-slate-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Converting Charge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2 for 2%"
                  value={formData.chargePercent}
                  onChange={(e) => setFormData({ ...formData, chargePercent: Number(e.target.value) })}
                  className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 text-sm font-medium text-white placeholder-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Logo Upload</label>
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-3 shadow-inner shrink-0">
                      {formData.logo ? (
                         <img src={formatImgUrl(formData.logo)} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                         <Coins className="w-8 h-8 text-slate-600" />
                      )}
                   </div>
                   <label className="cursor-pointer">
                      <div className="px-5 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-xl text-sm font-bold transition-colors border border-emerald-500/20 flex items-center justify-center gap-2">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        {uploading ? 'Uploading...' : 'Choose Image'}
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                   </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 focus:outline-none text-sm font-medium text-white appearance-none"
                  >
                    <option value="active" className="bg-slate-900">Active</option>
                    <option value="inactive" className="bg-slate-900">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 focus:outline-none text-sm font-medium text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Minimum Transaction Amount (৳)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={formData.minAmount || ''}
                  onChange={(e) => setFormData({ ...formData, minAmount: Number(e.target.value) || 0 })}
                  className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 text-sm font-medium text-white placeholder-slate-600 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-bold text-base shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all flex items-center justify-center gap-3 mt-6"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Save Crypto Method'}
              </button>
           </form>
        </motion.div>

        {/* ================= LIVE PREVIEW ================= */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="bg-white/5 border border-white/5 rounded-[24px] p-8 backdrop-blur-xl shadow-lg relative overflow-hidden h-fit"
        >
           <h3 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
             Rate Breakdown Preview
           </h3>
           
           <div className="bg-slate-900/80 rounded-2xl p-6 border border-white/10 text-white space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                 {formData.logo ? (
                   <img src={formatImgUrl(formData.logo)} alt="Logo" className="w-10 h-10 object-contain" />
                 ) : (
                   <Coins className="w-10 h-10 text-emerald-400" />
                 )}
                 <div>
                   <h4 className="font-bold text-base">{formData.name || 'Crypto Name'}</h4>
                   <p className="text-xs text-slate-400">1 {formData.currency || 'USDT'} = {formData.rate || 1} BDT</p>
                 </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl space-y-2 text-sm">
                 <div className="flex justify-between text-slate-400">
                    <span>Base Rate:</span>
                    <span className="font-bold text-white">1 {formData.currency || 'USDT'} = {formData.rate || 1} BDT</span>
                 </div>
                 <div className="flex justify-between text-slate-400">
                    <span>Example 500 BDT Payment:</span>
                    <span className="font-bold text-emerald-400">
                       {(500 / (Number(formData.rate) || 1)).toFixed(2)} {formData.currency || 'USDT'}
                    </span>
                 </div>
                 {Number(formData.chargePercent) > 0 && (
                   <div className="flex justify-between text-slate-400">
                      <span>Charge ({formData.chargePercent}%):</span>
                      <span className="font-bold text-amber-400">
                         {((500 / (Number(formData.rate) || 1)) * (Number(formData.chargePercent) / 100)).toFixed(2)} {formData.currency || 'USDT'}
                      </span>
                   </div>
                 )}
                 <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-base text-emerald-300">
                    <span>Total User Pay Bill:</span>
                    <span>
                       {((500 / (Number(formData.rate) || 1)) * (1 + (Number(formData.chargePercent) || 0) / 100)).toFixed(2)} {formData.currency || 'USDT'}
                    </span>
                 </div>
              </div>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
