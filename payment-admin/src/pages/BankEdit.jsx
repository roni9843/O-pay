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
    bgColor: '#ffffff',
    textColor: '#1e293b',
    labelColor: '#94a3b8',
    minAmount: 0,
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
              minAmount: bank.minAmount || 0,
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

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Minimum Transaction Amount (৳)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={formData.minAmount || ''}
                  onChange={(e) => setFormData({ ...formData, minAmount: Number(e.target.value) || 0 })}
                  className="w-full px-5 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-medium text-white placeholder-slate-600 outline-none transition-all"
                />
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

              <p className="text-sm font-bold text-slate-500 mb-4 text-center">Full Payment Modal Preview</p>
              <div className="mb-8 flex justify-center">
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
                        style={{ backgroundColor: formData.bgColor || '#1E5631', color: formData.textColor || '#ffffff' }}
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Building className="w-16 h-16" style={{ color: formData.textColor || '#ffffff' }} />
                        </div>
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner shrink-0 relative z-10 p-1">
                          {formData.logo ? (
                            <img src={formatImgUrl(formData.logo)} alt={formData.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-lg font-black text-gray-800">{(formData.name || 'B').charAt(0)}</span>
                          )}
                        </div>
                        <div className="relative z-10 min-w-0 flex-1">
                          <h2 className="text-base font-black uppercase tracking-wide line-clamp-1 truncate">{formData.name || 'Bank Name'}</h2>
                          <p className="text-[9px] font-bold uppercase tracking-wider line-clamp-1 truncate" style={{ color: formData.labelColor || '#bbf7d0' }}>BRANCH: GULSHAN BRANCH</p>
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
                            <Upload className="w-5 h-5" />
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
