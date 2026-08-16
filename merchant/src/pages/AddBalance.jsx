import React, { useState, useEffect } from 'react'
import { Wallet, Loader2, ArrowRight, Info } from 'lucide-react'
import { initTopup, getWithdrawalConfig } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function AddBalance() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [feeType, setFeeType] = useState('percentage')
  const [feeValue, setFeeValue] = useState(0)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await getWithdrawalConfig()
        if (res.success && res.data) {
          setFeeType(res.data.topupFeeType || 'percentage')
          setFeeValue(res.data.topupFeeValue || 0)
        }
      } catch (err) {
        console.error('Failed to load config', err)
      }
    }
    loadConfig()
  }, [])

  const numAmount = Number(amount) || 0
  let calculatedFee = 0
  if (numAmount > 0) {
    if (feeType === 'percentage') {
      calculatedFee = (numAmount * feeValue) / 100
    } else {
      calculatedFee = feeValue
    }
  }
  const totalAmount = numAmount + calculatedFee

  const handlePay = async (e) => {
    e.preventDefault()
    setError('')

    if (!numAmount || numAmount < 10) {
      setError('Amount must be at least 10 BDT')
      return
    }

    setLoading(true)
    try {
      const res = await initTopup(numAmount)
      if (res.success && res.payment_page_url) {
        window.location.href = res.payment_page_url
      } else {
        setError('Failed to generate payment link')
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Wallet className="w-8 h-8 text-violet-600" />
          Add Balance
        </h1>
        <p className="text-slate-500 font-medium mt-1">Top up your merchant balance via Opay</p>
      </header>

      <form onSubmit={handlePay} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            Amount (BDT)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">৳</span>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-4 text-slate-900 font-black text-xl placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              required
              min="10"
            />
          </div>
        </div>

        {numAmount > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
             <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                <span>Base Amount</span>
                <span>৳ {numAmount.toFixed(2)}</span>
             </div>
             <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                <span className="flex items-center gap-1.5">
                  Opay Fee {feeType === 'percentage' && `(${feeValue}%)`}
                  <Info className="w-4 h-4 text-slate-400" />
                </span>
                <span>৳ {calculatedFee.toFixed(2)}</span>
             </div>
             <div className="pt-3 border-t border-slate-200 flex justify-between items-center font-black text-slate-900">
                <span>Total to Pay</span>
                <span className="text-lg text-violet-600">৳ {totalAmount.toFixed(2)}</span>
             </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || numAmount < 10}
          className="w-full mt-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:hover:bg-violet-600 text-white font-black text-lg py-4 rounded-2xl transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Processing...
            </>
          ) : (
            <>
              Proceed to Pay ৳ {numAmount > 0 ? totalAmount.toFixed(2) : '0.00'} <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
