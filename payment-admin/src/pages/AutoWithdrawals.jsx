import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { listAutoWithdrawals, rejectAutoWithdrawal, getAdminAutoWithdrawalMinBalance, setAdminAutoWithdrawalMinBalance, getAdminMerchantTopupFee, setAdminMerchantTopupFee } from '../lib/api'
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Layers } from 'lucide-react'

export default function AutoWithdrawals() {
  const token = useAuthStore(s => s.token)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [minAutoWithdrawalBalance, setMinAutoWithdrawalBalance] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)
  
  const [topupFeeType, setTopupFeeType] = useState('percentage')
  const [topupFeeValue, setTopupFeeValue] = useState(0)
  const [savingFee, setSavingFee] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [res, balRes, feeRes] = await Promise.all([
        listAutoWithdrawals(token, { status: statusFilter }),
        getAdminAutoWithdrawalMinBalance(token),
        getAdminMerchantTopupFee(token).catch(() => null)
      ])
      setItems(res.data || [])
      if (balRes?.success) setMinAutoWithdrawalBalance(balRes.balance || 0)
      if (feeRes?.success) {
        setTopupFeeType(feeRes.type)
        setTopupFeeValue(feeRes.value)
      }
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
      await rejectAutoWithdrawal(token, id, reason);
      alert('Request rejected successfully.');
      loadData();
    } catch (e) {
      console.error(e);
      alert(e.data?.message || 'Failed to reject request');
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
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
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

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Auto-Withdrawal Configuration</h3>
          <p className="text-slate-400 text-sm">Set the minimum available balance required for merchants to use the auto-withdrawal API.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">৳</span>
            <input 
              type="number" 
              value={minAutoWithdrawalBalance}
              onChange={(e) => setMinAutoWithdrawalBalance(e.target.value)}
              className="pl-8 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-emerald-500 outline-none w-32"
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
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Merchant Topup Fee</h3>
          <p className="text-slate-400 text-sm">Set the fee applied when merchants add balance to their account.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={topupFeeType}
            onChange={(e) => setTopupFeeType(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-violet-500 outline-none w-36"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (৳)</option>
          </select>
          <input 
            type="number"
            value={topupFeeValue}
            onChange={(e) => setTopupFeeValue(e.target.value)}
            placeholder="Value"
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-violet-500 outline-none w-24"
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
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            {savingFee ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
                    Loading data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 italic">No auto withdrawals found for this status.</td>
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
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'completed' ? (
                        <div className="text-xs">
                          <span className="text-slate-400 block mb-1">Before: ৳{item.agentCreditBefore}</span>
                          <span className="text-emerald-300 font-bold block">After: ৳{item.agentCreditAfter}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'completed' ? (
                        <div className="text-xs">
                          <span className="text-slate-400 block mb-1">Before: ৳{item.merchantBalanceBefore || 0}</span>
                          <span className="text-rose-400 font-bold block">After: ৳{item.merchantBalanceAfter || 0}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                  
                  {expandedId === item._id && (
                    <tr className="bg-black/20 border-t border-white/5">
                      <td colSpan={8} className="px-6 py-6">
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
                                    <a key={i} href={img.startsWith('http') ? img : `http://localhost:5000${img}`} target="_blank" rel="noopener noreferrer">
                                      <img src={img.startsWith('http') ? img : `http://localhost:5000${img}`} alt="Proof" className="w-16 h-16 object-cover rounded-md border border-white/10 hover:opacity-80 transition" />
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
                            
                            {/* Rejection Details */}
                            {(item.status === 'rejected' || (item.rejectedBy && item.rejectedBy.length > 0)) && (
                              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mt-4">
                                <h4 className="text-rose-400 font-bold mb-2 text-xs uppercase flex items-center gap-1">
                                  <AlertCircle className="w-4 h-4" /> Rejection Details
                                </h4>
                                {item.rejectReason && (
                                  <div className="mb-3">
                                    <span className="text-slate-400 text-xs block">Reason</span>
                                    <span className="text-rose-200 text-sm font-medium">{item.rejectReason}</span>
                                  </div>
                                )}
                                {item.rejectedBy && item.rejectedBy.length > 0 && (
                                  <div>
                                    <span className="text-slate-400 text-xs block mb-1">Rejected By</span>
                                    <div className="space-y-2">
                                      {item.rejectedBy.map((u, idx) => (
                                        <div key={idx} className="bg-black/20 p-2 rounded flex flex-col">
                                          <span className="text-white text-sm font-medium">{u?.name || 'Unknown'}</span>
                                          <span className="text-slate-500 text-xs">{u?.email} {u?.phone ? `| ${u?.phone}` : ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Action Controls */}
                            {(item.status === 'pending' || item.status === 'booked') && (
                              <div className="pt-4 mt-4 border-t border-white/5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(item._id);
                                  }}
                                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm w-full md:w-auto justify-center"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject Request
                                </button>
                              </div>
                            )}
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
