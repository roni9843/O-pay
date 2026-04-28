import React, { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { createBalanceAdjustment, getBalanceAdjustmentHistory, listOpayBusinesses, listUsers } from '../lib/api'
import { Loader2, Plus, Minus, RefreshCcw, History } from 'lucide-react'

export default function BalanceAdjustment() {
  const token = useAuthStore((s) => s.token)

  const [adjustmentMode, setAdjustmentMode] = useState('single')
  const [targetType, setTargetType] = useState('wallet_agent')
  const [walletAgents, setWalletAgents] = useState([])
  const [merchants, setMerchants] = useState([])
  const [walletAgentId, setWalletAgentId] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [amount, setAmount] = useState('')

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

  const parsedAmount = Number(amount)
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const agentCurrentCredit = Number(selectedAgent?.credit || 0)
  const merchantCurrentWallet = Number(selectedMerchant?.availableBalance || 0)
  const isPairedMode = adjustmentMode === 'paired'

  const livePreview = useMemo(() => {
    if (!hasValidAmount) return null
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
    return {
      plus: {
        agentCreditAfter: agentCurrentCredit + parsedAmount,
      },
      minus: {
        agentCreditAfter: agentCurrentCredit - parsedAmount,
      },
    }
  }, [hasValidAmount, isPairedMode, targetType, agentCurrentCredit, merchantCurrentWallet, parsedAmount])

  async function submitAdjustment(action) {
    setError('')
    setMessage('')

    const parsedAmount = Number(amount)
    if (isPairedMode && (!walletAgentId || !merchantId)) {
      setError('Please select both wallet agent and merchant for paired adjustment')
      return
    }
    if (!isPairedMode && targetType === 'wallet_agent' && !walletAgentId) {
      setError('Please select a wallet agent')
      return
    }
    if (!isPairedMode && targetType === 'merchant' && !merchantId) {
      setError('Please select a merchant')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount')
      return
    }

    try {
      setSaving(true)
      const res = await createBalanceAdjustment(token, {
        targetType: isPairedMode ? 'paired' : targetType,
        walletAgentId,
        merchantId,
        amount: parsedAmount,
        action,
      })

      const updatedAgent = res?.data?.walletAgent
      const updatedMerchant = res?.data?.merchant

      if (updatedAgent?._id) {
        setWalletAgents((prev) => prev.map((a) => (
          a._id === updatedAgent._id ? { ...a, credit: updatedAgent.credit } : a
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
      if (isPairedMode) {
        setMessage('Paired adjustment completed successfully')
      } else {
        const targetLabel = targetType === 'merchant' ? 'Merchant balance' : 'Wallet Agent credit'
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="wallet_agent">Wallet Agent Credit</option>
                <option value="merchant">Merchant Balance</option>
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
                    {(agent.name || 'Unnamed')} - {agent.email} - Credit: {Number(agent.credit || 0).toFixed(2)}
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
            ) : targetType === 'wallet_agent' ? (
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
                    {(agent.name || 'Unnamed')} - {agent.email} - Credit: {Number(agent.credit || 0).toFixed(2)}
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

            {livePreview && (
              <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">If Plus Click</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-100">
                    {isPairedMode ? (
                      <>
                        <p>Wallet Agent Credit: {agentCurrentCredit.toFixed(2)} {'->'} {livePreview.plus.agentCreditAfter.toFixed(2)}</p>
                        <p className={livePreview.plus.merchantWalletAfter < 0 ? 'text-rose-300' : 'text-slate-100'}>
                          Merchant Wallet: {merchantCurrentWallet.toFixed(2)} {'->'} {livePreview.plus.merchantWalletAfter.toFixed(2)}
                        </p>
                      </>
                    ) : targetType === 'wallet_agent' ? (
                      <p>Wallet Agent Credit: {agentCurrentCredit.toFixed(2)} {'->'} {livePreview.plus.agentCreditAfter.toFixed(2)}</p>
                    ) : (
                      <p>Merchant Wallet: {merchantCurrentWallet.toFixed(2)} {'->'} {livePreview.plus.merchantWalletAfter.toFixed(2)}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-200">If Minus Click</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-100">
                    {isPairedMode ? (
                      <>
                        <p className={livePreview.minus.agentCreditAfter < 0 ? 'text-rose-300' : 'text-slate-100'}>
                          Wallet Agent Credit: {agentCurrentCredit.toFixed(2)} {'->'} {livePreview.minus.agentCreditAfter.toFixed(2)}
                        </p>
                        <p>Merchant Wallet: {merchantCurrentWallet.toFixed(2)} {'->'} {livePreview.minus.merchantWalletAfter.toFixed(2)}</p>
                      </>
                    ) : targetType === 'wallet_agent' ? (
                      <p className={livePreview.minus.agentCreditAfter < 0 ? 'text-rose-300' : 'text-slate-100'}>
                        Wallet Agent Credit: {agentCurrentCredit.toFixed(2)} {'->'} {livePreview.minus.agentCreditAfter.toFixed(2)}
                      </p>
                    ) : (
                      <p>Merchant Wallet: {merchantCurrentWallet.toFixed(2)} {'->'} {livePreview.minus.merchantWalletAfter.toFixed(2)}</p>
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
                          <div>{item.merchant?.name || 'N/A'}</div>
                          <div className="text-[11px] text-slate-500">{item.merchant?.email || item.merchant?.domain || ''}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div>{Number(item.walletCreditBefore || 0).toFixed(2)} → {Number(item.walletCreditAfter || 0).toFixed(2)}</div>
                          <div className="text-[11px] text-slate-500">delta: {item.walletCreditDelta > 0 ? '+' : ''}{Number(item.walletCreditDelta || 0).toFixed(2)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div>{Number(item.merchantWalletBefore || 0).toFixed(2)} → {Number(item.merchantWalletAfter || 0).toFixed(2)}</div>
                          <div className="text-[11px] text-slate-500">delta: {item.merchantBalanceDelta > 0 ? '+' : ''}{Number(item.merchantBalanceDelta || 0).toFixed(2)}</div>
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
              <p>Credit: {Number(selectedAgent.credit || 0).toFixed(2)}</p>
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
