import React from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api'; // Ensure this uses your updated api.js
import { CreditCard, CheckCircle, Smartphone, Loader2, Zap, ArrowUpRight } from 'lucide-react';

export default function CreditTopup() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [selectedPlan, setSelectedPlan] = React.useState(null);
  const [plans, setPlans] = React.useState([]);
  const [requests, setRequests] = React.useState([]); // New State
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [methods, setMethods] = React.useState([]);
  const [selectedMethod, setSelectedMethod] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [submissionData, setSubmissionData] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);
  const [successData, setSuccessData] = React.useState(null); 

  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE}${path}`;
  };

  React.useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [plansRes, methodsRes, requestsRes] = await Promise.all([
          api.getCreditPlans(token),
          api.getCreditTopupMethods(token),
          api.getMyCreditTopupRequests(token)
        ]);
        setPlans(plansRes.data || []);
        setMethods(methodsRes.data || []);
        setRequests(requestsRes.data || []);
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    if (token) init();
  }, [token]);

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowModal(true);
    setSubmissionData({});
    setSelectedMethod(null);
    setSuccessData(null);
  };

  const handleFileChange = async (label, file) => {
     if (!file) return;
     try {
       const res = await api.uploadPaymentPageImage(token, file);
       if (res && res.url) {
          setSubmissionData(prev => ({ ...prev, [label]: res.url }));
       }
     } catch (e) {
       alert('File upload failed');
     }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMethod) return alert('Select payment method');
    
    const missing = selectedMethod.fields.filter(f => f.required && !submissionData[f.label]);
    if (missing.length > 0) return alert(`Please fill ${missing[0].label}`);

    setSubmitting(true);
    try {
      await api.submitCreditTopupRequest(token, {
        planId: selectedPlan._id,
        methodId: selectedMethod._id,
        methodName: selectedMethod.name,
        submissionData
      });
      
      setSuccessData({
        plan: selectedPlan,
        method: selectedMethod,
        data: submissionData
      });
      setShowModal(false);
      
      const res = await api.getMyCreditTopupRequests(token);
      setRequests(res.data || []);
      
    } catch (err) {
      alert(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
           <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
             আপনার <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">প্যাকেজটি বেছে নিন</span>
           </h1>
           <p className="text-lg text-gray-600 max-w-2xl mx-auto">
             খুব সহজেই ক্রেডিট লিমিট প্যাকেজ কিনে আপনার ব্যবসা শুরু করুন। পেমেন্ট করার সাথে সাথেই সার্ভিস চালু হয়ে যাবে।
           </p>
        </div>

        {loading ? (
           <div className="flex justify-center items-center h-64">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
           </div>
        ) : error ? (
           <div className="text-center p-10 bg-red-50 rounded-3xl border border-red-100 text-red-600">
              {error}
           </div>
        ) : (
           <>
             {/* Plans Grid */}
              {plans.length === 0 ? (
                 <div className="text-center p-10 bg-white/50 rounded-3xl border border-gray-200 text-gray-600">
                    এই মুহূর্তে কোনো প্যাকেজ পাওয়া যাচ্ছে না।
                 </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {plans.map((plan, i) => (
                     <div key={plan._id || i} className="relative group bg-white/90 backdrop-blur-lg rounded-3xl p-8 border border-gray-100 shadow-xl hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] hover:-translate-y-2 transition-all duration-300 flex flex-col">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-t-3xl" />
                        
                        <div className="flex justify-between items-start mb-6">
                           <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl group-hover:scale-110 transition-transform">
                              {plan.name.charAt(0)}
                           </div>
                           {i === 1 && ( 
                             <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-full">
                                জনপ্রিয় প্যাকেজ
                             </span>
                           )}
                        </div>

                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                           <span className="text-4xl font-black text-gray-900">৳{plan.creditAmount?.toLocaleString()}</span>
                           <span className="text-gray-500 font-medium">ক্রেডিট</span>
                        </div>

                        <div className="space-y-4 mb-8 flex-1">
                           <div className="flex items-center gap-3 text-gray-600">
                              <div className="p-1 rounded-full bg-rose-100 text-rose-500">
                                 <CheckCircle size={14} />
                              </div>
                               <span className="text-sm font-medium">
                                সর্বনিম্ন ব্যালেন্স প্রয়োজন: <span className="font-bold text-gray-900">৳{plan.minimumCredit?.toLocaleString() || 0}</span>
                               </span>
                           </div>

                           <div className="flex items-center gap-3 text-gray-600">
                              <div className="p-1 rounded-full bg-emerald-100 text-emerald-600">
                                 <CheckCircle size={14} />
                              </div>
                               <span className="text-sm font-medium">
                                কমিশন: <span className="font-bold text-gray-900">
                                  {plan.commissionType === 'percentage' ? `${plan.commission}%` : `৳${plan.commission}`}
                                </span>
                               </span>
                           </div>

                           <div className="flex items-center gap-3 text-gray-600">
                              <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                                 <CheckCircle size={14} />
                              </div>
                               <span className="text-sm font-medium">সাথে সাথেই চালু হবে</span>
                           </div>
                           
                           {plan.description && (
                              <div className="flex items-center gap-3 text-gray-600 border-t border-gray-100 pt-3 mt-2">
                                 <div className="p-1 rounded-full bg-indigo-100 text-indigo-600">
                                    <Zap size={14} />
                                 </div>
                                 <span className="text-sm font-medium leading-normal text-gray-500">{plan.description}</span>
                              </div>
                           )}

                           {plan.details && plan.details.length > 0 && (
                              <div className="space-y-3 border-t border-gray-100 pt-4 mt-2">
                                 {plan.details.map((detail, idx) => (
                                    <div key={idx} className="flex items-start gap-3 text-gray-600">
                                       <div className="p-1 rounded-full bg-indigo-50 text-indigo-600 mt-0.5 shrink-0">
                                          <Zap size={10} className="fill-current" />
                                       </div>
                                       <span className="text-sm font-medium leading-tight">{detail}</span>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>

                        <button 
                          onClick={() => handleSelectPlan(plan)}
                          className="relative w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                          <span className="relative z-10 flex items-center justify-center gap-2">
                             প্যাকেজ কিনুন <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          </span>
                        </button>
                     </div>
                   ))}
                </div>
             )}

             {/* Recent Requests Section Removed (Moved to CreditHistory page) */}
           </>
        )}
      </div>

      {/* Payment Modal */}
      {showModal && selectedPlan && !successData && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md z-50 transition-opacity">
            <style>{`
              @keyframes slideUpFade {
                from { opacity: 0; transform: translateY(30px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .animate-slideUpFade {
                animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
              @keyframes popIn {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .animate-popIn {
                animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}</style>
            <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slideUpFade">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                  <div>
                     <h2 className="text-xl sm:text-2xl font-bold text-gray-900">প্যাকেজ পারচেস করুন</h2>
                     <p className="text-sm text-gray-500">{selectedPlan.name} - ৳{selectedPlan.creditAmount}</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                     <CreditCard size={20} />
                  </button>
               </div>

               <div className="p-6 space-y-8">
                  {/* Step 1: Select Method */}
                  <div>
                     <h3 className="font-bold text-gray-800 mb-4 text-lg">১. পেমেন্ট মেথড সিলেক্ট করুন</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {methods.length === 0 && (
                           <div className="col-span-full text-center p-4 bg-gray-50 rounded-xl text-gray-500">
                              এখন কোনো পেমেন্ট মেথড চালু নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।
                           </div>
                        )}
                        {methods.map(m => (
                           <button
                             key={m._id}
                             onClick={() => { setSelectedMethod(m); setSubmissionData({}); }}
                             className={`p-4 rounded-xl border transition-all text-center flex flex-col items-center gap-2 relative overflow-hidden group ${
                                selectedMethod?._id === m._id 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-md' 
                                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                             }`}
                           >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-1 ${selectedMethod?._id === m._id ? 'bg-white' : 'bg-gray-100 group-hover:bg-white transition-colors'}`}>
                                 {m.image ? <img src={getImageUrl(m.image)} alt={m.name} className="h-6 object-contain" /> : <CreditCard size={20} className="text-gray-400" />}
                              </div>
                              <span className="font-bold text-sm leading-tight">{m.name}</span>
                              {selectedMethod?._id === m._id && (
                                <div className="absolute top-2 right-2 text-indigo-600">
                                   <CheckCircle size={14} className="fill-current" />
                                </div>
                              )}
                           </button>
                        ))}
                     </div>
                  </div>

                  {selectedMethod && (
                     <form onSubmit={handleSubmit} className="space-y-6 animate-popIn mt-6">
                        {/* Instructions & Inputs ... (Same as before) */}
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-inner">
                           <h4 className="font-bold mb-3 flex items-center gap-2 text-indigo-900 text-lg">
                             <div className="p-1 rounded bg-indigo-200 text-indigo-700"><Zap size={14} /></div>
                             কীভাবে পেমেন্ট করবেন?
                           </h4>
                           <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-medium">
                              {selectedMethod.details}
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h4 className="font-bold text-gray-800 text-lg">২. পেমেন্ট এর তথ্য দিন</h4>
                           <div className="grid gap-4">
                              {selectedMethod.fields.map((field, idx) => (
                                 <div key={idx} className="group">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                       {field.label} {field.required && <span className="text-rose-500">*</span>}
                                    </label>
                                    {field.inputType === 'file' ? (
                                       <div className="relative">
                                          <input 
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => handleFileChange(field.label, e.target.files?.[0])}
                                             className="w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all border border-gray-200 rounded-xl cursor-pointer"
                                             required={field.required}
                                          />
                                       </div>
                                    ) : (
                                       <input
                                          type={field.inputType}
                                          value={submissionData[field.label] || ''}
                                          onChange={(e) => setSubmissionData(prev => ({ ...prev, [field.label]: e.target.value }))}
                                          className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                                          placeholder={`Enter ${field.label}`}
                                          required={field.required}
                                       />
                                    )}
                                 </div>
                              ))}
                           </div>
                        </div>

                        <button 
                           type="submit"
                           disabled={submitting}
                           className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 hover:shadow-xl hover:shadow-gray-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                           {submitting ? <Loader2 className="animate-spin" /> : 'রিকোয়েস্ট সাবমিট করুন'}
                        </button>
                     </form>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* Success Modal */}


      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative animate-in zoom-in-95 duration-300">
              <div className="text-center">
                 {/* Success Animation */}
                 <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-emerald-600 animate-bounce" />
                 </div>
                 
                 <h2 className="text-2xl font-black text-gray-900 mb-2">রিকোয়েস্ট পাঠানো হয়েছে!</h2>
                 <p className="text-gray-500 mb-8">আপনার প্যাকেজ কেনার রিকোয়েস্টটি সফলভাবে অ্যাডমিনের কাছে পাঠানো হয়েছে। খুব দ্রুতই তা অ্যাপ্রুভ হয়ে যাবে।</p>

                 {/* Receipt/Details Card */}
                 <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-left space-y-4 mb-8">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                       <span className="text-gray-500 text-sm">প্যাকেজের নাম</span>
                       <span className="font-bold text-gray-900">{successData.plan.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                       <span className="text-gray-500 text-sm">ক্রেডিট ব্যালেন্স</span>
                       <span className="font-bold text-indigo-600">৳{successData.plan.creditAmount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                       <span className="text-gray-500 text-sm">কমিশন</span>
                       <span className="font-bold text-emerald-600">
                         {successData.plan.commissionType === 'percentage' 
                           ? `${successData.plan.commission}%` 
                           : `৳${successData.plan.commission}`}
                       </span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-gray-500 text-sm">পেমেন্ট মেথড</span>
                       <span className="font-bold text-gray-900 flex items-center gap-2">
                         {successData.method.image && (
                           <img src={getImageUrl(successData.method.image)} alt="" className="w-4 h-4 object-contain" />
                         )}
                         {successData.method.name}
                       </span>
                    </div>
                 </div>

                 <button 
                   onClick={() => setSuccessData(null)}
                   className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                 >
                   ফিরে যান
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
