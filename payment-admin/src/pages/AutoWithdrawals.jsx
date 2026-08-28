import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { 
  listAutoWithdrawals, 
  rejectAutoWithdrawal, 
  getAdminAutoWithdrawalMinBalance, 
  setAdminAutoWithdrawalMinBalance, 
  getAdminMerchantTopupFee, 
  setAdminMerchantTopupFee, 
  getAdminAutoWithdrawalFee, 
  setAdminAutoWithdrawalFee,
  deleteAutoWithdrawal
} from '../lib/api'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  Wallet, 
  CheckCircle2,
  Trash2
} from 'lucide-react'
const getProofImageUrl = (path) => {
  if (!path) return '';
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) {
    try {
      const urlObj = new URL(path);
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return `${API_BASE}${urlObj.pathname}${urlObj.search}`;
      }
    } catch (e) {}
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};

export default function AutoWithdrawals() {
  const token = useAuthStore(s => s.token)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [minAutoWithdrawalBalance, setMinAutoWithdrawalBalance] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)
  
  const [autoWithdrawalFeePercentage, setAutoWithdrawalFeePercentage] = useState(0)
  const [savingFeePercentage, setSavingFeePercentage] = useState(false)
  
  const [topupFeeType, setTopupFeeType] = useState('percentage')
  const [topupFeeValue, setTopupFeeValue] = useState(0)
  const [savingFee, setSavingFee] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [res, balRes, topupFeeRes, withdrawFeeRes] = await Promise.all([
        listAutoWithdrawals(token, { status: statusFilter }),
        getAdminAutoWithdrawalMinBalance(token),
        getAdminMerchantTopupFee(token).catch(() => null),
        getAdminAutoWithdrawalFee(token).catch(() => null)
      ])
      setItems(res.data || [])
      if (balRes?.success) setMinAutoWithdrawalBalance(balRes.balance || 0)
      if (topupFeeRes?.success) {
        setTopupFeeType(topupFeeRes.type)
        setTopupFeeValue(topupFeeRes.value)
      }
      if (withdrawFeeRes?.success) setAutoWithdrawalFeePercentage(withdrawFeeRes.percentage || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleReject(id) {
    const reason = window.prompt('Are you sure you want to reject this request?\nOptional: Enter a reason for rejection (merchant will see this):');
    if (reason === null) return; // User clicked Cancel
    
    try {
      await rejectAutoWithdrawal(token, id, { reason });
      alert('Request rejected successfully.');
      loadData();
    } catch (e) {
      console.error(e);
      alert(e.data?.message || 'Failed to reject request');
    }
  }

  async function handleDeleteAuto(e, id) {
    if (e) e.stopPropagation();
    if (!window.confirm('আপনি কি নিশ্চিত যে এই অটো উইথড্রয়াল রিকোয়েস্টটি স্থায়ীভাবে মুছে ফেলতে চান? (Permanently delete auto withdrawal?)')) return;
    try {
      const res = await deleteAutoWithdrawal(token, id);
      if (res.success) {
        alert('Auto withdrawal request deleted successfully.');
        loadData();
      } else {
        alert(res.message || 'Failed to delete');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete request');
    }
  }

  useEffect(() => {
    if (token) loadData()
  }, [token, statusFilter])

  const filteredItems = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = item._id && item._id.toLowerCase().includes(q);
      const matchUser = item.userIdentityAddress && item.userIdentityAddress.toLowerCase().includes(q);
      if (!matchId && !matchUser) return false;
    }
    
    return true;
  });

  // Calculate Metrics from items
  const completedItems = items.filter(i => i.status === 'completed')
  const pendingItems = items.filter(i => i.status === 'pending' || i.status === 'booked')
  
  const totalCompletedAmount = completedItems.reduce((sum, i) => sum + (i.amount || 0), 0)
  const totalMerchantFees = completedItems.reduce((sum, i) => {
    const fee = i.feeAmount || (i.deductedAmount ? i.deductedAmount - i.amount : 0) || 0
    return sum + fee
  }, 0)
  const totalAgentCommission = completedItems.reduce((sum, i) => {
    return sum + (i.agentCommissionAmount || 0)
  }, 0)
  const netProfitEarned = totalMerchantFees - totalAgentCommission;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Pending</span>;
      case 'booked': return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Booked</span>;
      case 'completed': return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Completed</span>;
      case 'rejected': return <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Rejected (Hidden)</span>;
      case 'failed': return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">Failed</span>;
      default: return <span className="bg-slate-500/20 text-slate-300 border border-slate-500/30 px-2.5 py-1 rounded-md text-xs font-semibold">{status}</span>;
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500 pb-12 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Layers className="w-8 h-8 text-violet-400" />
            Auto Withdrawals System
          </h2>
          <p className="text-slate-400 mt-1">Monitor API-based automated withdrawals sent by merchants and completed by agents.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input 
            type="text"
            placeholder="Search by ID or User..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 min-w-[200px]"
          />
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
          >
            <option value="all" className="bg-[#0a0a1a]">All Statuses</option>
            <option value="pending" className="bg-[#0a0a1a]">Pending</option>
            <option value="booked" className="bg-[#0a0a1a]">Booked</option>
            <option value="completed" className="bg-[#0a0a1a]">Completed</option>
          </select>
          <button 
            onClick={loadData}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-colors text-white flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* TOP SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Withdrawal Amount */}
        <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-xl group hover:border-emerald-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">মোট উইথড্রয়াল</span>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
            ৳{totalCompletedAmount.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">সফলভাবে প্রাপ্ত উইথড্রয়াল</p>
        </div>

        {/* Merchant Fee Collected */}
        <div className="bg-gradient-to-br from-blue-950/60 via-slate-900/80 to-slate-900 border border-blue-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-xl group hover:border-blue-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">মার্চেন্ট ফি আয়</span>
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-300 font-mono tracking-tight">
            ৳{totalMerchantFees.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">মার্চেন্টদের থেকে পাওয়া চার্জ</p>
        </div>

        {/* Agent Commission Paid */}
        <div className="bg-gradient-to-br from-orange-950/60 via-slate-900/80 to-slate-900 border border-orange-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-xl group hover:border-orange-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">এজেন্ট কমিশন খরচ</span>
            <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-orange-300 font-mono tracking-tight">
            ৳{totalAgentCommission.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">এজেন্টদের দেওয়া কমিশন বোনাস</p>
        </div>

        {/* Net Profit Earned */}
        <div className="bg-gradient-to-br from-violet-950/60 via-slate-900/80 to-slate-900 border border-violet-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-xl group hover:border-violet-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">প্রকৃত নিট লাভ</span>
            <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-violet-300 font-mono tracking-tight">
            ৳{netProfitEarned.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">(মার্চেন্ট ফি − এজেন্ট কমিশন)</p>
        </div>

        {/* Pending / Booked Count */}
        <div className="bg-gradient-to-br from-amber-950/60 via-slate-900/80 to-slate-900 border border-amber-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-xl group hover:border-amber-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">পেন্ডিং / বুকড</span>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Clock className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
            {pendingItems.length} টি
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">প্রসেসিং লাইনে থাকা পেআউট</p>
        </div>

      </div>

      {/* Configurations Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-white font-semibold text-base">Min Balance Required</h3>
            <p className="text-slate-400 text-xs mt-1">Set minimum merchant balance required for auto withdrawal API.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">৳</span>
              <input 
                type="number" 
                value={minAutoWithdrawalBalance}
                onChange={(e) => setMinAutoWithdrawalBalance(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <button 
              onClick={async () => {
                try {
                  setSavingSettings(true)
                  await setAdminAutoWithdrawalMinBalance(token, Number(minAutoWithdrawalBalance))
                  alert("Minimum balance updated successfully!")
                } catch(e) {
                  alert("Failed to save: " + e.message)
                } finally {
                  setSavingSettings(false)
                }
              }}
              disabled={savingSettings}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-white font-semibold text-base">Auto-Withdrawal Fee (%)</h3>
            <p className="text-slate-400 text-xs mt-1">Set percentage fee applied to auto withdrawal API payouts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
              <input 
                type="number" 
                value={autoWithdrawalFeePercentage}
                onChange={(e) => setAutoWithdrawalFeePercentage(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:border-violet-500 outline-none"
              />
            </div>
            <button 
              onClick={async () => {
                try {
                  setSavingFeePercentage(true)
                  await setAdminAutoWithdrawalFee(token, Number(autoWithdrawalFeePercentage))
                  alert("Auto-Withdrawal Fee updated successfully!")
                } catch(e) {
                  alert("Failed to save: " + e.message)
                } finally {
                  setSavingFeePercentage(false)
                }
              }}
              disabled={savingFeePercentage}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {savingFeePercentage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-white font-semibold text-base">Merchant Topup Fee</h3>
            <p className="text-slate-400 text-xs mt-1">Set fee applied when merchants add balance.</p>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={topupFeeType}
              onChange={(e) => setTopupFeeType(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-violet-500 outline-none"
            >
              <option value="percentage">%</option>
              <option value="fixed">৳</option>
            </select>
            <input 
              type="number"
              value={topupFeeValue}
              onChange={(e) => setTopupFeeValue(e.target.value)}
              placeholder="Value"
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-violet-500 outline-none w-20"
              min="0"
              step="0.01"
            />
            <button 
              onClick={async () => {
                try {
                  setSavingFee(true)
                  await setAdminMerchantTopupFee(token, { type: topupFeeType, value: topupFeeValue })
                  alert("Topup Fee updated successfully!")
                } catch(e) {
                  alert("Failed to save fee: " + e.message)
                } finally {
                  setSavingFee(false)
                }
              }}
              disabled={savingFee}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {savingFee ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-black/40 text-xs uppercase text-slate-400 font-semibold border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Merchant</th>
                <th className="px-6 py-4">Amount / Method</th>
                <th className="px-6 py-4">User Identity</th>
                <th className="px-6 py-4">Agent (Booked By)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Agent Credit Earned</th>
                <th className="px-6 py-4">Merchant Balance</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
                    Loading data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500 italic">No auto withdrawals found for this status.</td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <React.Fragment key={item._id}>
                    <tr 
                      className={`hover:bg-white/5 transition-colors cursor-pointer ${expandedId === item._id ? 'bg-white/5' : ''}`}
                      onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
                    >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>{new Date(item.createdAt).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1" title="Withdrawal ID">ID: {item._id}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {item.merchant?.name || 'Unknown'}
                      <div className="text-xs text-slate-500 font-normal">{item.merchant?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-400 text-base">৳{item.amount?.toLocaleString()}</div>
                      <div className="text-xs text-slate-400 uppercase">{item.paymentMethod}</div>
                      {item.feeAmount > 0 && (
                        <div className="text-[10px] text-rose-400 mt-1" title={`Fee: ${item.feePercentage}%`}>
                          + ৳{item.feeAmount.toLocaleString()} Fee
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs opacity-90">
                      <div>{item.userIdentityAddress}</div>
                      {item.accountNumber && (
                        <div className="text-emerald-400 font-bold mt-1">Acc: {item.accountNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.bookedBy ? (
                        <>
                          <div className="text-white font-medium">{item.bookedBy.name}</div>
                          <div className="text-xs text-slate-500">{item.bookedBy.phone || item.bookedBy.email}</div>
                        </>
                      ) : (
                        <span className="text-slate-600 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                      {((item.agentRejections && item.agentRejections.length > 0) || (item.rejectedBy && item.rejectedBy.length > 0)) && (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {(item.agentRejections?.length || item.rejectedBy?.length || 0)}x Agent Cancelled
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'completed' ? (
                        <div className="text-xs space-y-1">
                          <span className="text-slate-400 block">Credit: ৳{(item.agentCreditAfter ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-emerald-400 font-bold block" title={`Commission Rate: ${item.agentCommissionRate || 0}%`}>
                            + ৳{(item.agentCommissionAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Comm. ({item.agentCommissionRate || 0}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'completed' ? (
                        <div className="text-xs space-y-0.5">
                          <span className="text-slate-400 block">Before: ৳{(item.merchantBalanceBefore || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-rose-400 font-bold block">After: ৳{(item.merchantBalanceAfter || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => handleDeleteAuto(e, item._id)}
                        className="p-2 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-xl transition-all"
                        title="Delete Request"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                  
                  {expandedId === item._id && (
                    <tr className="bg-black/20 border-t border-white/5">
                      <td colSpan={9} className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                          {/* Left Column */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-slate-400 font-medium mb-1 text-xs uppercase">Callback URL</h4>
                              <a href={item.callbackUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 break-all hover:underline">{item.callbackUrl || 'N/A'}</a>
                            </div>
                            
                            <div>
                              <h4 className="text-slate-400 font-medium mb-1 text-xs uppercase">Callback Result</h4>
                              {item.callbackResult ? (
                                <pre className="bg-black/40 p-3 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto">
                                  {JSON.stringify(item.callbackResult, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-slate-500 italic">No callback result yet</span>
                              )}
                            </div>
                            
                              <div>
                                <h4 className="text-slate-400 font-medium mb-1 text-xs uppercase">Proof Images</h4>
                                {item.proofImages && item.proofImages.length > 0 ? (
                                  <div className="flex gap-2 flex-wrap mt-2">
                                    {item.proofImages.map((img, i) => (
                                      <a key={i} href={getProofImageUrl(img)} target="_blank" rel="noopener noreferrer">
                                        <img src={getProofImageUrl(img)} alt="Proof" className="w-16 h-16 object-cover rounded-md border border-white/10 hover:opacity-80 transition" />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">No proofs uploaded</span>
                                )}
                              </div>
                          </div>
                          
                          {/* Right Column */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-slate-400 font-medium mb-1 text-xs uppercase">Checkout Items</h4>
                              {item.checkoutItems ? (
                                <pre className="bg-black/40 p-3 rounded-lg text-xs font-mono text-blue-300 overflow-x-auto max-h-48 nice-scroll-dark">
                                  {JSON.stringify(item.checkoutItems, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-slate-500 italic">None</span>
                              )}
                            </div>
                            
                            {/* Agent Rejections Audit Log */}
                            {((item.agentRejections && item.agentRejections.length > 0) || (item.rejectedBy && item.rejectedBy.length > 0)) && (
                              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-amber-400 font-bold text-xs uppercase flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-amber-400" /> এজেন্ট রিজেক্ট হিস্ট্রি (Agent Rejections Audit)
                                  </h4>
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    মোট {(item.agentRejections?.length || item.rejectedBy?.length || 0)} বার বাতিল
                                  </span>
                                </div>

                                {item.agentRejections && item.agentRejections.length > 0 ? (
                                  <div className="space-y-2">
                                    {item.agentRejections.map((rej, idx) => (
                                      <div key={idx} className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-start justify-between gap-3 text-xs">
                                        <div>
                                          <div className="text-white font-bold">{rej.agent?.name || 'Agent User'} <span className="text-slate-400 text-[10px]">({rej.agent?.phone || rej.agent?.email || 'ID: ' + (rej.agent?._id || rej.agent)})</span></div>
                                          <div className="text-amber-200/90 text-xs mt-0.5">কারন: "{rej.reason || 'No reason provided'}"</div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                                          {rej.rejectedAt ? new Date(rej.rejectedAt).toLocaleString() : ''}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {item.rejectedBy?.map((u, idx) => (
                                      <div key={idx} className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-xs">
                                        <div className="text-white font-bold">{u?.name || 'Agent User'} <span className="text-slate-400 text-[10px]">({u?.email || u?.phone})</span></div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Admin Rejection Details */}
                            {item.status === 'rejected' && (
                              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mt-4">
                                <h4 className="text-rose-400 font-bold mb-2 text-xs uppercase flex items-center gap-1">
                                  <AlertCircle className="w-4 h-4" /> Admin Final Rejection
                                </h4>
                                {item.rejectReason && (
                                  <div className="mb-2">
                                    <span className="text-slate-400 text-xs block">Reason</span>
                                    <span className="text-rose-200 text-sm font-medium">{item.rejectReason}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Action Controls */}
                            <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
                              {(item.status === 'pending' || item.status === 'booked') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(item._id);
                                  }}
                                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject Request
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDeleteAuto(e, item._id)}
                                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Request (Permanently)
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
