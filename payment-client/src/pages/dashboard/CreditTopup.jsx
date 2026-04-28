import React from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api'; // Ensure this uses your updated api.js
import { CreditCard, CheckCircle, Smartphone, Loader2, Zap } from 'lucide-react';

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
             Apply for <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Credit Limit</span>
           </h1>
           <p className="text-lg text-gray-600 max-w-2xl mx-auto">
             Expand your business capability with our flexible credit plans. Instant approval for qualified agents.
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
                <div className="text-center p-10 bg-white/50 rounded-3xl border border-gray-200">
                   No credit plans available at the moment.
                </div>
             ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {plans.map((plan, i) => (
                     <div key={plan._id || i} className="relative group bg-white rounded-3xl p-8 border border-gray-100 shadow-xl hover:shadow-2xl hover:border-indigo-100 transition-all duration-300 flex flex-col">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-t-3xl" />
                        
                        <div className="flex justify-between items-start mb-6">
                           <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl group-hover:scale-110 transition-transform">
                              {plan.name.charAt(0)}
                           </div>
                           {i === 1 && ( 
                             <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-full">
                                Most Popular
                             </span>
                           )}
                        </div>

                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                           <span className="text-4xl font-black text-gray-900">৳{plan.creditAmount?.toLocaleString()}</span>
                           <span className="text-gray-500 font-medium">Credit</span>
                        </div>

                        <div className="space-y-4 mb-8 flex-1">
                           <div className="flex items-center gap-3 text-gray-600">
                              <div className="p-1 rounded-full bg-rose-100 text-rose-500">
                                 <CheckCircle size={14} />
                              </div>
                              <span className="text-sm font-medium">
                                Min Credit Reqd: <span className="font-bold text-gray-900">৳{plan.minimumCredit?.toLocaleString() || 0}</span>
                              </span>
                           </div>

                           <div className="flex items-center gap-3 text-gray-600">
                              <div className="p-1 rounded-full bg-emerald-100 text-emerald-600">
                                 <CheckCircle size={14} />
                              </div>
                              <span className="text-sm font-medium">
                                Commission: <span className="font-bold text-gray-900">
                                  {plan.commissionType === 'percentage' ? `${plan.commission}%` : `৳${plan.commission}`}
                                </span>
                              </span>
                           </div>

                           <div className="flex items-center gap-3 text-gray-600">
                              <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                                 <CheckCircle size={14} />
                              </div>
                              <span className="text-sm font-medium">Instant Activation</span>
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
                          className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-lg hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-200"
                        >
                          Buy
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
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all animate-in slide-in-from-bottom duration-300">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                  <div>
                     <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Credit Plan</h2>
                     <p className="text-sm text-gray-500">{selectedPlan.name} - ৳{selectedPlan.creditAmount}</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                     <CreditCard size={20} />
                  </button>
               </div>

               <div className="p-6 space-y-8">
                  {/* Step 1: Select Method */}
                  <div>
                     <h3 className="font-bold text-gray-800 mb-4 text-lg">1. Select Payment Method</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {methods.length === 0 && (
                           <div className="col-span-full text-center p-4 bg-gray-50 rounded-xl text-gray-500">
                              No payment methods available. Please contact support.
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
                     <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Instructions & Inputs ... (Same as before) */}
                        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                           <h4 className="font-bold mb-3 flex items-center gap-2 text-indigo-900">
                             <div className="p-1 rounded bg-indigo-200 text-indigo-700"><Zap size={14} /></div>
                             Payment Instructions
                           </h4>
                           <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-medium">
                              {selectedMethod.details}
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h4 className="font-bold text-gray-800 text-lg">2. Submit Payment Details</h4>
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
                           {submitting ? <Loader2 className="animate-spin" /> : 'Submit Request'}
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
                 
                 <h2 className="text-2xl font-black text-gray-900 mb-2">Request Submitted!</h2>
                 <p className="text-gray-500 mb-8">Your top-up request has been successfully sent to the admin for approval.</p>

                 {/* Receipt/Details Card */}
                 <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-left space-y-4 mb-8">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                       <span className="text-gray-500 text-sm">Plan Name</span>
                       <span className="font-bold text-gray-900">{successData.plan.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                       <span className="text-gray-500 text-sm">Credit Amount</span>
                       <span className="font-bold text-indigo-600">৳{successData.plan.creditAmount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                       <span className="text-gray-500 text-sm">Commission</span>
                       <span className="font-bold text-emerald-600">
                         {successData.plan.commissionType === 'percentage' 
                           ? `${successData.plan.commission}%` 
                           : `৳${successData.plan.commission}`}
                       </span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-gray-500 text-sm">Payment Method</span>
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
                   Back to Dashboard
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
