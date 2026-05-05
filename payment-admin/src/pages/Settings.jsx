import React, { useEffect, useState } from 'react'
import { Wrench, Sliders, Shield, Database, Cloud, Save, Phone, Plus, X, Loader2 } from 'lucide-react'
import api from '../lib/api' // Make sure api is imported
import { useAuthStore } from '../store/authStore'

export default function Settings(){
  const [active, setActive] = useState('general')
  const token = useAuthStore(s => s.token)
  
  const [numbers, setNumbers] = useState([])
  const [newNumber, setNewNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if(active === 'general') {
      fetchNumbers();
    }
  }, [active])

  const fetchNumbers = async () => {
    try {
      setLoading(true)
      const res = await api.getAdminNotificationNumbers(token)
      if (res?.success) {
        setNumbers(res.numbers || [])
      }
    } catch (error) {
      console.error("Failed to load numbers", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddNumber = (e) => {
    e.preventDefault();
    if (!newNumber.trim()) return;
    if (numbers.includes(newNumber.trim())) {
      alert("Number already added");
      return;
    }
    setNumbers([...numbers, newNumber.trim()]);
    setNewNumber('');
  }

  const handleRemoveNumber = (index) => {
    const newArr = [...numbers];
    newArr.splice(index, 1);
    setNumbers(newArr);
  }

  const handleSaveNumbers = async () => {
    try {
      setSaving(true)
      const res = await api.setAdminNotificationNumbers(token, numbers)
      if (res?.success) {
         alert("Notification numbers updated successfully!");
      }
    } catch (error) {
      alert("Failed to save: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
     { id: 'general', label: 'General', icon: Sliders },
     { id: 'security', label: 'Security', icon: Shield },
     { id: 'database', label: 'Database', icon: Database },
     { id: 'cloud', label: 'Cloud Resources', icon: Cloud },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-slate-800/50 via-gray-800/50 to-transparent p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Wrench className="w-8 h-8 text-slate-400" />
             <span className="bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">
               System Settings
             </span>
          </h2>
          <p className="text-base text-slate-400 mt-2 max-w-xl">
             Configure global platform parameters, security policies, and resource connections.
          </p>
        </div>
      </div>

       {/* Tabs */}
       <div className="flex flex-wrap items-center gap-2 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-6 py-2.5 rounded-xl flex items-center gap-2.5 font-bold text-sm transition-all duration-300 ${
              active === tab.id 
              ? 'bg-slate-700 text-white shadow-lg shadow-black/40' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {active === 'general' ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-2xl">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                 <Phone size={20} />
              </div>
              <div>
                 <h3 className="text-xl font-bold text-white">Admin Notification Numbers</h3>
                 <p className="text-sm text-slate-400">Receive SMS alerts when Agents or Merchants request a Top-Up.</p>
              </div>
           </div>

           {loading ? (
             <div className="flex justify-center p-6"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
           ) : (
             <div className="space-y-6">
               <div className="flex flex-wrap gap-3">
                 {numbers.length === 0 && <p className="text-slate-500 italic text-sm">No numbers added yet.</p>}
                 {numbers.map((num, i) => (
                   <div key={i} className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-full shadow-sm">
                      <span className="text-slate-200 font-mono text-sm">{num}</span>
                      <button onClick={() => handleRemoveNumber(i)} className="text-slate-500 hover:text-rose-400 transition-colors">
                        <X size={14} />
                      </button>
                   </div>
                 ))}
               </div>

               <form onSubmit={handleAddNumber} className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Enter phone number (e.g. 017XXXXXXXX)"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white px-5 rounded-xl font-bold flex items-center gap-2 transition-colors">
                    <Plus size={18} /> Add
                  </button>
               </form>

               <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button 
                    onClick={handleSaveNumbers} 
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save size={18} />} 
                    Save Settings
                  </button>
               </div>
             </div>
           )}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
           <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse">
              <Wrench className="w-10 h-10 text-slate-600" />
           </div>
           <h3 className="text-xl font-bold text-white mb-2">Settings Module Coming Soon</h3>
           <p className="text-slate-500 max-w-md mx-auto">
              We are currently building advanced configuration tools for system administrators. Check back later for updates.
           </p>
        </div>
      )}
    </div>
  )
}
