import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { uploadPaymentPageImage, getWalletAgentTemplates, saveWalletAgentTemplate } from '../lib/api'
import { CreditCard, Upload, Save, RotateCcw, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react'

export default function Payments() {
  const token = useAuthStore((s) => s.token)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    provider: 'bkash',
    gateway: 'personal',
    methodName: '',
    note: '',
    importantNote: '',
    detailsText: '',
    image: '',
    color: '#000000',
    bgColor: '#ffffff',
    buttonText: '',
    buttonTextColor: '#ffffff',
    buttonTextBgColor: '#4f46e5',
  })

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getWalletAgentTemplates(token)
      .then((res) => {
        const data = Array.isArray(res?.data) ? res.data : []
        setTemplates(data)
      })
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false))
  }, [token])

  const resetForm = () => {
    setForm({
      provider: 'bkash',
      gateway: 'personal',
      methodName: '',
      note: '',
      importantNote: '',
      detailsText: '',
      image: '',
      color: '#000000',
      bgColor: '#ffffff',
      buttonText: '',
      buttonTextColor: '#ffffff',
      buttonTextBgColor: '#4f46e5',
    })
  }

  const handleSelectExisting = (provider, gateway) => {
    const tpl = templates.find((t) => t.provider === provider && t.gateway === gateway)
    if (!tpl) {
      setForm((prev) => ({ ...prev, provider, gateway, methodName: '', note: '', importantNote: '', detailsText: '', image: '' }))
      return
    }
    setForm({
      provider: tpl.provider,
      gateway: tpl.gateway,
      methodName: tpl.methodName || '',
      note: tpl.note || '',
      importantNote: tpl.importantNote || '',
      detailsText: Array.isArray(tpl.details) ? tpl.details.join('\n') : '',
      image: tpl.image || '',
      color: tpl.color || '#000000',
      bgColor: tpl.bgColor || '#ffffff',
      buttonText: tpl.buttonText || '',
      buttonTextColor: tpl.buttonTextColor || '#ffffff',
      buttonTextBgColor: tpl.buttonTextBgColor || '#4f46e5',
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.provider || !form.gateway || !form.methodName) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const details = form.detailsText
        ? form.detailsText
            .split('\n')
            .map((d) => d.trim())
            .filter(Boolean)
        : []
      const res = await saveWalletAgentTemplate(token, {
        provider: form.provider,
        gateway: form.gateway,
        methodName: form.methodName,
        note: form.note,
        importantNote: form.importantNote,
        details,
        image: form.image,
        color: form.color,
        bgColor: form.bgColor,
        buttonText: form.buttonText,
        buttonTextColor: form.buttonTextColor,
        buttonTextBgColor: form.buttonTextBgColor,
      })
      const updated = templates.filter((t) => !(t.provider === res.data.provider && t.gateway === res.data.gateway))
      setTemplates([...updated, res.data])
      setSuccess('Template saved successfully')
    } catch (err) {
      setError(err?.data?.message || err.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    try {
      const res = await uploadPaymentPageImage(token, file)
      if (res?.url) {
        setForm((prev) => ({ ...prev, image: res.url }))
      }
    } catch (err) {
      setError(err.message || 'Image upload failed')
    }
  }

  const matrix = [
    { provider: 'bkash', label: 'bKash', color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20' },
    { provider: 'nagad', label: 'Nagad', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
    { provider: 'rocket', label: 'Rocket', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' },
    { provider: 'upay', label: 'Upay', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
             <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
               Global Payment Templates
             </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Configure default payment page templates for bKash, Nagad, Rocket, and Upay. These templates will be automatically applied to all wallet agents without individual configuration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Template Overview */}
        <div className="lg:col-span-5 space-y-4">
           <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
             <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-400" />
                Template Status
             </h3>
             
             {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-3">
                   <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
                   <p className="text-xs">Loading configuration...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {matrix.map((row) => (
                    <div key={row.provider} className={`rounded-2xl p-4 border transition-all ${row.bg}`}>
                      <div className={`font-bold mb-3 ${row.color} flex items-center gap-2`}>
                         <span className="text-sm">{row.label}</span>
                         <div className="h-[1px] flex-1 bg-current opacity-20" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {['personal', 'merchant'].map((gw) => {
                          const tpl = templates.find((t) => t.provider === row.provider && t.gateway === gw)
                          return (
                            <button
                              key={gw}
                              type="button"
                              onClick={() => handleSelectExisting(row.provider, gw)}
                              className={`relative group border rounded-xl px-3 py-2 text-left transition-all duration-300 overflow-hidden ${
                                tpl 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40' 
                                  : 'bg-black/20 border-white/5 hover:bg-white/5'
                              }`}
                            >
                              <div className="relative z-10">
                                <div className={`font-semibold mb-0.5 ${tpl ? 'text-emerald-300' : 'text-slate-400'}`}>
                                   {gw === 'merchant' ? 'Agent' : 'Personal'}
                                </div>
                                <div className="text-[10px] truncate opacity-70 text-slate-300">
                                  {tpl ? (
                                     <span className="flex items-center gap-1">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> Configured
                                     </span>
                                  ) : 'Not configured'}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>

        {/* Right Column: Editor */}
        <div className="lg:col-span-7">
           <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-6 shadow-xl relative">
              <div className="absolute top-0 right-0 p-6 opacity-30 pointer-events-none">
                 <CreditCard className="w-24 h-24 text-white/5 rotate-12" />
              </div>
              
              <div className="relative z-10">
                 <h3 className="text-lg font-bold text-white mb-2">Edit Configuration</h3>
                 <p className="text-xs text-slate-400 mb-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    Updates here will reflect across all wallet agent pages instantly. Ensure details are generically applicable.
                 </p>

                 <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                       <div className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5" /> {error}
                       </div>
                    )}
                    {success && (
                       <div className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {success}
                       </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Provider</label>
                        <select
                          value={form.provider}
                          onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-black/40 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500/50 transition-colors"
                        >
                          <option value="bkash">bKash</option>
                          <option value="nagad">Nagad</option>
                          <option value="rocket">Rocket</option>
                          <option value="upay">Upay</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Account Type</label>
                        <select
                          value={form.gateway}
                          onChange={(e) => setForm((p) => ({ ...p, gateway: e.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-black/40 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500/50 transition-colors"
                        >
                          <option value="personal">Personal Account</option>
                          <option value="merchant">Agent / Merchant</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Method Display Name *</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/10 bg-black/40 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500/50 transition-colors placeholder:text-slate-600"
                        value={form.methodName}
                        onChange={(e) => setForm((p) => ({ ...p, methodName: e.target.value }))}
                        placeholder="e.g. bKash Personal / bKash Agent"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Small Note (Optional)</label>
                         <input
                           type="text"
                           className="w-full rounded-xl border border-white/10 bg-black/40 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500/50 transition-colors placeholder:text-slate-600"
                           value={form.note}
                           onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                           placeholder="e.g. Personal Number"
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Important Highlight</label>
                         <input
                           type="text"
                           className="w-full rounded-xl border border-white/10 bg-black/40 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500/50 transition-colors placeholder:text-slate-600"
                           value={form.importantNote}
                           onChange={(e) => setForm((p) => ({ ...p, importantNote: e.target.value }))}
                           placeholder="e.g. Payment within 5 mins"
                         />
                       </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Instructions (One per line)</label>
                      <textarea
                        rows={4}
                        className="w-full rounded-xl border border-white/10 bg-black/40 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500/50 transition-colors placeholder:text-slate-600"
                        value={form.detailsText}
                        onChange={(e) => setForm((p) => ({ ...p, detailsText: e.target.value }))}
                        placeholder={"1. Select Send Money\n2. Enter the number below"}
                      />
                    </div>

                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                       <label className="block text-xs font-bold text-white mb-2">Theme Configuration</label>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         <div>
                           <label className="block text-[10px] font-medium text-slate-400 mb-1">Text Color</label>
                           <div className="flex gap-2 items-center bg-white/5 rounded-lg p-1.5 border border-white/5">
                              <input
                                type="color"
                                className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                                value={form.color}
                                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                              />
                              <span className="text-[10px] text-slate-400 font-mono">{form.color}</span>
                           </div>
                         </div>
                         <div>
                           <label className="block text-[10px] font-medium text-slate-400 mb-1">Background</label>
                           <div className="flex gap-2 items-center bg-white/5 rounded-lg p-1.5 border border-white/5">
                              <input
                                type="color"
                                className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                                value={form.bgColor}
                                onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                              />
                              <span className="text-[10px] text-slate-400 font-mono">{form.bgColor}</span>
                           </div>
                         </div>
                         <div>
                           <label className="block text-[10px] font-medium text-slate-400 mb-1">Button BG</label>
                           <div className="flex gap-2 items-center bg-white/5 rounded-lg p-1.5 border border-white/5">
                              <input
                                type="color"
                                className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                                value={form.buttonTextBgColor}
                                onChange={(e) => setForm((p) => ({ ...p, buttonTextBgColor: e.target.value }))}
                              />
                              <span className="text-[10px] text-slate-400 font-mono">{form.buttonTextBgColor}</span>
                           </div>
                         </div>
                         <div>
                           <label className="block text-[10px] font-medium text-slate-400 mb-1">Button Text</label>
                           <div className="flex gap-2 items-center bg-white/5 rounded-lg p-1.5 border border-white/5">
                              <input
                                type="color"
                                className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                                value={form.buttonTextColor}
                                onChange={(e) => setForm((p) => ({ ...p, buttonTextColor: e.target.value }))}
                              />
                              <span className="text-[10px] text-slate-400 font-mono">{form.buttonTextColor}</span>
                           </div>
                         </div>
                       </div>
                       
                       <div>
                         <label className="block text-[10px] font-medium text-slate-400 mb-1">Button Label</label>
                         <input
                           type="text"
                           className="w-full rounded-lg border border-white/10 bg-black/40 text-white text-xs px-3 py-2 focus:outline-none focus:border-violet-500/50 transition-colors"
                           value={form.buttonText}
                           onChange={(e) => setForm((p) => ({ ...p, buttonText: e.target.value }))}
                           placeholder="e.g. Pay Now"
                         />
                       </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-3 ml-1">Icon / Logo</label>
                      <div className="flex items-start gap-4">
                         <label className="flex-1 cursor-pointer group">
                            <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-700/50 rounded-xl bg-black/20 hover:bg-black/40 hover:border-violet-500/50 transition-all">
                               <Upload className="w-5 h-5 text-slate-500 group-hover:text-violet-400 mb-2" />
                               <span className="text-xs text-slate-500 group-hover:text-slate-300">Upload Image</span>
                               <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>
                         </label>
                         
                         {form.image && (
                            <div className="w-24 h-24 rounded-xl border border-white/10 bg-white/5 p-2 relative flex items-center justify-center">
                               <img
                                 src={form.image}
                                 alt="Preview"
                                 className="max-w-full max-h-full object-contain"
                               />
                               <button
                                 type="button"
                                 onClick={() => setForm((p) => ({ ...p, image: '' }))}
                                 className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg hover:bg-rose-600 transition-colors"
                               >
                                 <RotateCcw className="w-3 h-3" />
                               </button>
                            </div>
                         )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all disabled:opacity-60 flex items-center gap-2"
                      >
                        {saving ? (
                           <>
                             <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                             Saving...
                           </>
                        ) : (
                           <>
                             <Save className="w-3.5 h-3.5" />
                             Save Template
                           </>
                        )}
                      </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
