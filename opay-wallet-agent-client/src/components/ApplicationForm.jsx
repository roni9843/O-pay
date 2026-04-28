import React, { useState } from 'react';
import { X, Upload, Check, Loader2 } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function ApplicationForm({ selectedPlan, onClose }) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    district: '',
    upazila: '',
    nidFront: '',
    nidBack: '',
    photo: '',
    hasBkash: 'না',
    hasNagad: 'না',
    hasUpay: 'না',
    wantBankAgent: 'না',
    canBankTrx: 'হা',
    reason: '',
    experience: '',
    initialAmount: '',
    canTopupMin: 'হা', // "Minimum 10k topup"
    isCorrectInfo: false,
    serviceType: selectedPlan || 'General'
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Improved Image Upload Helper
  // In a real app, this should upload to server/S3 and get a URL.
  // For this demo, we'll store the File object or base64? 
  // User backend schema expects String (URL). 
  // We'll mock the upload URL or use a placeholder if no upload endpoint exists yet for public.
  // Actually the backend has `uploadsRouter` but it likely requires Auth?
  // Let's assume there's a public upload or we just send the filename for now if we can't upload.
  // Better: Use a reliable public image host or placeholder for demo, OR try to upload to `api/uploads`.
  // I'll simulate upload for now to keep it simple, or mock it.
  
  const handleFileUpload = async (e, field) => {
      const file = e.target.files[0];
      if (!file) return;

      // Mock upload delay
      // In production: const formData = new FormData()... await axios.post('/api/uploads', ...)
      // Here just setting a fake URL for valid schema validation if backend checks.
      // Or reading as DataURL (Base64) - Backend schema is String, so Base64 works but is heavy.
      // Let's use Base64 for simplicity in this standalone demo context.
      
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.isCorrectInfo) {
      alert("Please confirm all information is correct.");
      return;
    }
    
    setLoading(true);
    try {
      // PROD URL: e:\MY Aplication\3rd Step\88-website\payment-backend
      // Need to ensuring CORS or Proxy.
      // Vite config proxy should be set up, or absolute URL. 
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const API_URL = `${API_BASE}/api/agent-applications`; 
      
      await axios.post(API_URL, formData);
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("আবেদন জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">আবেদন সফল হয়েছে!</h2>
          <p className="text-slate-400 mb-8">
            আপনার আবেদনটি আমাদের কাছে জমা হয়েছে। আমরা শীঘ্রই আপনার সাথে যোগাযোগ করবো।
          </p>
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
          >
            ধন্যবাদ
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl my-8 relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-white">আবেদন ফর্ম</h2>
            <p className="text-sm text-emerald-400 font-medium mt-1">
              প্ল্যান: {selectedPlan}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Personal Info */}
            <div className="space-y-4">
               <h3 className="text-lg font-semibold text-slate-200 border-l-4 border-violet-500 pl-3">ব্যক্তিগত তথ্য</h3>
               <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">আপনার নাম</label>
                    <input name="name" required onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" placeholder="সম্পূর্ণ নাম লিখুন" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">মোবাইল নং</label>
                    <input name="mobile" required onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" placeholder="017xxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">জেলা</label>
                    <input name="district" required onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" placeholder="আপনার জেলা" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">উপজেলা</label>
                    <input name="upazila" required onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" placeholder="আপনার উপজেলা" />
                  </div>
               </div>
            </div>

            {/* Documents */}
            <div className="space-y-4">
               <h3 className="text-lg font-semibold text-slate-200 border-l-4 border-blue-500 pl-3">প্রয়োজনীয় কাগজপত্র</h3>
               <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <span className="text-sm text-slate-400">এন আই ডি কপি (ফন্ট পেজ)</span>
                     <div className="relative h-32 bg-slate-950 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center group hover:border-violet-500 transition-colors cursor-pointer overflow-hidden">
                        {formData.nidFront ? <img src={formData.nidFront} className="h-full w-full object-cover" /> : (
                            <div className="text-center p-4">
                              <Upload className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                              <span className="text-xs text-slate-500">Upload Front</span>
                            </div>
                        )}
                        <input type="file" required onChange={(e) => handleFileUpload(e, 'nidFront')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <span className="text-sm text-slate-400">এন আই ডি কপি (ব্যাক পেজ)</span>
                     <div className="relative h-32 bg-slate-950 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center group hover:border-violet-500 transition-colors cursor-pointer overflow-hidden">
                        {formData.nidBack ? <img src={formData.nidBack} className="h-full w-full object-cover" /> : (
                             <div className="text-center p-4">
                              <Upload className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                              <span className="text-xs text-slate-500">Upload Back</span>
                            </div>
                        )}
                        <input type="file" required onChange={(e) => handleFileUpload(e, 'nidBack')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <span className="text-sm text-slate-400">আপনার একটি ছবি</span>
                     <div className="relative h-32 bg-slate-950 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center group hover:border-violet-500 transition-colors cursor-pointer overflow-hidden">
                        {formData.photo ? <img src={formData.photo} className="h-full w-full object-cover" /> : (
                            <div className="text-center p-4">
                              <Upload className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                              <span className="text-xs text-slate-500">Upload Photo</span>
                            </div>
                        )}
                        <input type="file" required onChange={(e) => handleFileUpload(e, 'photo')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                     </div>
                  </div>
               </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200 border-l-4 border-emerald-500 pl-3">অন্যান্য তথ্য</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                   {[
                     { label: 'আপনার কি বিকাশ এজেন্ট সিম আছে?', name: 'hasBkash' },
                     { label: 'আপনার কি নগদ এজেন্ট সিম আছে?', name: 'hasNagad' },
                     { label: 'আপনার কি উপায় এজেন্ট সিম আছে?', name: 'hasUpay' },
                     { label: 'আপনি কি ব্যাংক ট্রান্সফার এজেন্ট হতে চান?', name: 'wantBankAgent' },
                     { label: 'আপনার ব্যাংক একাউন্ট লেনদেন করতে পারবেন?', name: 'canBankTrx' },
                   ].map((item) => (
                     <div key={item.name} className="flex flex-col gap-2">
                        <label className="text-sm text-slate-400">{item.label}</label>
                        <div className="flex gap-4">
                           {['হা', 'না'].map(opt => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                 <input 
                                   type="radio" 
                                   name={item.name} 
                                   value={opt} 
                                   checked={formData[item.name] === opt}
                                   onChange={handleChange}
                                   className="form-radio text-violet-600 bg-slate-950 border-slate-700"
                                 />
                                 <span className="text-sm">{opt}</span>
                              </label>
                           ))}
                        </div>
                     </div>
                   ))}
                </div>

                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">আপনি কেনো ওয়ালেট এজেন্ট হয়ে কাজ করতে চান?</label>
                    <textarea name="reason" rows="2" onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">আপনি কি পূর্বে ওয়ালেট এজন্ট হয়ে কাজ করেছেন?</label>
                    <textarea name="experience" rows="2" onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">আপনি প্রথমে কত টাকা লেনদেন করতে পারবেন?</label>
                    <input name="initialAmount" onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-violet-500 focus:outline-none transition-colors" placeholder="টাকার পরিমাণ লিখুন" />
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                   <p className="text-sm text-emerald-300 mb-3">
                     মিনিমাম ১০ হাজার টাকা টপ আপ থেকে শুরু আমাদের ওয়ালেট এজেন্ট। আপনি কি তা টপ আপ করতে পারবেন?
                   </p>
                   <div className="flex gap-4">
                      {['হা', 'না'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer text-white">
                            <input 
                              type="radio" 
                              name="canTopupMin" 
                              value={opt} 
                              checked={formData.canTopupMin === opt}
                              onChange={handleChange}
                              className="form-radio text-emerald-500 bg-slate-950 border-slate-700"
                            />
                            <span className="text-sm font-medium">{opt}</span>
                        </label>
                      ))}
                   </div>
                </div>
            </div>

            {/* Confirmation */}
            <div className="pt-4 border-t border-slate-800">
               <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    name="isCorrectInfo" 
                    checked={formData.isCorrectInfo}
                    onChange={handleChange}
                    className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-950 text-violet-600 focus:ring-violet-500"
                  />
                  <div className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    উপরের সকল তথ্য সঠিক দিয়েছেন? আমি সজ্ঞানে স্বীকার করছি যে ভুল তথ্য দিলে আমার আবেদন বাতিল বলে গণ্য হবে।
                  </div>
               </label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'আবেদন জমা দিন'}
            </button>

          </form>
        </div>
      </motion.div>
    </div>
  );
}
