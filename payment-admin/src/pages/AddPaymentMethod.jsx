import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Smartphone, CreditCard, Save, Loader2, User, Phone, Server, Trash2, Edit2, X } from 'lucide-react'
import { listUsers, getUserDevicesAdmin, addPaymentMethodAdmin, getUserPaymentMethodsAdmin, deletePaymentMethodAdmin, updatePaymentMethodAdmin } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function AddPaymentMethod() {
  const token = useAuthStore(s => s.token)
  
  // Data states
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [devices, setDevices] = useState([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  
  // Existing methods state
  const [methods, setMethods] = useState([])
  const [loadingMethods, setLoadingMethods] = useState(false)
  
  // Form states
  const [selectedUser, setSelectedUser] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [form, setForm] = useState({
    deviceId: '',
    provider: 'bkash',
    accountNumber: '',
    simIndex: 1,
    gateway: 'personal',
    status: 'active'
  })
  
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // Load users on mount
  useEffect(() => {
    async function fetchUsers() {
      setLoadingUsers(true)
      try {
        const res = await listUsers(token, { page: 1, limit: 200 })
        setUsers(res.data || [])
      } catch (err) {
        console.error("Failed to load users", err)
      } finally {
        setLoadingUsers(false)
      }
    }
    if (token) fetchUsers()
  }, [token])

  // Load devices and methods when user is selected
  useEffect(() => {
    async function fetchData() {
      if (!selectedUser) {
        setDevices([])
        setMethods([])
        return
      }
      setLoadingDevices(true)
      setLoadingMethods(true)
      try {
        const [devRes, methRes] = await Promise.all([
           getUserDevicesAdmin(token, selectedUser),
           getUserPaymentMethodsAdmin(token, selectedUser)
        ])
        setDevices(devRes.data || [])
        setMethods(methRes.data || [])
        
        // Reset form if not editing
        if (!editingId) {
            setForm(f => ({ ...f, deviceId: '' }))
        }
      } catch (err) {
        console.error("Failed to load user data", err)
        setDevices([])
        setMethods([])
      } finally {
        setLoadingDevices(false)
        setLoadingMethods(false)
      }
    }
    fetchData()
  }, [selectedUser, token])

  const handleEdit = (method) => {
    setEditingId(method._id)
    setForm({
        deviceId: method.device?._id || method.device,
        provider: method.provider,
        accountNumber: method.accountNumber,
        simIndex: method.simIndex,
        gateway: method.gateway,
        status: method.status
    })
    setMessage({ type: '', text: '' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm({
        deviceId: '',
        provider: 'bkash',
        accountNumber: '',
        simIndex: 1,
        gateway: 'personal',
        status: 'active'
    })
    setMessage({ type: '', text: '' })
  }

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this payment method?")) return;
    
    try {
        await deletePaymentMethodAdmin(token, id)
        // Refresh
        const updatedMethods = await getUserPaymentMethodsAdmin(token, selectedUser)
        setMethods(updatedMethods.data || [])
        setMessage({ type: 'success', text: 'Deleted successfully' })
    } catch (err) {
        alert(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (!selectedUser || !form.deviceId || !form.accountNumber) {
        setMessage({ type: 'error', text: 'Please fill all required fields.' })
        return
    }

    if (!/^01[3-9]\d{8}$/.test(form.accountNumber)) {
        setMessage({ type: 'error', text: 'Invalid phone number format. Must be 11 digits starting with 01.' })
        return
    }

    setSaving(true)
    try {
      if (editingId) {
        // Update
        await updatePaymentMethodAdmin(token, editingId, { ...form })
        setMessage({ type: 'success', text: 'Payment method updated successfully!' })
        handleCancelEdit() 
      } else {
        // Add
        await addPaymentMethodAdmin(token, {
            userId: selectedUser,
            ...form
        })
        setMessage({ type: 'success', text: 'Payment method added successfully!' })
        setForm(f => ({ ...f, accountNumber: '', deviceId: '' }))
      }

      // Refresh list
      const updatedMethods = await getUserPaymentMethodsAdmin(token, selectedUser)
      setMethods(updatedMethods.data || [])
      
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Operation failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Manage Payment Methods</h1>
          <p className="text-slate-400">Add, Update or Remove payment methods for users directly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ADD / EDIT FORM */}
        <div className={`rounded-3xl border border-white/5 backdrop-blur-xl p-8 shadow-xl transition-colors ${editingId ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-white/5'}`}>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5 text-indigo-400"/> : <CreditCard className="w-5 h-5 text-violet-400"/>} 
                {editingId ? 'Edit Payment Method' : 'New Method Details'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* User Selection */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4"/> Select User
                </label>
                <select
                value={selectedUser}
                onChange={e => {
                    if(editingId && !window.confirm("Changing user will cancel current edit. Continue?")) return;
                    handleCancelEdit();
                    setSelectedUser(e.target.value)
                }}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                disabled={loadingUsers || editingId}
                >
                <option value="">-- Choose a User --</option>
                {users.map(u => (
                    <option key={u._id} value={u._id}>
                    {u.name} ({u.email} - {u.role})
                    </option>
                ))}
                </select>
            </div>

            {/* Device Selection */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4"/> Select Device
                </label>
                <select
                value={form.deviceId}
                onChange={e => setForm({ ...form, deviceId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                disabled={!selectedUser || loadingDevices || (editingId && true)}
                >
                <option value="">-- Choose a Device --</option>
                {devices.map(d => (
                    <option key={d._id} value={d._id}>
                    {d.deviceName} ({d.deviceCode || 'Not Activated'})
                    </option>
                ))}
                </select>
                {editingId && <p className="text-[10px] text-slate-500">* Device cannot be changed during edit. Create new entry instead.</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Provider</label>
                    <select
                    value={form.provider}
                    onChange={e => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                    >
                    <option value="bkash">Bkash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                    <option value="upay">Upay</option>
                    </select>
                </div>

                {/* Gateway */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gateway</label>
                    <select
                    value={form.gateway}
                    onChange={e => setForm({ ...form, gateway: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                    >
                    <option value="personal">Personal</option>
                    <option value="merchant">Agent</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account Number */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Phone className="w-4 h-4"/> Account Number
                    </label>
                    <input
                    type="text"
                    value={form.accountNumber}
                    onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                    maxLength={11}
                    />
                </div>

                {/* SIM Index */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">SIM Index</label>
                    <select
                    value={form.simIndex}
                    onChange={e => setForm({ ...form, simIndex: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                    >
                      {(() => {
                        const selectedDevice = devices.find(d => d._id === form.deviceId);
                        // Default to 2 if no plan info found (fallback)
                        let maxSims = 2; 
                        
                        if (selectedDevice?.subscription?.plan?.features?.simNumbers) {
                          const simStr = selectedDevice.subscription.plan.features.simNumbers;
                          // Handle "Unlimited" or numeric string
                          if (simStr.toLowerCase() === 'unlimited') maxSims = 2; 
                          else {
                             const parsed = parseInt(simStr);
                             if (!isNaN(parsed)) maxSims = parsed;
                          }
                        } else if (selectedDevice?.subscription?.featuresSnapshot?.simNumbers) {
                           // Handle snapshot if plan not populated directly
                           const simStr = selectedDevice.subscription.featuresSnapshot.simNumbers;
                           if (simStr.toString().toLowerCase() === 'unlimited') maxSims = 2;
                           else {
                              const parsed = parseInt(simStr);
                              if (!isNaN(parsed)) maxSims = parsed;
                           }
                        }
    
                        return Array.from({ length: maxSims }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>SIM {num}</option>
                        ));
                      })()}
                    </select>
                </div>
            </div>

            {/* Status (Edit Mode Only) */}
            {editingId && (
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                    <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                    >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    </select>
                </div>
            )}

            {/* Messages */}
            {message.text && (
                <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    {message.text}
                </div>
            )}

            {/* Submit Actions */}
            <div className="flex gap-4">
                {editingId && (
                     <button
                     type="button"
                     onClick={handleCancelEdit}
                     className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold transition-all"
                   >
                     <X className="w-5 h-5"/>
                   </button>
                )}
                
                <button
                    type="submit"
                    disabled={saving || !selectedUser || !form.deviceId || !form.accountNumber}
                    className={`flex-1 py-4 rounded-xl text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2
                        ${editingId 
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-900/20'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-900/20'
                        }`}
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : editingId ? <><Save className="w-5 h-5"/> Update Method</> : <><Save className="w-5 h-5"/> Add Payment Method</>}
                </button>
            </div>

            </form>
        </div>

        {/* EXISTING LIST */}
        <div className="space-y-6">
            <div className={`rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-8 shadow-xl min-h-[400px] ${editingId ? 'opacity-50 pointer-events-none' : ''}`}>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-sky-400"/> Existing Payment Methods
                </h2>
                
                {!selectedUser ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <User className="w-12 h-12 mb-3 opacity-20"/>
                        <p>Select a user to view their payment methods</p>
                    </div>
                ) : loadingMethods ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                         <Loader2 className="w-8 h-8 animate-spin mb-3 text-violet-500"/>
                         <p>Loading methods...</p>
                    </div>
                ) : methods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <CreditCard className="w-12 h-12 mb-3 opacity-20"/>
                        <p>No payment methods found for this user.</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {methods.map(m => (
                            <div key={m._id} className="relative group p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/5 hover:border-white/20 transition-all shadow-lg hover:shadow-violet-500/10">
                                
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex items-center gap-4">
                                        {/* Provider Icon */}
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white uppercase text-sm shadow-inner
                                            ${m.provider === 'bkash' ? 'bg-pink-600 shadow-pink-900/50' : 
                                              m.provider === 'nagad' ? 'bg-orange-600 shadow-orange-900/50' : 
                                              m.provider === 'rocket' ? 'bg-purple-600 shadow-purple-900/50' : 'bg-blue-600 shadow-blue-900/50'}`}>
                                            {m.provider.charAt(0)}
                                        </div>
                                        
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                                                {m.provider === 'bkash' ? 'bKash' : m.provider.charAt(0).toUpperCase() + m.provider.slice(1)}
                                            </div>
                                            <div className="font-mono text-xl font-bold text-white tracking-wide">{m.accountNumber}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-slate-300 border border-white/5">
                                                    {m.gateway === 'merchant' ? 'Agent' : 'Personal'}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                                                    SIM {m.simIndex}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm
                                        ${m.status === 'active' 
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                                        {m.status}
                                    </span>
                                </div>

                                {/* Divider */}
                                <div className="h-px w-full bg-white/5 my-4" />

                                <div className="flex justify-between items-center">
                                    {/* Device Info */}
                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                        <Server className="w-3.5 h-3.5 text-slate-500"/>
                                        <span className="font-medium text-slate-300">{m.device?.deviceName || 'Unknown Device'}</span>
                                        <span className="opacity-50">({m.device?.deviceCode || 'No Code'})</span>
                                    </div>

                                    {/* Action Buttons - Always Visible & Styled */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleEdit(m)}
                                            className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 hover:border-indigo-500 transition-all shadow-sm"
                                            title="Edit Payment Method"
                                            type="button"
                                        >
                                            <Edit2 className="w-4 h-4"/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(m._id)}
                                            className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 transition-all shadow-sm"
                                            title="Delete Payment Method"
                                            type="button"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}
