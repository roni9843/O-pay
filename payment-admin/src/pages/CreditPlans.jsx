import React, { useEffect, useState } from 'react';
import { getCreditPlans, createCreditPlan, updateCreditPlan, deleteCreditPlan } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Layers, Zap } from 'lucide-react';

export default function CreditPlans() {
  const token = useAuthStore((s) => s.token);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    creditAmount: '',
    minimumCredit: '',
    commission: '',
    commissionType: 'fixed',
    description: '',
    details: [],
    isActive: true
  });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await getCreditPlans();
      if (res && res.data) {
        setPlans(res.data);
      }
    } catch (error) {
      console.error("Failed to load plans", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await updateCreditPlan(token, editingPlan._id, formData);
      } else {
        await createCreditPlan(token, formData);
      }
      setShowModal(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      try {
        await deleteCreditPlan(token, id);
        loadPlans();
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      creditAmount: plan.creditAmount,
      minimumCredit: plan.minimumCredit,
      commission: plan.commission,
      commissionType: plan.commissionType,
      description: plan.description || '',
      details: plan.details || [],
      isActive: plan.isActive
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      creditAmount: '',
      minimumCredit: '',
      commission: '',
      commissionType: 'fixed',
      description: '',
      details: [],
      isActive: true
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
             <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
               Credit Plans
             </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
             Manage Top-Up packages for Wallet Agents. Set commission rates and credit limits.
          </p>
        </div>

        <div className="relative z-10">
          <button 
            onClick={() => { resetForm(); setEditingPlan(null); setShowModal(true); }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Create Plan
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Plan Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Credit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Min Credit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Commission</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                   <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      Loading plans...
                   </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                   <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      No credit plans found. Create one to get started.
                   </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                       <span className="font-bold text-white text-base">{plan.name}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="font-bold text-emerald-400 font-mono">৳{plan.creditAmount}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-slate-300 font-mono">৳{plan.minimumCredit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-bold">
                         {plan.commission} {plan.commissionType === 'percentage' ? '%' : 'BDT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-400">{plan.description || '-'}</td>
                    <td className="px-6 py-4">
                      {plan.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => openEdit(plan)}
                           className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => handleDelete(plan._id)}
                           className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                         >
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
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#050510] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-8 relative">
             <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                   <XCircle size={20} />
                </button>
             </div>

             <div className="mb-6">
                <span className="inline-block p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                   <Layers className="w-6 h-6 text-emerald-400" />
                </span>
                <h2 className="text-xl font-bold text-white">
                  {editingPlan ? 'Edit Credit Plan' : 'Create New Plan'}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                   Configure the details for this top-up package.
                </p>
             </div>

            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Plan Name</label>
                 <input 
                   type="text" 
                   required
                   value={formData.name}
                   onChange={e => setFormData({...formData, name: e.target.value})}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                   placeholder="e.g. Starter Pack"
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Credit Amount</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={formData.creditAmount}
                      onChange={e => setFormData({...formData, creditAmount: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Min Credit</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={formData.minimumCredit}
                      onChange={e => setFormData({...formData, minimumCredit: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm font-mono"
                      placeholder="0.00"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Commission</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={formData.commission}
                      onChange={e => setFormData({...formData, commission: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm font-mono"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Type</label>
                    <select 
                      value={formData.commissionType}
                      onChange={e => setFormData({...formData, commissionType: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
               </div>

              <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Description (Short)</label>
                 <textarea 
                   rows="2"
                   value={formData.description}
                   onChange={e => setFormData({...formData, description: e.target.value})}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm resize-none"
                   placeholder="Brief description..."
                 />
              </div>

              <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Plan Features (One per line)</label>
                 <div className="space-y-2">
                    {formData.details.map((detail, index) => (
                       <div key={index} className="flex gap-2">
                          <input 
                            value={detail}
                            onChange={e => {
                               const newDetails = [...formData.details];
                               newDetails[index] = e.target.value;
                               setFormData({...formData, details: newDetails});
                            }}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                            placeholder="e.g. ✅ Instant Activation"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                               const newDetails = formData.details.filter((_, i) => i !== index);
                               setFormData({...formData, details: newDetails});
                            }}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, details: [...formData.details, '']})}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider flex items-center gap-1 mt-2"
                    >
                       <Plus size={14} /> Add Feature
                    </button>
                 </div>
              </div>
               
               <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                 <input 
                   type="checkbox"
                   id="isActive"
                   checked={formData.isActive}
                   onChange={e => setFormData({...formData, isActive: e.target.checked})}
                   className="w-4 h-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500"
                 />
                 <span className="text-sm font-medium text-white">Active Plan</span>
               </label>

               <div className="flex gap-3 pt-4">
                 <button 
                   type="button"
                   onClick={() => setShowModal(false)}
                   className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-colors text-sm"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit"
                   className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white rounded-xl font-bold transition-all text-sm"
                 >
                   {editingPlan ? 'Save Changes' : 'Create Plan'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
