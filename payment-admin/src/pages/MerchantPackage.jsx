import React, { useEffect, useState } from 'react'
import { Box, Save, Plus, X, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function MerchantPackage() {
  const token = useAuthStore(s => s.token)
  
  const [activationPkg, setActivationPkg] = useState({
    name: 'Lifetime Activation Package',
    amount: 5000,
    offerDetails: '',
    features: [],
    isActive: true
  })
  const [newFeature, setNewFeature] = useState('')
  const [loadingPkg, setLoadingPkg] = useState(true)
  const [savingPkg, setSavingPkg] = useState(false)

  const fetchActivationPackage = async () => {
    try {
      setLoadingPkg(true)
      const res = await api.getOpayBusinessPackage(token)
      if (res?.success && res.data) {
        setActivationPkg({
          name: res.data.name || 'Lifetime Activation Package',
          amount: res.data.amount ?? 5000,
          offerDetails: res.data.offerDetails || '',
          features: res.data.features || [],
          isActive: res.data.isActive ?? true
        })
      }
    } catch (error) {
      console.error("Failed to load activation package config", error)
    } finally {
      setLoadingPkg(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchActivationPackage()
    }
  }, [token])

  const handleSaveActivationPackage = async (e) => {
    e.preventDefault();
    try {
      setSavingPkg(true)
      const res = await api.updateOpayBusinessPackage(token, activationPkg)
      if (res?.success) {
        alert("Merchant activation package configuration updated successfully!")
      } else {
        alert("Failed to update: " + (res?.message || "Unknown error"))
      }
    } catch (error) {
      alert("Failed to update activation package: " + error.message)
    } finally {
      setSavingPkg(false)
    }
  }

  const handleAddFeature = (e) => {
    e.preventDefault();
    if (!newFeature.trim()) return;
    setActivationPkg(prev => ({
      ...prev,
      features: [...prev.features, newFeature.trim()]
    }))
    setNewFeature('');
  }

  const handleRemoveFeature = (index) => {
    setActivationPkg(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-slate-800/50 via-gray-800/50 to-transparent p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Box className="w-8 h-8 text-slate-400" />
             <span className="bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">
               Merchant Activation Package
             </span>
          </h2>
          <p className="text-base text-slate-400 mt-2 max-w-xl">
             Configure the lifetime pricing, offers description, features checklist, and status checks for new merchant activations.
          </p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-2xl space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Box size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Configure Package Settings</h3>
            <p className="text-sm text-slate-400">Enable fee checks and customize merchant-facing copy & features.</p>
          </div>
        </div>

        {loadingPkg ? (
          <div className="flex justify-center p-6"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
        ) : (
          <form onSubmit={handleSaveActivationPackage} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700 rounded-2xl">
              <div>
                <label className="text-sm font-bold text-white block">Enable Activation Fee Check</label>
                <span className="text-xs text-slate-400">If unchecked, merchants bypass activation fee checks automatically.</span>
              </div>
              <input 
                type="checkbox"
                checked={activationPkg.isActive}
                onChange={(e) => setActivationPkg(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5 accent-indigo-500 rounded border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Package Name</label>
              <input 
                type="text"
                value={activationPkg.name}
                onChange={(e) => setActivationPkg(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g. Lifetime Activation Package"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Activation Fee (BDT)</label>
              <input 
                type="number"
                value={activationPkg.amount}
                onChange={(e) => setActivationPkg(prev => ({ ...prev, amount: Number(e.target.value) }))}
                required
                min="0"
                placeholder="e.g. 5000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Offer Details / Description</label>
              <textarea 
                value={activationPkg.offerDetails}
                onChange={(e) => setActivationPkg(prev => ({ ...prev, offerDetails: e.target.value }))}
                required
                rows="3"
                placeholder="এককালীন ফি প্রদান করে আজীবন আনলিমিটেড পেমেন্ট লিংক তৈরি করুন।"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-300 block">Package Features</label>
              
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Enter feature (e.g. লাইফটাইম আনলিমিটেড পেমেন্ট লিংক তৈরি)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
                <button 
                  type="button" 
                  onClick={handleAddFeature}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-5 rounded-xl font-bold flex items-center gap-2 transition-colors"
                >
                  <Plus size={18} /> Add
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activationPkg.features.map((feature, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-800/60 border border-slate-700/60 px-4 py-2.5 rounded-xl">
                    <span className="text-slate-300 text-sm">{feature}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveFeature(i)} 
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {activationPkg.features.length === 0 && (
                  <p className="text-slate-500 italic text-xs">No features added yet.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button 
                type="submit" 
                disabled={savingPkg}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {savingPkg ? <Loader2 className="animate-spin w-5 h-5" /> : <Save size={18} />} 
                Save Activation Settings
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
