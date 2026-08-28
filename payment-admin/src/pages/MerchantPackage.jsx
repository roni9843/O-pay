import React, { useEffect, useState } from 'react'
import { 
  Box, 
  Save, 
  Plus, 
  X, 
  Loader2, 
  Edit, 
  Trash2, 
  Users, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  DollarSign, 
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  ArrowRightLeft,
  Check
} from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function MerchantPackage() {
  const token = useAuthStore(s => s.token)
  
  const [packages, setPackages] = useState([])
  const [loadingPkg, setLoadingPkg] = useState(true)
  const [savingPkg, setSavingPkg] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Merchants subscription state
  const [businesses, setBusinesses] = useState([])
  const [loadingBiz, setLoadingBiz] = useState(true)
  const [updatingBizId, setUpdatingBizId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('subscribed') // 'subscribed' | 'all'

  const [formState, setFormState] = useState({
    name: 'Lifetime Activation Package',
    amount: 5000,
    offerDetails: '',
    features: [],
    isActive: true,
    packageType: 'both' // deposit, withdrawal, both
  })
  const [newFeature, setNewFeature] = useState('')

  const fetchData = async () => {
    try {
      setLoadingPkg(true)
      setLoadingBiz(true)

      const [pkgRes, bizRes] = await Promise.all([
        api.getOpayBusinessPackages(token).catch(e => { console.error(e); return null; }),
        api.listOpayBusinesses(token).catch(e => { console.error(e); return null; })
      ])

      if (pkgRes?.success && pkgRes.data) {
        setPackages(pkgRes.data)
      }

      if (bizRes) {
        const list = bizRes.data || (Array.isArray(bizRes) ? bizRes : [])
        setBusinesses(list)
      }
    } catch (error) {
      console.error("Failed to load packages or merchants", error)
    } finally {
      setLoadingPkg(false)
      setLoadingBiz(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchData()
    }
  }, [token])

  const handleSavePackage = async (e) => {
    e.preventDefault();
    try {
      setSavingPkg(true)
      let res;
      if (editingId) {
        res = await api.updateOpayBusinessPackage(token, editingId, formState)
      } else {
        res = await api.createOpayBusinessPackage(token, formState)
      }
      
      if (res?.success) {
        alert(editingId ? "Package updated successfully!" : "Package created successfully!")
        setEditingId(null)
        setFormState({
          name: '',
          amount: 5000,
          offerDetails: '',
          features: [],
          isActive: true,
          packageType: 'both'
        })
        fetchData()
      } else {
        alert("Failed to save: " + (res?.message || "Unknown error"))
      }
    } catch (error) {
      alert("Failed to save package: " + error.message)
    } finally {
      setSavingPkg(false)
    }
  }

  const handleDeletePackage = async (id) => {
    if (!window.confirm("Are you sure you want to delete this package?")) return;
    try {
      const res = await api.deleteOpayBusinessPackage(token, id)
      if (res?.success) {
        alert("Package deleted!")
        fetchData()
      }
    } catch (error) {
      alert("Failed to delete package: " + error.message)
    }
  }

  const handleAssignPackage = async (businessId, packageId) => {
    try {
      setUpdatingBizId(businessId)
      const res = await api.assignOpayBusinessPackage(token, businessId, packageId)
      if (res?.success) {
        alert("মার্চেন্টের প্যাকেজ সফলভাবে আপডেট করা হয়েছে!")
        fetchData()
      } else {
        alert("প্যাকেজ আপডেট করা সম্ভব হয়নি: " + (res?.message || "Unknown error"))
      }
    } catch (error) {
      alert("প্যাকেজ পরিবর্তন ত্রুটি: " + (error.message || "Server error"))
    } finally {
      setUpdatingBizId(null)
    }
  }

  const startEdit = (pkg) => {
    setEditingId(pkg._id)
    setFormState({
      name: pkg.name || '',
      amount: pkg.amount ?? 5000,
      offerDetails: pkg.offerDetails || '',
      features: pkg.features || [],
      isActive: pkg.isActive ?? true,
      packageType: pkg.packageType || 'both'
    })
  }

  const handleAddFeature = (e) => {
    e.preventDefault();
    if (!newFeature.trim()) return;
    setFormState(prev => ({
      ...prev,
      features: [...prev.features, newFeature.trim()]
    }))
    setNewFeature('');
  }

  const handleRemoveFeature = (index) => {
    setFormState(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }))
  }

  // Filter merchants based on selected tab & search term
  const subscribedMerchants = businesses.filter(b => b.isLifetimePaid || b.activePackageId)
  const displayList = activeTab === 'subscribed' ? subscribedMerchants : businesses

  const filteredMerchants = displayList.filter(b => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true
    const nameMatch = (b.name || '').toLowerCase().includes(q)
    const emailMatch = (b.email || '').toLowerCase().includes(q)
    const domainMatch = (b.domain || '').toLowerCase().includes(q)
    return nameMatch || emailMatch || domainMatch
  })

  // Calculate total package revenue
  const totalRevenue = subscribedMerchants.reduce((sum, b) => {
    const matchedPkg = packages.find(p => String(p._id) === String(b.activePackageId)) || packages[0]
    return sum + (matchedPkg?.amount || 5000)
  }, 0)

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-slate-800/80 via-gray-900/80 to-slate-900 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Box className="w-8 h-8 text-indigo-400" />
              <span className="bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Merchant Activation & Package Subscriptions
              </span>
            </h2>
            <p className="text-base text-slate-400 mt-2 max-w-xl">
              নতুন অ্যাক্টিভেশন প্যাকেজ তৈরি করুন, সকল অথবা নির্দিষ্ট মার্চেন্টের প্যাকেজ সরাসরি পরিবর্তন করে দিন।
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-800/80 border border-slate-700/80 px-5 py-3 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">মোট সাবস্ক্রাইবার</span>
                <span className="text-xl font-bold text-white font-mono">{subscribedMerchants.length} মার্চেন্ট</span>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 px-5 py-3 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">প্যাকেজ রেভিনিউ</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">৳{totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Subscribed Merchants List & Package Change Action */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              মার্চেন্ট প্যাকেজ সাবস্ক্রিপশন ও অ্যাসাইনমেন্ট
            </h3>
            <p className="text-xs text-slate-400 mt-1">মার্চেন্টদের কেনা প্যাকেজ দেখুন বা এডমিন হিসেবে যেকোনো মার্চেন্টের প্যাকেজ পরিবর্তন করুন</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs */}
            <div className="bg-slate-900/90 border border-slate-700 p-1 rounded-xl flex gap-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab('subscribed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'subscribed' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                সাবস্ক্রাইবড ({subscribedMerchants.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'all' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                সকল মার্চেন্ট ({businesses.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="মার্চেন্ট বা ইমেইল খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {loadingBiz ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-indigo-400 w-8 h-8" />
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 text-center space-y-2">
            <Building2 className="w-10 h-10 text-slate-500 mx-auto opacity-50" />
            <p className="text-slate-400 text-sm font-semibold">কোনো মার্চেন্ট পাওয়া যায়নি</p>
            <p className="text-slate-500 text-xs">আপনার সার্চের সাথে মিলে এমন কোনো মার্চেন্ট রেকর্ড নেই।</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-700/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/90 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-700/80">
                <tr>
                  <th className="px-5 py-4">মার্চেন্ট তথ্য (Merchant)</th>
                  <th className="px-5 py-4">বর্তমান প্যাকেজ (Package)</th>
                  <th className="px-5 py-4">ফি (Fee)</th>
                  <th className="px-5 py-4">পারমিশন</th>
                  <th className="px-5 py-4">পেমেন্ট স্ট্যাটাস</th>
                  <th className="px-5 py-4 text-center">প্যাকেজ পরিবর্তন (Change Package)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                {filteredMerchants.map((biz) => {
                  const matchedPkg = packages.find(p => String(p._id) === String(biz.activePackageId)) || (biz.isLifetimePaid ? packages[0] : null);
                  const isUpdating = updatingBizId === biz._id;

                  return (
                    <tr key={biz._id} className="hover:bg-slate-800/50 transition-colors">
                      {/* Merchant Details */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                            {(biz.name || 'M')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{biz.name || 'N/A'}</div>
                            <div className="text-slate-400 text-[11px] font-mono">{biz.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Purchased Package */}
                      <td className="px-5 py-4">
                        {matchedPkg ? (
                          <div>
                            <span className="font-bold text-white text-sm flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              {matchedPkg.name}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                              matchedPkg.packageType === 'deposit' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
                              matchedPkg.packageType === 'withdrawal' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                              'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20'
                            }`}>
                              {matchedPkg.packageType === 'both' ? 'Deposit & Withdrawal' : matchedPkg.packageType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">কোনো প্যাকেজ কেনা হয়নি</span>
                        )}
                      </td>

                      {/* Package Fee */}
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          ৳{(matchedPkg?.amount || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Feature Permissions */}
                      <td className="px-5 py-4">
                        {(() => {
                          const isDepositAllowed = biz.allowDeposit || (matchedPkg ? (matchedPkg.packageType === 'both' || matchedPkg.packageType === 'deposit') : biz.isLifetimePaid);
                          const isWithdrawalAllowed = biz.allowAutoWithdrawal || (matchedPkg ? (matchedPkg.packageType === 'both' || matchedPkg.packageType === 'withdrawal') : biz.isLifetimePaid);

                          return (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                isDepositAllowed ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-800 text-slate-500'
                              }`}>
                                Deposit: {isDepositAllowed ? 'ON' : 'OFF'}
                              </span>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                isWithdrawalAllowed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                              }`}>
                                Withdrawal: {isWithdrawalAllowed ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {biz.isLifetimePaid ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5" /> PAID / ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            UNPAID
                          </span>
                        )}
                      </td>

                      {/* Action: Change Package Dropdown */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isUpdating ? (
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                          ) : (
                            <select
                              value={matchedPkg?._id || ''}
                              onChange={(e) => handleAssignPackage(biz._id, e.target.value)}
                              className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer hover:bg-slate-700 transition-all shadow-sm"
                            >
                              <option value="" disabled>-- সিলেক্ট প্যাকেজ --</option>
                              {packages.map((pkg) => (
                                <option key={pkg._id} value={pkg._id}>
                                  {pkg.name} (৳{pkg.amount})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: Package Management & Creation Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Existing Packages List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            উপলব্ধ প্যাকেজ কনফিগারেশন (Existing Packages)
          </h3>
          {loadingPkg ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
          ) : packages.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No packages found.</p>
          ) : (
            <div className="space-y-4">
              {packages.map(pkg => (
                <div key={pkg._id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-white">{pkg.name}</h4>
                      {!pkg.isActive && <span className="bg-rose-500/20 text-rose-400 text-xs px-2 py-0.5 rounded">Disabled</span>}
                      <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded uppercase tracking-wider">{pkg.packageType}</span>
                    </div>
                    <p className="text-xl text-indigo-300 font-mono font-bold mt-1">৳{pkg.amount}</p>
                    <p className="text-slate-400 text-sm mt-2">{pkg.offerDetails}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pkg.features?.slice(0, 3).map((f, i) => (
                         <span key={i} className="text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded-md">{f}</span>
                      ))}
                      {pkg.features?.length > 3 && <span className="text-xs text-slate-500 py-1">+{pkg.features.length - 3} more</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(pkg)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDeletePackage(pkg._id)} className="p-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Package Form */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6 self-start sticky top-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Package' : 'Create New Package'}</h3>
            </div>
            {editingId && (
              <button 
                onClick={() => {
                  setEditingId(null)
                  setFormState({ name: '', amount: 5000, offerDetails: '', features: [], isActive: true, packageType: 'both' })
                }}
                className="text-sm text-slate-400 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSavePackage} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700 rounded-2xl">
              <div>
                <label className="text-sm font-bold text-white block">Active Status</label>
                <span className="text-xs text-slate-400">Is this package available for selection?</span>
              </div>
              <input 
                type="checkbox"
                checked={formState.isActive}
                onChange={(e) => setFormState(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5 accent-indigo-500 rounded border-slate-700 bg-slate-900 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Package Type</label>
              <select
                value={formState.packageType}
                onChange={(e) => setFormState(prev => ({ ...prev, packageType: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="both">Both (Deposit & Withdrawal)</option>
                <option value="deposit">Deposit Only (Payment Gateway)</option>
                <option value="withdrawal">Withdrawal Only (Payout API)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Package Name</label>
              <input 
                type="text"
                value={formState.name}
                onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g. Deposit Activation Package"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Activation Fee (BDT)</label>
              <input 
                type="number"
                value={formState.amount}
                onChange={(e) => setFormState(prev => ({ ...prev, amount: Number(e.target.value) }))}
                required
                min="0"
                placeholder="e.g. 5000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Offer Details / Description</label>
              <textarea 
                value={formState.offerDetails}
                onChange={(e) => setFormState(prev => ({ ...prev, offerDetails: e.target.value }))}
                required
                rows="3"
                placeholder="Description of the offer..."
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
                  placeholder="Enter feature..."
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
                {formState.features.map((feature, i) => (
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
                {formState.features.length === 0 && (
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
                {editingId ? 'Update Package' : 'Create Package'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
