import React, { useEffect, useState } from 'react';
import { getCreditPlans, createCreditPlan, updateCreditPlan, deleteCreditPlan, listUsers, assignCreditPlanToAgent } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Layers, Zap, UserPlus, UserCheck, ShieldCheck } from 'lucide-react';

export default function CreditPlans() {
  const token = useAuthStore((s) => s.token);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Assign Plan to Agent Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    creditAmount: '',
    minimumCredit: '',
    commission: '',
    commissionType: 'fixed',
    autoWithdrawalCommission: '',
    description: '',
    details: [],
    isActive: true,
    isOneTime: false
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

  const openAssignModal = async (plan = null) => {
    if (plan) {
      setSelectedPlanId(plan._id);
    } else if (plans.length > 0) {
      setSelectedPlanId(plans[0]._id);
    }
    setShowAssignModal(true);
    setLoadingAgents(true);
    try {
      const res = await listUsers(token, { page: 1, limit: 200 });
      if (res && res.data) {
        const walletAgents = res.data.filter((u) => u.role === 'wallet_agent');
        setAgentsList(walletAgents);
        if (walletAgents.length > 0) {
          setSelectedAgentId(walletAgents[0]._id);
        }
      }
    } catch (error) {
      console.error("Failed to load agents", error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgentId || !selectedPlanId) {
      alert('Please select both a Wallet Agent and a Credit Plan');
      return;
    }

    setAssigning(true);
    try {
      const res = await assignCreditPlanToAgent(token, {
        userId: selectedAgentId,
        planId: selectedPlanId
      });
      if (res && res.success) {
        alert(res.message || 'Plan assigned successfully!');
        setShowAssignModal(false);
      } else {
        alert(res.message || 'Failed to assign plan');
      }
    } catch (error) {
      alert(error.message || 'Error assigning plan');
    } finally {
      setAssigning(false);
    }
  };

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
      autoWithdrawalCommission: plan.autoWithdrawalCommission || '',
      description: plan.description || '',
      details: plan.details || [],
      isActive: plan.isActive,
      isOneTime: Boolean(plan.isOneTime)
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
      autoWithdrawalCommission: '',
      description: '',
      details: [],
      isActive: true,
      isOneTime: false
    });
  };

  const selectedPlanDetails = plans.find(p => p._id === selectedPlanId);

  return (
    <div className="space-y-6 font-sans">
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
             Manage Top-Up packages for Wallet Agents. Set commission rates, credit limits, and assign plans directly to agents.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button 
            onClick={() => openAssignModal(null)}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-900/40 hover:scale-105 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" /> Assign to Agent
          </button>

          <button 
            onClick={() => { resetForm(); setEditingPlan(null); setShowModal(true); }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Create Plan
          </button>
        </div>
      </div>

      {/* Plans Table */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Plan Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Credit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Min Credit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Commission</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Auto Withdrawal Comm.</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                   <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      Loading plans...
                   </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                   <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                      No credit plans found. Create one to get started.
                   </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                         <span className="font-bold text-white text-base">{plan.name}</span>
                         {plan.isOneTime && (
                           <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                             One-Time Only
                           </span>
                         )}
                       </div>
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
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-mono font-bold">
                         {plan.autoWithdrawalCommission || 0}%
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
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => openAssignModal(plan)}
                           className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                           title="Assign this plan to a Wallet Agent"
                         >
                           <UserPlus className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => openEdit(plan)}
                           className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                           title="Edit Plan"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={() => handleDelete(plan._id)}
                           className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                           title="Delete Plan"
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

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#08081a] border border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 md:p-8 relative my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
             <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                   <XCircle size={22} />
                </button>
             </div>

             <div className="mb-6">
                <span className="inline-block p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3 sm:mb-4">
                   <Layers className="w-6 h-6 text-emerald-400" />
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white">
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

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                 <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Auto Withdrawal Commission (%)</label>
                 <input 
                   type="number" 
                   step="0.01"
                   min="0"
                   value={formData.autoWithdrawalCommission}
                   onChange={e => setFormData({...formData, autoWithdrawalCommission: e.target.value})}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm font-mono"
                   placeholder="e.g. 2.0"
                 />
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
               
               <div className="space-y-3">
                 <label className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors">
                   <input 
                     type="checkbox"
                     id="isOneTime"
                     checked={formData.isOneTime}
                     onChange={e => setFormData({...formData, isOneTime: e.target.checked})}
                     className="w-4 h-4 rounded border-amber-500/20 bg-black/40 text-amber-500 focus:ring-amber-500"
                   />
                   <div>
                     <span className="text-sm font-bold text-amber-300 block">One-Time Package (একবারই কেনা যাবে)</span>
                     <span className="text-[11px] text-slate-400 block">Each Wallet Agent can claim or buy this package only ONCE.</span>
                   </div>
                 </label>

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
               </div>

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

      {/* Assign Credit Plan to Agent Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#08081a] border border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 md:p-8 relative my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
             <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                   <XCircle size={22} />
                </button>
             </div>

             <div className="mb-6">
                <span className="inline-block p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-3 sm:mb-4">
                   <UserPlus className="w-6 h-6 text-violet-400" />
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Assign Credit Plan to Agent
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                   Select a Wallet Agent and directly add a Credit Plan to their profile.
                </p>
             </div>

            <form onSubmit={handleAssignSubmit} className="space-y-5">
               {/* Select Agent */}
               <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Select Wallet Agent</label>
                 {loadingAgents ? (
                   <div className="text-xs text-slate-400 py-3">Loading agents list...</div>
                 ) : agentsList.length === 0 ? (
                   <div className="text-xs text-rose-400 py-2">No Wallet Agents found in system.</div>
                 ) : (
                   <select 
                     value={selectedAgentId}
                     onChange={e => setSelectedAgentId(e.target.value)}
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all text-sm"
                   >
                     {agentsList.map(agent => (
                       <option key={agent._id} value={agent._id} className="bg-[#08081a]">
                         {agent.name} ({agent.email}) — Credit: ৳{agent.credit || 0}
                       </option>
                     ))}
                   </select>
                 )}
               </div>

               {/* Select Plan */}
               <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Select Credit Plan</label>
                 <select 
                   value={selectedPlanId}
                   onChange={e => setSelectedPlanId(e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all text-sm"
                 >
                   {plans.map(plan => (
                     <option key={plan._id} value={plan._id} className="bg-[#08081a]">
                       {plan.name} — Credit: ৳{plan.creditAmount} (+{plan.commission}{plan.commissionType === 'percentage' ? '%' : 'BDT'} Comm.)
                     </option>
                   ))}
                 </select>
               </div>

               {/* Summary Card Preview */}
               {selectedPlanDetails && (
                 <div className="p-4 rounded-2xl bg-violet-950/20 border border-violet-500/30 space-y-2 text-xs">
                   <div className="font-bold text-violet-300 text-sm flex items-center gap-1.5 mb-2">
                     <ShieldCheck className="w-4 h-4 text-violet-400" /> Plan Summary: {selectedPlanDetails.name}
                   </div>
                   <div className="flex justify-between text-slate-300">
                     <span>Base Credit:</span>
                     <span className="font-bold font-mono text-white">৳{selectedPlanDetails.creditAmount}</span>
                   </div>
                   <div className="flex justify-between text-slate-300">
                     <span>Plan Commission:</span>
                     <span className="font-bold font-mono text-indigo-300">
                       {selectedPlanDetails.commission} {selectedPlanDetails.commissionType === 'percentage' ? '%' : 'BDT'}
                     </span>
                   </div>
                   <div className="flex justify-between text-slate-300">
                     <span>Min Credit Added:</span>
                     <span className="font-bold font-mono text-white">৳{selectedPlanDetails.minimumCredit}</span>
                   </div>
                   <div className="flex justify-between text-slate-300 border-t border-violet-500/20 pt-2">
                     <span className="text-teal-300 font-semibold">Auto Withdrawal Commission Rate:</span>
                     <span className="font-bold font-mono text-teal-300">{selectedPlanDetails.autoWithdrawalCommission || 0}%</span>
                   </div>
                 </div>
               )}

               <div className="flex gap-3 pt-2">
                 <button 
                   type="button"
                   onClick={() => setShowAssignModal(false)}
                   className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-colors text-sm"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit"
                   disabled={assigning || !selectedAgentId || !selectedPlanId}
                   className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2"
                 >
                   {assigning ? 'Assigning...' : 'Assign Plan to Agent'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
