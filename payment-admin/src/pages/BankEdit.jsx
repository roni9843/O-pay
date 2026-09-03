import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Edit, Loader2, Building, Upload, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';

export default function BankEdit() {
  const { id } = useParams();
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    logo: '',
    status: 'active',
    sortOrder: 0,
    bgColor: '#ffffff',
    textColor: '#1e293b',
    labelColor: '#94a3b8',
  });

  useEffect(() => {
    const fetchBankDetails = async () => {
      try {
        const res = await api.getBankList(token);
        if (res.success && res.data) {
          const bank = res.data.find(b => b._id === id);
          if (bank) {
            setFormData({
              name: bank.name,
              code: bank.code || '',
              logo: bank.logo || '',
              status: bank.status || 'active',
              sortOrder: bank.sortOrder || 0,
              bgColor: bank.bgColor || '#ffffff',
              textColor: bank.textColor || '#1e293b',
              labelColor: bank.labelColor || '#94a3b8',
            });
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
    if (token && id) {
      fetchBankDetails();
    }
  }, [token, id, navigate]);

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
      return toast.error('Bank name is required');
    }

    setSaving(true);
    try {
      const res = await api.updateBank(token, id, formData);
      if (res.success) {
        toast.success('Bank updated successfully!');
        navigate('/bank-management');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update bank');
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

  if (loading) {
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
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-8 border border-white/5 backdrop-blur-md"
      >
        <div className="absolute top-0 right-0 p-8 opacity-20">
           <Landmark className="h-32 w-32 text-violet-400" />
        </div>
        
        <div className="relative z-10 flex items-center gap-6">
          <button onClick={() => navigate('/bank-management')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
               <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                 Edit Bank Configuration
               </span>
            </h2>
            <p className="text-slate-400 max-w-xl">
               Update the configuration and appearance of this bank.
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
             <Edit className="w-5 h-5 text-indigo-400" />
             Edit Details
           </h3>

           <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Bank Name <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Bank"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-medium text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Bank Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CBL"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-medium text-white placeholder-slate-600 outline-none transition-all uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Logo Upload</label>
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-3 shadow-inner shrink-0">
                      {formData.logo ? (
                         <img src={formatImgUrl(formData.logo)} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                         <Building className="w-8 h-8 text-slate-600" />
                      )}
                   </div>
                   <label className="cursor-pointer">
                      <div className="px-5 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl text-sm font-bold transition-colors border border-indigo-500/20 flex items-center justify-center gap-2">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        {uploading ? 'Uploading...' : 'Choose Image'}
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                   </label>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                 <h4 className="text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Appearance Settings</h4>
                 
                 <div className="grid grid-cols-2 gap-5">
                    <div>
                       <label className="block text-xs font-medium text-slate-400 mb-2">Background Color</label>
                       <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10">
                         <input type="color" value={formData.bgColor} onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                         <input type="text" value={formData.bgColor} onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })} className="w-full bg-transparent text-sm text-white font-mono outline-none uppercase" />
                       </div>
                    </div>
                    <div>
                       <label className="block text-xs font-medium text-slate-400 mb-2">Text Color</label>
                       <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10">
                         <input type="color" value={formData.textColor} onChange={(e) => setFormData({ ...formData, textColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                         <input type="text" value={formData.textColor} onChange={(e) => setFormData({ ...formData, textColor: e.target.value })} className="w-full bg-transparent text-sm text-white font-mono outline-none uppercase" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-5 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none text-sm font-medium text-white appearance-none"
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
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 focus:outline-none text-sm font-medium text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-xl font-bold text-base shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-all flex items-center justify-center gap-3 mt-6"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Update Bank'}
              </button>
           </form>
        </motion.div>

        {/* ================= LIVE PREVIEW CARD ================= */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="bg-white/5 border border-white/5 rounded-[24px] p-8 backdrop-blur-xl shadow-lg relative overflow-hidden h-fit"
        >
           <h3 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
             Live Client Preview 
             <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">How users see it</span>
           </h3>
           
           <div className="bg-[#ececec] rounded-2xl p-8 shadow-inner border border-gray-200">
              
              <p className="text-sm font-bold text-slate-500 mb-4 text-center">Dropdown Item Preview</p>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
                 <div className="flex items-center gap-4 p-4 bg-gray-50 border-b border-gray-100">
                    {formData.logo ? (
                      <img src={formatImgUrl(formData.logo)} alt="Logo" className="w-10 h-10 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                         <Building className="w-5 h-5" />
                      </div>
                    )}
                    <span className="text-base font-bold text-gray-800 line-clamp-1">
                       {formData.name || 'Bank Name'}
                    </span>
                 </div>
              </div>

              <p className="text-sm font-bold text-slate-500 mb-4 text-center">Payment Page Grid Preview</p>
              <div className="flex justify-center">
                 <button
                   className="flex flex-col items-center gap-3 group relative cursor-default"
                 >
                   <div
                     className="relative w-24 h-24 rounded-2xl shadow-md flex items-center justify-center p-4 transition-all duration-300 border border-gray-100/80"
                     style={{ backgroundColor: formData.bgColor || '#ffffff' }}
                   >
                     {formData.logo ? (
                       <img src={formatImgUrl(formData.logo)} alt="Logo" className="w-full h-full object-contain" />
                     ) : (
                       <Building className="w-12 h-12" style={{ color: formData.textColor || '#1e293b' }} />
                     )}
                     
                     {formData.status === 'active' && (
                       <div className="absolute -top-1 -right-1 px-3 py-1 text-[10px] font-bold bg-green-100 text-green-800 rounded-full shadow-md border border-green-300">
                         Active
                       </div>
                     )}
                   </div>

                   <span
                     className="text-sm font-bold transition-colors text-center line-clamp-1"
                     style={{ color: formData.textColor || '#1e293b' }}
                   >
                     {formData.name || 'Bank Name'}
                   </span>
                 </button>
              </div>

           </div>
        </motion.div>

      </div>
    </div>
  );
}
