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

  const cardBgColor = account?.bgColor || '#0f172a';
  const cardTextColor = account?.textColor || '#ffffff';

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* ================= HEADER (ALWAYS SAME HOME GRADIENT & OPAY LOGO) ================= */}
        <div
          className="relative px-6 pt-6 pb-20 text-white"
          style={{
            background: "linear-gradient(135deg, #211060, #20CFA2)",
          }}
        >
          <div className="flex justify-between items-center">
            <button onClick={onBack} className="text-2xl opacity-80 hover:opacity-100 cursor-pointer">
              ←
            </button>
            <button onClick={onBack} className="text-2xl opacity-80 hover:opacity-100 cursor-pointer">
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center text-center gap-1">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center p-2">
              <img src={logo} alt="Opay" className="w-full h-full object-contain" />
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-wide">Opay</h1>
            
            <div className="mt-1 px-3 py-[2px] rounded-full bg-white/20 backdrop-blur inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400 text-[10px] font-bold text-white">
                i
              </span>
              <p className="text-xs tracking-wide">
                {sessionCode ? `Session #${sessionCode}` : 'Bank Transfer'}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-center gap-3 text-[10px]">
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <span className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center text-[9px] text-white font-semibold">
                  ?
                </span>
                <span className="uppercase tracking-wide">Support</span>
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <span className="w-4 h-4 rounded-full bg-sky-400 flex items-center justify-center text-[9px] text-white font-semibold">
                  ⚡
                </span>
                <span className="uppercase tracking-wide">Fast Help</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[9px] text-white font-semibold">
                  ★
                </span>
                <span className="uppercase tracking-wide">Secure Pay</span>
              </div>
            </div>
          </div>

          {/* Floating Payable Amount Card */}
          <div className="absolute left-1/2 -bottom-10 -translate-x-1/2 w-[90%] bg-white rounded-2xl shadow-lg px-6 py-4 text-center border border-gray-100">
            <p className="text-sm text-gray-500">Payable Amount</p>
            <p className="text-2xl font-bold" style={{ color: "#211060" }}>
              ৳{Number(amount).toFixed(2)}
            </p>
          </div>
        </div>

        {/* ================= CONTENT BODY ================= */}
        <div className="mt-12 p-6 space-y-5">
          {/* Account Details Card (CUSTOM ADMIN BG COLOR & TEXT COLOR APPLIED HERE) */}
          <div
            style={{ backgroundColor: cardBgColor, color: cardTextColor }}
            className="p-5 rounded-2xl space-y-3.5 shadow-xl border border-black/10 transition-colors duration-300"
          >
            <div className="flex items-center justify-between border-b border-black/10 pb-2.5">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: cardTextColor }}>
                {account?.bankLogo ? (
                  <img src={account.bankLogo} alt="Logo" className="w-6 h-6 object-contain bg-white rounded p-0.5" />
                ) : (
                  '🏦'
                )}
                <span>{account?.bankName || 'Bank Details'}</span>
              </h3>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30" style={{ color: cardTextColor }}>
                Active Agent
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {/* Account Holder */}
              <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-sans">Account Holder</span>
                  <span className="font-bold text-white text-sm">{account?.accountHolderName || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.accountHolderName, 'holder')}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-sans font-medium text-emerald-300 transition-colors"
                >
                  {copiedKey === 'holder' ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* Account Number */}
              <div className="flex items-center justify-between bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
                <div>
                  <span className="text-[10px] text-emerald-400 block uppercase font-sans font-bold">Account Number</span>
                  <span className="font-extrabold text-emerald-400 text-base">{account?.accountNumber || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.accountNumber, 'acc')}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 rounded-lg text-xs font-sans font-bold shadow transition-colors"
                >
                  {copiedKey === 'acc' ? '✓ Copied' : 'Copy Acc'}
                </button>
              </div>

              {/* Branch & Location */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-400 block uppercase font-sans">Branch</span>
                  <span className="font-semibold text-gray-200 truncate block">{account?.branchName || 'N/A'}</span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-400 block uppercase font-sans">Location</span>
                  <span className="font-semibold text-gray-200 truncate block">{account?.upazilaThana}, {account?.district}</span>
                </div>
              </div>

              {/* Routing Number */}
              <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-sans">Routing Number</span>
                  <span className="font-bold text-amber-300 text-sm">{account?.routingNumber || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.routingNumber, 'routing')}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-sans font-medium text-amber-300 transition-colors"
                >
                  {copiedKey === 'routing' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Upload Proof Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Upload Bank Transfer Screenshot Proof *
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleFileChange}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            {proofPreview && (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-900 max-h-48 flex justify-center p-2">
                <img src={proofPreview} alt="Proof preview" className="max-h-44 object-contain rounded-xl" />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !proofPreview}
              className={`w-full py-3.5 rounded-2xl text-base font-bold text-white shadow-lg transition-all ${
                proofPreview && !submitting
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 cursor-pointer'
                  : 'bg-gray-300 opacity-60 cursor-not-allowed'
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
