import React, { useState } from 'react';
import logo from './assets/appstore.png';

export default function BankTransferModal({ account, amount, sessionCode, onBack, onSubmitProof }) {
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proofPreview) {
      return alert('Please upload a screenshot proof of the bank transfer.');
    }
    setSubmitting(true);
    try {
      await onSubmitProof(proofPreview, account);
    } catch (err) {
      alert(err.message || 'Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Bar matching standard gateway layout */}
        <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-gray-100 p-1 flex items-center justify-center bg-white">
              <img src={logo} alt="Opay" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight" style={{ color: '#0B8D7D' }}>
                Opay Payment
              </h1>
              <p className="text-[10px] text-gray-400 font-mono font-semibold">
                Session #{sessionCode || '9cfb2f8794'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Fast Help: Transfer payable amount to the provided bank account and upload receipt screenshot.')}
              className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold border border-teal-200/60 flex items-center gap-1 hover:bg-teal-100 transition-colors"
            >
              <span>⚡</span> Fast Help
            </button>
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center gap-1">
              ★ Secure
            </span>
          </div>
        </div>

        {/* Modal Navigation Bar */}
        <div className="px-6 py-3 bg-gradient-to-r from-teal-700 via-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <button onClick={onBack} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors">
            ← Change Method
          </button>
          <span className="font-black text-xs uppercase tracking-widest text-emerald-300">Bank Transfer</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Payable Amount Badge */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/70 text-center shadow-sm">
            <p className="text-xs text-teal-700 font-extrabold uppercase tracking-wider">Payable Amount</p>
            <p className="text-3xl font-black text-slate-900 mt-1">৳{Number(amount).toFixed(2)}</p>
          </div>

          {/* Account Details Box with Copy Buttons */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3.5 relative shadow-xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>🏦</span> {account?.bankName || 'Bank Details'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified Account
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {/* Account Holder */}
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-sans font-semibold">Account Holder</span>
                  <span className="font-bold text-white text-sm">{account?.accountHolderName || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.accountHolderName, 'holder')}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-sans font-bold text-emerald-300 transition-colors"
                >
                  {copiedKey === 'holder' ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* Account Number */}
              <div className="flex items-center justify-between bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                <div>
                  <span className="text-[10px] text-emerald-400 block uppercase font-sans font-bold">Account Number</span>
                  <span className="font-black text-emerald-400 text-base">{account?.accountNumber || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.accountNumber, 'acc')}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-sans font-black shadow-md transition-colors"
                >
                  {copiedKey === 'acc' ? '✓ Copied' : 'Copy Acc'}
                </button>
              </div>

              {/* Branch & Location */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 block uppercase font-sans font-semibold">Branch</span>
                  <span className="font-bold text-slate-200 truncate block">{account?.branchName || 'N/A'}</span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 block uppercase font-sans font-semibold">Location</span>
                  <span className="font-bold text-slate-200 truncate block">{account?.upazilaThana}, {account?.district}</span>
                </div>
              </div>

              {/* Routing Number */}
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-sans font-semibold">Routing Number</span>
                  <span className="font-bold text-amber-300 text-sm">{account?.routingNumber || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.routingNumber, 'routing')}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-sans font-bold text-amber-300 transition-colors"
                >
                  {copiedKey === 'routing' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Upload Proof Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Upload Bank Transfer Screenshot Proof *
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            {proofPreview && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-48 flex justify-center p-2">
                <img src={proofPreview} alt="Proof preview" className="max-h-44 object-contain rounded-xl" />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !proofPreview}
              className={`w-full py-4 rounded-2xl text-base font-black text-white uppercase tracking-wider shadow-lg transition-all ${
                proofPreview && !submitting
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 cursor-pointer shadow-emerald-500/20'
                  : 'bg-slate-300 opacity-60 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Submitting Proof...' : 'Submit Payment Proof'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
