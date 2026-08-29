import React, { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { createBalanceAdjustment, getBalanceAdjustmentHistory, listOpayBusinesses, listUsers, updateUser } from '../lib/api'
import { Loader2, Plus, Minus, RefreshCcw, History, Percent, Edit3, Check } from 'lucide-react'

export default function BalanceAdjustment() {
  const token = useAuthStore((s) => s.token)

  const [adjustmentMode, setAdjustmentMode] = useState('single')
  const [targetType, setTargetType] = useState('wallet_agent')
  const [walletAgents, setWalletAgents] = useState([])
  const [merchants, setMerchants] = useState([])
  const [walletAgentId, setWalletAgentId] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyScope, setHistoryScope] = useState('selected')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState([])

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const [usersRes, merchantsRes] = await Promise.all([
          listUsers(token, { page: 1, limit: 300 }),
          listOpayBusinesses(token),
        ])
        if (ignore) return

        const allUsers = usersRes?.data || []
        const agentsOnly = allUsers.filter((u) => u.role === 'wallet_agent')
        setWalletAgents(agentsOnly)
        setMerchants(merchantsRes?.data || [])

        if (agentsOnly[0]?._id) setWalletAgentId(agentsOnly[0]._id)
        if (merchantsRes?.data?.[0]?._id) setMerchantId(merchantsRes.data[0]._id)
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load wallet agents or merchants')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [token])

  const selectedAgent = useMemo(
    () => walletAgents.find((a) => a._id === walletAgentId),
    [walletAgents, walletAgentId]
  )

  const selectedMerchant = useMemo(
    () => merchants.find((m) => m._id === merchantId),
    [merchants, merchantId]
  )

  const [commissionInput, setCommissionInput] = useState('')
  const [volumeInput, setVolumeInput] = useState('')
  const [linkMode, setLinkMode] = useState(true)
  const [editingRate, setEditingRate] = useState(false)
  const [newRateInput, setNewRateInput] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  const agentRate = Number(selectedAgent?.autoWithdrawalCommissionRate || 3)

  async function handleSaveAgentRate() {
    if (!walletAgentId || !token) return
    const parsedRate = Number(newRateInput)
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setError('Please enter a valid percentage rate (0 or positive number)')
      return
    }
    try {
      setSavingRate(true)
      setError('')
      const res = await updateUser(token, walletAgentId, { autoWithdrawalCommissionRate: parsedRate })
      if (res && res.data) {
        setWalletAgents(prev => prev.map(a => a._id === walletAgentId ? { ...a, autoWithdrawalCommissionRate: parsedRate } : a))
        setMessage(`Agent commission rate updated to ${parsedRate}% successfully`)
        setEditingRate(false)
      }
    } catch (err) {
      setError(err.message || 'Failed to update commission rate')
    } finally {
      setSavingRate(false)
    }
  }

  const handleCommissionChange = (val) => {
    setCommissionInput(val)
    if (linkMode) {
      const numComm = Number(val)
      if (Number.isFinite(numComm) && val !== '') {
        const calcVol = (numComm * 100) / (agentRate || 3)
        setVolumeInput(calcVol % 1 === 0 ? calcVol.toString() : calcVol.toFixed(2))
      } else {
        setVolumeInput('')
      }
    }
  }

  const handleVolumeChange = (val) => {
    setVolumeInput(val)
    if (linkMode) {
      const numVol = Number(val)
      if (Number.isFinite(numVol) && val !== '') {
        const calcComm = (numVol * (agentRate || 3)) / 100
        setCommissionInput(calcComm % 1 === 0 ? calcComm.toString() : calcComm.toFixed(2))
      } else {
        setCommissionInput('')
      }
    }
  }

  const parsedAmount = Number(amount)
  const parsedCommInput = Number(commissionInput)
  const parsedVolInput = Number(volumeInput)
  const isDualMode = targetType === 'agent_dual_withdrawal'

  const hasValidAmount = isDualMode
    ? (Number.isFinite(parsedCommInput) && parsedCommInput > 0) || (Number.isFinite(parsedVolInput) && parsedVolInput > 0)
    : Number.isFinite(parsedAmount) && parsedAmount > 0

  const agentCurrentCredit = Number(selectedAgent?.credit || 0)
  const agentCurrentWithdrawalComm = Number(selectedAgent?.autoWithdrawalCommission || 0)
  const agentCurrentVolume = Number(selectedAgent?.autoWithdrawalVolume || 0)
  const merchantCurrentWallet = Number(selectedMerchant?.availableBalance || 0)
  const isPairedMode = adjustmentMode === 'paired'

  const livePreview = useMemo(() => {
    if (!hasValidAmount) return null

    if (isDualMode) {
      const commDelta = Number.isFinite(parsedCommInput) && parsedCommInput > 0 ? parsedCommInput : 0
      const volDelta = Number.isFinite(parsedVolInput) && parsedVolInput > 0 ? parsedVolInput : 0
      return {
        plus: {
          agentWithdrawalAfter: agentCurrentWithdrawalComm + commDelta,
          agentVolumeAfter: agentCurrentVolume + volDelta,
          commAdded: commDelta,
          volAdded: volDelta,
        },
        minus: {
          agentWithdrawalAfter: agentCurrentWithdrawalComm - commDelta,
          agentVolumeAfter: agentCurrentVolume - volDelta,
          commDeducted: commDelta,
          volDeducted: volDelta,
        },
      }
    }

    if (isPairedMode) {
      return {
        plus: {
          agentCreditAfter: agentCurrentCredit + parsedAmount,
          merchantWalletAfter: merchantCurrentWallet - parsedAmount,
        },
        minus: {
          agentCreditAfter: agentCurrentCredit - parsedAmount,
          merchantWalletAfter: merchantCurrentWallet + parsedAmount,
        },
      }
    }
    if (targetType === 'merchant') {
      return {
        plus: {
          merchantWalletAfter: merchantCurrentWallet + parsedAmount,
        },
        minus: {
          merchantWalletAfter: merchantCurrentWallet - parsedAmount,
        },
      }
    }
    if (targetType === 'agent_withdrawal') {
      return {
        plus: {
          agentWithdrawalAfter: agentCurrentWithdrawalComm + parsedAmount,
        },
        minus: {
          agentWithdrawalAfter: agentCurrentWithdrawalComm - parsedAmount,
        },
      }
    }
    if (targetType === 'agent_volume') {
      return {
        plus: {
          agentVolumeAfter: agentCurrentVolume + parsedAmount,
        },
        minus: {
          agentVolumeAfter: agentCurrentVolume - parsedAmount,
        },
      }
    }
    return {
      plus: {
        agentCreditAfter: agentCurrentCredit + parsedAmount,
      },
      minus: {
        agentCreditAfter: agentCurrentCredit - parsedAmount,
      },
    }
  }, [hasValidAmount, isDualMode, isPairedMode, targetType, agentCurrentCredit, agentCurrentWithdrawalComm, agentCurrentVolume, merchantCurrentWallet, parsedAmount, parsedCommInput, parsedVolInput])

  async function submitAdjustment(action) {
    setError('')
    setMessage('')

    if (isPairedMode && (!walletAgentId || !merchantId)) {
      setError('Please select both wallet agent and merchant for paired adjustment')
      return
    }
    if (!isPairedMode && ['wallet_agent', 'agent_withdrawal', 'agent_volume', 'agent_dual_withdrawal'].includes(targetType) && !walletAgentId) {
      setError('Please select a wallet agent')
      return
    }
    if (!isPairedMode && targetType === 'merchant' && !merchantId) {
      setError('Please select a merchant')
      return
    }

    if (isDualMode) {
      if ((!Number.isFinite(parsedCommInput) || parsedCommInput <= 0) && (!Number.isFinite(parsedVolInput) || parsedVolInput <= 0)) {
        setError('Enter a valid Commission Amount or Cash-Out Volume Amount')
        return
      }
    } else if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount')
      return
    }

    try {
      setSaving(true)
      const payload = {
        targetType: isPairedMode ? 'paired' : (isDualMode ? 'agent_withdrawal_and_volume' : targetType),
        walletAgentId: (targetType === 'merchant' && !isPairedMode) ? undefined : walletAgentId,
        merchantId: (isPairedMode || targetType === 'merchant') ? merchantId : undefined,
        action,
        note,
      }

      if (isDualMode) {
        payload.commissionAmount = parsedCommInput > 0 ? parsedCommInput : 0
        payload.volumeAmount = parsedVolInput > 0 ? parsedVolInput : 0
        payload.amount = payload.commissionAmount || payload.volumeAmount || 0
      } else {
        payload.amount = parsedAmount
      }

      const res = await createBalanceAdjustment(token, payload)

      const updatedAgent = res?.data?.walletAgent
      const updatedMerchant = res?.data?.merchant

      if (updatedAgent?._id) {
        setWalletAgents((prev) => prev.map((a) => (
          a._id === updatedAgent._id
            ? {
                ...a,
                credit: updatedAgent.credit,
                autoWithdrawalCommission: updatedAgent.autoWithdrawalCommission,
                autoWithdrawalVolume: updatedAgent.autoWithdrawalVolume
              }
            : a
        )))
      }

      if (updatedMerchant?._id) {
        setMerchants((prev) => prev.map((m) => (
          m._id === updatedMerchant._id
            ? {
              ...m,
              balanceAdjustment: updatedMerchant.balanceAdjustment,
              availableBalance: (m.availableBalance || 0) + (res?.data?.applied?.merchantBalanceDelta || 0),
            }
            : m
        )))
      }

      setAmount('')
      setCommissionInput('')
      setVolumeInput('')
      setNote('')
      if (isPairedMode) {
        setMessage('Paired adjustment completed successfully')
      } else if (isDualMode) {
        const directionLabel = action === 'minus' ? 'decreased' : 'increased'
        setMessage(`Agent Commission & Volume ${directionLabel} successfully`)
      } else {
        const targetLabel = targetType === 'merchant'
          ? 'Merchant balance'
          : targetType === 'agent_withdrawal'
          ? 'Wallet Agent Commission Balance'
          : targetType === 'agent_volume'
          ? 'Total Processed Cash-Out Volume'
          : 'Wallet Agent credit'
        const directionLabel = action === 'minus' ? 'decreased' : 'increased'
        setMessage(`${targetLabel} ${directionLabel} successfully`)
      }
    } catch (e) {
      setError(e.message || 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  async function loadHistory(scope = historyScope) {
    if (!token) return
    setHistoryLoading(true)
    setError('')
    try {
      const params = {
        page: 1,
        limit: 100,
      }

      if (scope === 'selected') {
        if (isPairedMode) {
          params.walletAgentId = walletAgentId || undefined
          params.merchantId = merchantId || undefined
        } else if (targetType === 'wallet_agent') {
          params.walletAgentId = walletAgentId || undefined
        } else {
          params.merchantId = merchantId || undefined
        }
      }

      const res = await getBalanceAdjustmentHistory(token, params)
      setHistoryItems(res?.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load adjustment history')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleToggleHistory() {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next) {
      await loadHistory(historyScope)
    }
  }

  async function handleShowAllHistory() {
    setHistoryScope('all')
    setHistoryOpen(true)
    await loadHistory('all')
  }

  async function handleShowSelectedHistory() {
    setHistoryScope('selected')
    setHistoryOpen(true)
    await loadHistory('selected')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-8 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white">Balance Adjustment</h1>
        <p className="mt-2 text-sm text-slate-400">
          Adjust wallet agent, merchant, or both together from one screen.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading wallet agents and merchants...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">Adjustment Mode</label>
              <select
                value={adjustmentMode}
                onChange={(e) => setAdjustmentMode(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="single">Single Target</option>
                <option value="paired">Paired (Agent + Merchant)</option>
              </select>
            </div>

            {!isPairedMode && (
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">Adjustment Target</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 font-semibold"
              >
                <option value="wallet_agent">Wallet Agent Credit (লাইভ ক্রেডিট)</option>
                <option value="agent_dual_withdrawal">⚡ Agent Auto-Withdrawal (কমিশন + ভলিউম একসাথে / আলাদা)</option>
                <option value="agent_withdrawal">Wallet Agent Commission & Bonus (শুধু কমিশন ও বোনাস)</option>
                <option value="agent_volume">Wallet Agent Total Processed Cash-Out Volume (শুধু ক্যাশ-আউট ভলিউম)</option>
                <option value="merchant">Merchant Balance (মার্চেন্ট ব্যালেন্স)</option>
              </select>
            </div>
            )}

            {isPairedMode ? (
              <>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Wallet Agent</label>
              <select
                value={walletAgentId}
                onChange={(e) => setWalletAgentId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="">Select wallet agent</option>
                {walletAgents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {(agent.name || 'Unnamed')} - {agent.email} - Credit: {Number(agent.credit || 0).toFixed(2)} | Comm: {Number(agent.autoWithdrawalCommission || 0).toFixed(2)} | Vol: {Number(agent.autoWithdrawalVolume || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Merchant</label>
              <select
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="">Select merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant._id} value={merchant._id}>
                    {(merchant.name || merchant.email)} - {merchant.domain || 'no-domain'} - Avl: {Number(merchant.availableBalance || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

              </>
            ) : ['wallet_agent', 'agent_withdrawal', 'agent_volume', 'agent_dual_withdrawal'].includes(targetType) ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Wallet Agent {targetType === 'agent_dual_withdrawal' ? '(Commission + Volume Target)' : ''}
              </label>
              <select
                value={walletAgentId}
                onChange={(e) => setWalletAgentId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="">Select wallet agent</option>
                {walletAgents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {(agent.name || 'Unnamed')} - {agent.email} - Credit: {Number(agent.credit || 0).toFixed(2)} | Comm: {Number(agent.autoWithdrawalCommission || 0).toFixed(2)} | Vol: {Number(agent.autoWithdrawalVolume || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Merchant</label>
              <select
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="">Select merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant._id} value={merchant._id}>
                    {(merchant.name || merchant.email)} - {merchant.domain || 'no-domain'} - Avl: {Number(merchant.availableBalance || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            )}

            {isDualMode ? (
              <div className="md:col-span-2 space-y-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      ⚡ Agent Commission & Cash-Out Volume Adjustment
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">Agent Commission Rate:</span>
                      {editingRate ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={newRateInput}
                            onChange={(e) => setNewRateInput(e.target.value)}
                            placeholder={agentRate.toString()}
                            className="w-16 px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold outline-none"
                          />
                          <span className="text-xs text-amber-300 font-bold">%</span>
                          <button
                            type="button"
                            onClick={handleSaveAgentRate}
                            disabled={savingRate}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                            title="Save Rate"
                          >
                            {savingRate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRate(false)}
                            className="text-[11px] text-slate-400 hover:text-slate-200 px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                            {agentRate}%
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewRateInput(agentRate.toString())
                              setEditingRate(true)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 underline font-semibold ml-1"
                          >
                            <Edit3 className="w-3 h-3" /> Change Rate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLinkMode(!linkMode)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                      linkMode
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-white/10 text-slate-400'
                    }`}
                  >
                    {linkMode ? '🔗 Linked Mode (Auto % Calculation ON)' : '🔓 Manual Mode (Separate Input)'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-amber-200">
                      1. Commission & Bonus Account Amount (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={commissionInput}
                      onChange={(e) => handleCommissionChange(e.target.value)}
                      placeholder={`e.g. 30 (will auto-calculate volume @ ${agentRate}%)`}
                      className="w-full rounded-xl border border-amber-500/30 bg-slate-950/90 px-4 py-3 text-sm text-amber-300 outline-none focus:border-amber-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-purple-200">
                      2. Total Processed Cash-Out Volume Amount (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={volumeInput}
                      onChange={(e) => handleVolumeChange(e.target.value)}
                      placeholder={`e.g. 1000 (will auto-calculate commission @ ${agentRate}%)`}
                      className="w-full rounded-xl border border-purple-500/30 bg-slate-950/90 px-4 py-3 text-sm text-purple-300 outline-none focus:border-purple-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  * Linked Mode ON থাকলে একটি টাইপ করলে এজেন্টের {agentRate}% কমিশন রেট অনুযায়ী অপরটি অটোম্যাটিক হিসাব হয়ে যাবে। Manual Mode নির্বাচন করলে স্বাধীনভাবে দুটি ফিল্ডে ইচ্ছেমতো টাকার পরিমাণ দিতে পারবেন।
                </p>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-300">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">Note (Optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a reason or note"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>

            {livePreview && (
              <div className="md:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-400" /> If Click "+ Plus" (যোগ হবে)
                    </p>
                    <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {isDualMode
                        ? `+Comm: ৳${(livePreview.plus.commAdded || 0).toFixed(2)} | +Vol: ৳${(livePreview.plus.volAdded || 0).toFixed(2)}`
                        : `+৳${parsedAmount.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-xs font-medium text-slate-200">
                    {isDualMode ? (
                      <>
                        <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-amber-500/20">
                          <span className="text-slate-300 font-bold">Commission & Bonus:</span>
                          <span className="font-mono font-black text-sm text-amber-300">৳{agentCurrentWithdrawalComm.toFixed(2)} ➔ ৳{livePreview.plus.agentWithdrawalAfter.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-purple-500/20">
                          <span className="text-slate-300 font-bold">Cash-Out Volume:</span>
                          <span className="font-mono font-black text-sm text-purple-300">৳{agentCurrentVolume.toFixed(2)} ➔ ৳{livePreview.plus.agentVolumeAfter.toFixed(2)}</span>
                        </div>
                      </>
                    ) : isPairedMode ? (
                      <>
                        <div className="flex justify-between items-center bg-black/30 p-2 rounded-xl">
                          <span className="text-slate-400">Agent Credit (+):</span>
                          <span className="font-mono font-bold text-emerald-300">৳{agentCurrentCredit.toFixed(2)} ➔ ৳{livePreview.plus.agentCreditAfter.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/30 p-2 rounded-xl">
                          <span className="text-slate-400">Merchant Wallet (-):</span>
                          <span className={`font-mono font-bold ${livePreview.plus.merchantWalletAfter < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                            ৳{merchantCurrentWallet.toFixed(2)} ➔ ৳{livePreview.plus.merchantWalletAfter.toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : targetType === 'wallet_agent' ? (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-emerald-500/20">
                        <span className="text-slate-300 font-bold">Agent Live Credit:</span>
                        <span className="font-mono font-black text-sm text-emerald-300">৳{agentCurrentCredit.toFixed(2)} ➔ ৳{livePreview.plus.agentCreditAfter.toFixed(2)}</span>
                      </div>
                    ) : targetType === 'agent_withdrawal' ? (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-emerald-500/20">
                        <span className="text-slate-300 font-bold">Commission & Bonus Account:</span>
                        <span className="font-mono font-black text-sm text-amber-300">৳{agentCurrentWithdrawalComm.toFixed(2)} ➔ ৳{livePreview.plus.agentWithdrawalAfter.toFixed(2)}</span>
                      </div>
                    ) : targetType === 'agent_volume' ? (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-emerald-500/20">
                        <span className="text-slate-300 font-bold">Total Processed Cash-Out Volume:</span>
                        <span className="font-mono font-black text-sm text-purple-300">৳{agentCurrentVolume.toFixed(2)} ➔ ৳{livePreview.plus.agentVolumeAfter.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-emerald-500/20">
                        <span className="text-slate-300 font-bold">Merchant Available Wallet:</span>
                        <span className="font-mono font-black text-sm text-cyan-300">৳{merchantCurrentWallet.toFixed(2)} ➔ ৳{livePreview.plus.merchantWalletAfter.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
                    <p className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <Minus className="w-4 h-4 text-rose-400" /> If Click "- Minus" (কাটা যাবে)
                    </p>
                    <span className="text-xs font-mono font-black text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                      {isDualMode
                        ? `-Comm: ৳${(livePreview.minus.commDeducted || 0).toFixed(2)} | -Vol: ৳${(livePreview.minus.volDeducted || 0).toFixed(2)}`
                        : `-৳${parsedAmount.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-xs font-medium text-slate-200">
                    {isDualMode ? (
                      <>
                        <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-rose-500/20">
                          <span className="text-slate-300 font-bold">Commission & Bonus:</span>
                          <span className={`font-mono font-black text-sm ${livePreview.minus.agentWithdrawalAfter < 0 ? 'text-rose-400' : 'text-rose-300'}`}>
                            ৳{agentCurrentWithdrawalComm.toFixed(2)} ➔ ৳{livePreview.minus.agentWithdrawalAfter.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-rose-500/20">
                          <span className="text-slate-300 font-bold">Cash-Out Volume:</span>
                          <span className={`font-mono font-black text-sm ${livePreview.minus.agentVolumeAfter < 0 ? 'text-rose-400' : 'text-rose-300'}`}>
                            ৳{agentCurrentVolume.toFixed(2)} ➔ ৳{livePreview.minus.agentVolumeAfter.toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : isPairedMode ? (
                      <>
                        <div className="flex justify-between items-center bg-black/30 p-2 rounded-xl">
                          <span className="text-slate-400">Agent Credit (-):</span>
                          <span className={`font-mono font-bold ${livePreview.minus.agentCreditAfter < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                            ৳{agentCurrentCredit.toFixed(2)} ➔ ৳{livePreview.minus.agentCreditAfter.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-black/30 p-2 rounded-xl">
                          <span className="text-slate-400">Merchant Wallet (+):</span>
                          <span className="font-mono font-bold text-emerald-300">৳{merchantCurrentWallet.toFixed(2)} ➔ ৳{livePreview.minus.merchantWalletAfter.toFixed(2)}</span>
                        </div>
                      </>
                    ) : targetType === 'wallet_agent' ? (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-rose-500/20">
                        <span className="text-slate-300 font-bold">Agent Live Credit:</span>
                        <span className={`font-mono font-black text-sm ${livePreview.minus.agentCreditAfter < 0 ? 'text-rose-400' : 'text-rose-300'}`}>
                          ৳{agentCurrentCredit.toFixed(2)} ➔ ৳{livePreview.minus.agentCreditAfter.toFixed(2)}
                        </span>
                      </div>
                    ) : targetType === 'agent_withdrawal' ? (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-rose-500/20">
                        <span className="text-slate-300 font-bold">Commission & Bonus Account:</span>
                        <span className={`font-mono font-black text-sm ${livePreview.minus.agentWithdrawalAfter < 0 ? 'text-rose-400' : 'text-rose-300'}`}>
                          ৳{agentCurrentWithdrawalComm.toFixed(2)} ➔ ৳{livePreview.minus.agentWithdrawalAfter.toFixed(2)}
                        </span>
                      </div>
                    ) : targetType === 'agent_volume' ? (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-rose-500/20">
                        <span className="text-slate-300 font-bold">Total Processed Cash-Out Volume:</span>
                        <span className={`font-mono font-black text-sm ${livePreview.minus.agentVolumeAfter < 0 ? 'text-rose-400' : 'text-rose-300'}`}>
                          ৳{agentCurrentVolume.toFixed(2)} ➔ ৳{livePreview.minus.agentVolumeAfter.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-rose-500/20">
                        <span className="text-slate-300 font-bold">Merchant Available Wallet:</span>
                        <span className="font-mono font-black text-sm text-rose-300">৳{merchantCurrentWallet.toFixed(2)} ➔ ৳{livePreview.minus.merchantWalletAfter.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => submitAdjustment('plus')}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Plus ({isPairedMode ? 'Paired' : targetType === 'merchant' ? 'Merchant +' : 'Agent +'})
              </button>

              <button
                type="button"
                onClick={() => submitAdjustment('minus')}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
                Minus ({isPairedMode ? 'Paired' : targetType === 'merchant' ? 'Merchant -' : 'Agent -'})
              </button>

              <button
                type="button"
                onClick={() => {
                  setAmount('')
                  setNote('')
                  setError('')
                  setMessage('')
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>

              <button
                type="button"
                onClick={handleShowSelectedHistory}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                <History className="h-4 w-4" />
                {historyOpen ? 'Hide History' : 'History'}
              </button>

              <button
                type="button"
                onClick={handleShowAllHistory}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
              >
                <History className="h-4 w-4" />
                All History
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {historyOpen && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                {historyScope === 'all' ? 'All Adjustment History' : 'Adjustment History'}
              </h3>
              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-60"
              >
                {historyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-sm text-slate-500">No adjustment documents found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Target</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Wallet Agent</th>
                      <th className="px-3 py-2">Merchant</th>
                      <th className="px-3 py-2">Wallet Credit</th>
                      <th className="px-3 py-2">Merchant Wallet</th>
                      <th className="px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((item) => (
                      <tr key={item._id} className="border-b border-white/5 align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 uppercase tracking-wider text-[10px]">
                            {item.targetType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 uppercase">
                          <span className={item.action === 'plus' ? 'text-emerald-300' : 'text-rose-300'}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-3 py-2">{Number(item.amount || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <div>{item.walletAgent?.name || 'N/A'}</div>
                          <div className="text-[11px] text-slate-500">{item.walletAgent?.email || ''}</div>
                        </td>
                        <td className="px-3 py-2">
                          {item.merchant?.name ? (
                            <>
                              <div>{item.merchant.name}</div>
                              <div className="text-[11px] text-slate-500">{item.merchant.email || item.merchant.domain || ''}</div>
                            </>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div>{Number(item.walletCreditBefore || 0).toFixed(2)} → {Number(item.walletCreditAfter || 0).toFixed(2)}</div>
                          <div className="text-[11px] text-slate-500">delta: {item.walletCreditDelta > 0 ? '+' : ''}{Number(item.walletCreditDelta || 0).toFixed(2)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div>{Number(item.merchantWalletBefore || 0).toFixed(2)} → {Number(item.merchantWalletAfter || 0).toFixed(2)}</div>
                          <div className="text-[11px] text-slate-500">delta: {item.merchantBalanceDelta > 0 ? '+' : ''}{Number(item.merchantBalanceDelta || 0).toFixed(2)}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-normal break-words max-w-xs">
                          {item.note || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Selected Wallet Agent</h2>
          {selectedAgent ? (
            <div className="mt-3 space-y-1 text-sm text-slate-200">
              <p>Name: {selectedAgent.name || 'N/A'}</p>
              <p>Email: {selectedAgent.email}</p>
              <p>Live Credit (লাইভ ক্রেডিট): <span className="font-bold text-emerald-400">৳{Number(selectedAgent.credit || 0).toFixed(2)}</span></p>
              <p>Commission & Bonus (কমিশন ও বোনাস একাউন্ট): <span className="font-bold text-amber-400">৳{Number(selectedAgent.autoWithdrawalCommission || 0).toFixed(2)}</span></p>
              <p>Total Processed Volume (মোট ক্যাশ-আউট ভলিউম): <span className="font-bold text-purple-400">৳{Number(selectedAgent.autoWithdrawalVolume || 0).toFixed(2)}</span></p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No wallet agent selected</p>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Selected Merchant</h2>
          {selectedMerchant ? (
            <div className="mt-3 space-y-1 text-sm text-slate-200">
              <p>Name: {selectedMerchant.name || 'N/A'}</p>
              <p>Email: {selectedMerchant.email || 'N/A'}</p>
              <p>Domain: {selectedMerchant.domain || 'N/A'}</p>
              <p>Balance Adjustment: {Number(selectedMerchant.balanceAdjustment || 0).toFixed(2)}</p>
              <p>Available Balance: {Number(selectedMerchant.availableBalance || 0).toFixed(2)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No merchant selected</p>
          )}
        </div>
      </div>
    </div>
  )
}
