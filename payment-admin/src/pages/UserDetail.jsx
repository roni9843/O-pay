import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { listUsers, addBalance, getSubscriptionPlans, purchaseUserSubscription, getUserSubscriptionsAdmin, updateSubscriptionAdmin } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { User as UserIcon, Wallet, Activity, CalendarClock, Globe2, Loader2, Edit2, X, Check, Power, AlertTriangle } from 'lucide-react'

export default function UserDetail() {
  const { id } = useParams()
  const token = useAuthStore(s => s.token)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('inc')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [userSubs, setUserSubs] = useState([])
  const [subForm, setSubForm] = useState({ planId: '', durationMonths: 1, domain: '' })
  const [subSaving, setSubSaving] = useState(false)
  const [subError, setSubError] = useState('')

  // Edit Subscription State
  const [editingSub, setEditingSub] = useState(null)
  const [editForm, setEditForm] = useState({ endDate: '', active: true })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadUser() {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const res = await listUsers(token, { page: 1, limit: 200 })
        const found = (res.data || []).find(u => u._id === id)
        if (!ignore) {
          setUser(found || null)
          if (!found) setError('User not found in the system')
        }
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load user details')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    async function loadPlans() {
      try {
        setPlansLoading(true)
        const res = await getSubscriptionPlans()
        if (!ignore) setPlans(res || [])
      } catch (e) {
        // silent fail or log
      } finally {
        if (!ignore) setPlansLoading(false)
      }
    }

    loadUser()
    loadPlans()
    loadUserSubs() // call explicitly

    return () => { ignore = true }
  }, [id, token])

  async function loadUserSubs() {
    if (!token) return
    try {
      const res = await getUserSubscriptionsAdmin(token, id)
      setUserSubs(res.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setActionError('')
    const num = Number(amount)
    if (!Number.isFinite(num) || num === 0) {
      setActionError('Please enter a valid amount')
      return
    }
    try {
      setSaving(true)
      await addBalance(token, id, num, mode === 'set' ? 'set' : undefined)

      // refresh
      const res = await listUsers(token, { page: 1, limit: 200 })
      const found = (res.data || []).find(u => u._id === id)
      if (found) setUser(found)
      setAmount('')
    } catch (err) {
      setActionError(err.message || 'Balance update failed')
    } finally {
      setSaving(false)
    }
  }

  async function handlePurchaseSubscription(e) {
    e.preventDefault()
    setSubError('')
    if (!subForm.planId || !subForm.domain.trim()) {
      setSubError('Please select a plan and enter a domain')
      return
    }
    try {
      setSubSaving(true)
      await purchaseUserSubscription(token, id, {
        planId: subForm.planId,
        durationMonths: Number(subForm.durationMonths) || 1,
        domain: subForm.domain.trim(),
      })

      // refresh user & subs
      const res = await listUsers(token, { page: 1, limit: 200 })
      const found = (res.data || []).find(u => u._id === id)
      if (found) setUser(found)
      
      await loadUserSubs()

      setSubForm({ planId: '', durationMonths: 1, domain: '' })
    } catch (err) {
      setSubError(err.message || 'Failed to assign subscription')
    } finally {
      setSubSaving(false)
    }
  }

  // Edit Subscription Handlers
  const openEditSub = (sub) => {
    setEditingSub(sub)
    setEditForm({
      endDate: sub.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : '',
      active: sub.active
    })
  }

  const closeEditSub = () => {
    setEditingSub(null)
    setEditForm({ endDate: '', active: true })
  }

  const saveSubscriptionEdit = async () => {
    if (!editingSub) return
    try {
      setEditSaving(true)
      await updateSubscriptionAdmin(token, editingSub._id, {
        endDate: editForm.endDate,
        active: editForm.active
      })
      
      await loadUserSubs()
      
      // Also refresh user to update main profile subscription text if needed (though user.subscription might be simplified)
      const res = await listUsers(token, { page: 1, limit: 200 })
      const found = (res.data || []).find(u => u._id === id)
      if (found) setUser(found)

      closeEditSub()
    } catch (err) {
      alert(err.message || 'Failed to update subscription')
    } finally {
      setEditSaving(false)
    }
  }


  const subscription = user?.subscription
  let daysLeft = null
  let isExpired = false
  if (subscription?.endDate) {
    const end = new Date(subscription.endDate)
    const diff = end.getTime() - Date.now()
    isExpired = diff <= 0
    daysLeft = isExpired ? 0 : Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const subsByPlanId = new Map()
  if (Array.isArray(userSubs)) {
    userSubs.forEach(sub => {
      const rawPlanId = sub.plan && (sub.plan._id || sub.plan)
      if (!rawPlanId || !sub.endDate) return
      const planId = String(rawPlanId)
      const existing = subsByPlanId.get(planId)
      const end = new Date(sub.endDate)
      // prefer showing active ones, or latest endDate
      if (!existing || end > new Date(existing.endDate)) {
        subsByPlanId.set(planId, sub)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-700 flex items-center justify-center shadow-lg shadow-violet-500/20 text-white">
             {user?.name?.[0]?.toUpperCase() || <UserIcon className="h-7 w-7" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
               {user?.name || 'User Profile'}
            </h2>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
              <span className="bg-white/10 px-2 py-0.5 rounded text-xs">{id}</span>
              <span>•</span>
              <span>Manage balance & access</span>
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 shadow-xl backdrop-blur-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
           <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
           <p>Loading user profile...</p>
        </div>
      ) : user ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Profile & Balance */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Profile Overview Card */}
            <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-black/20">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  Profile Overview
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <InfoItem label="Email" value={user.email} mono />
                  <InfoItem label="Role" value={user.role} badge role={user.role} />
                  <InfoItem label="Current Balance" value={`৳${(user.balance ?? 0).toFixed(2)}`} accent="emerald" size="lg" />
                  <InfoItem label="Verified Volume" value={`৳${(user.verifiedAmount ?? 0).toFixed(2)}`} accent="violet" />
                  <InfoItem label="Active Devices" value={user.devicesCount ?? 0} />
                  <InfoItem label="Total Payments" value={user.verifiedPayments ?? 0} />
                </div>

                {subscription && (
                  <div className="mt-8 p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-blue-500/5 border border-violet-500/20">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/20 rounded-lg text-violet-300">
                          <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{subscription.planName}</h4>
                          <p className="text-xs text-slate-400">
                            Expires {new Date(subscription.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isExpired
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                        {isExpired ? 'Expired' : `${daysLeft} days remaining`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Adjust Balance Card */}
            <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-black/20">
                 <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-400" />
                  Adjust Balance
                </h4>
              </div>
              <div className="p-6">
                <form onSubmit={submit} className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
                    />
                  </div>

                  <div className="w-full sm:w-48 space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Type</label>
                    <select
                      value={mode}
                      onChange={e => setMode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    >
                      <option value="inc">Add (+)</option>
                      <option value="dec">Subtract (-)</option> 
                      <option value="set">Set Exact</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !amount}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 whitespace-nowrap"
                  >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Update'}
                  </button>
                </form>
                {actionError && (
                  <p className="mt-3 text-rose-400 text-sm font-medium bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 inline-block">{actionError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Subscription & History */}
          <div className="space-y-6">
            
            {/* Assign Subscription */}
            <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden">
               <div className="p-6 border-b border-white/5 bg-black/20">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-sky-400" />
                  Subscription
                </h4>
              </div>
              <div className="p-6">
                <form onSubmit={handlePurchaseSubscription} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Plan</label>
                    <select
                      value={subForm.planId}
                      onChange={e => setSubForm(f => ({ ...f, planId: e.target.value }))}
                      disabled={plansLoading || plans.length === 0}
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all"
                    >
                      <option value="">Choose a plan...</option>
                      {plans.map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.pricing?.monthly} BDT/mo)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</label>
                      <select
                        value={subForm.durationMonths}
                        onChange={e => setSubForm(f => ({ ...f, durationMonths: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all text-sm"
                      >
                        <option value={1}>1 Month</option>
                        <option value={6}>6 Months</option>
                        <option value={12}>1 Year</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Domain</label>
                      <input
                        type="text"
                        value={subForm.domain}
                        onChange={e => setSubForm(f => ({ ...f, domain: e.target.value }))}
                        placeholder="example.com"
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {subError && <p className="text-rose-400 text-xs">{subError}</p>}

                  <button
                    type="submit"
                    disabled={subSaving || !subForm.planId || !subForm.domain}
                     className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-sky-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {subSaving ? 'Processing...' : 'Assign Plan'}
                  </button>
                </form>
              </div>
            </div>

            {/* Available Plans List */}
            {plans.length > 0 && (
              <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden flex flex-col max-h-[600px]">
                <div className="p-6 border-b border-white/5 bg-black/20">
                  <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Available Plans</h4>
                </div>
                <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar">
                  {plans.map(plan => {
                    const activeSub = subsByPlanId.get(String(plan._id))
                    let planDaysLeft = null
                    let planExpired = false
                    let planEndDate = null

                    if (activeSub && activeSub.endDate) {
                      planEndDate = activeSub.endDate
                      const end = new Date(activeSub.endDate)
                      const diff = end.getTime() - Date.now()
                      planExpired = diff <= 0
                      planDaysLeft = planExpired ? 0 : Math.ceil(diff / (1000 * 60 * 60 * 24))
                    }

                    return (
                      <PlanCard
                        key={plan._id}
                        plan={plan}
                        isCurrent={!!activeSub}
                        daysLeft={planDaysLeft}
                        isExpired={planExpired}
                        endDate={planEndDate}
                        onEdit={() => openEditSub(activeSub)}
                        activeSub={activeSub} // pass full obj including active status
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-12 text-center text-slate-400">
          User not found.
        </div>
      )}
      
      {/* Edit Subscription Modal */}
      <AnimatePresence>
        {editingSub && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              className="w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Manage Subscription</h3>
                <button onClick={closeEditSub} className="text-slate-400 hover:text-white transition"><X className="w-6 h-6"/></button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiration Date</label>
                  <input 
                    type="date" 
                    value={editForm.endDate} 
                    onChange={e => setEditForm({...editForm, endDate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                  <p className="text-xs text-slate-500">Change the date to extend or shorten the plan.</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${editForm.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      <Power className="w-5 h-5"/>
                    </div>
                    <div>
                      <div className="font-bold text-white">Subscription Status</div>
                      <div className="text-xs text-slate-400">{editForm.active ? 'Active and Running' : 'Deactivated / Suspended'}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditForm({...editForm, active: !editForm.active})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${editForm.active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-black/20 flex gap-3">
                <button onClick={closeEditSub} className="flex-1 py-3 rounded-xl font-bold text-slate-300 hover:bg-white/5 transition">Cancel</button>
                <button 
                  onClick={saveSubscriptionEdit} 
                  disabled={editSaving}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-900/20 disabled:opacity-50 transition"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function InfoItem({ label, value, mono = false, accent, badge, role, size = 'base' }) {
  let className = "text-white font-medium break-all"
  if (accent === 'emerald') className = "text-emerald-400 font-bold"
  if (accent === 'violet') className = "text-violet-400 font-bold"
  
  if (size === 'lg') className += " text-2xl"
  else if (size === 'base') className += " text-base"

  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      {badge ? (
        <span
          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
            role === 'admin' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
              role === 'wallet_agent' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
        >
          {value}
        </span>
      ) : (
        <div className={`${mono ? 'font-mono' : ''} ${className}`}>
          {value}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, isCurrent = false, daysLeft = null, isExpired = false, endDate, onEdit, activeSub }) {
  if (!plan) return null

  const colorMap = {
    green: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/10' },
    blue: { border: 'border-sky-500/20', bg: 'bg-sky-500/5', text: 'text-sky-400', badge: 'bg-sky-500/10' },
    red: { border: 'border-rose-500/20', bg: 'bg-rose-500/5', text: 'text-rose-400', badge: 'bg-rose-500/10' },
  }

  const colors = colorMap[plan.color] || colorMap.blue
  const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString() : null
  
  // Override status colors if explicitly inactive
  const isInactive = activeSub && activeSub.active === false
  const statusColor = isInactive 
    ? { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400', label: 'INACTIVE' }
    : isExpired 
      ? { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', label: 'EXPIRED' }
      : { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', label: 'ACTIVE' }

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 transition-all hover:border-white/20 relative group`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 ${colors.badge} ${colors.text}`}>
            {plan.name}
          </span>
          <div className="text-lg font-bold text-white leading-none">
            ৳{plan.pricing?.monthly?.toLocaleString() ?? '—'}
            <span className="text-xs font-normal text-slate-500 ml-0.5">/mo</span>
          </div>
        </div>
        
        {isCurrent && (
           <div className="flex flex-col items-end gap-1">
             <div className={`text-[10px] font-bold px-2 py-1 rounded border ${statusColor.bg} ${statusColor.border} ${statusColor.text}`}>
                {statusColor.label}
             </div>
             {onEdit && (
               <button 
                 onClick={onEdit}
                 className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/5 transition"
               >
                 <Edit2 className="w-3 h-3"/> Manage
               </button>
             )}
           </div>
        )}
      </div>

      <div className="space-y-1.5 pt-3 border-t border-white/5">
        <div className="flex justify-between text-xs">
           <span className="text-slate-500">Domains</span>
           <span className="text-slate-300 font-mono">{plan.features?.domain ?? 0}</span>
        </div>
        <div className="flex justify-between text-xs">
           <span className="text-slate-500">Devices</span>
           <span className="text-slate-300 font-mono">{plan.features?.devices ?? 0}</span>
        </div>
      </div>

      {isCurrent && formattedEndDate && !isExpired && !isInactive && (
        <div className="mt-3 text-[10px] text-center bg-white/5 rounded py-1 text-slate-400">
           Expires: {formattedEndDate}
        </div>
      )}
    </div>
  )
}
