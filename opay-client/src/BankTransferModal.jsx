import React, { useState } from 'react';
import logo from './assets/appstore.png';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function BankTransferModal({ account, amount, sessionCode, onBack, onSubmitProof }) {
  const [proofs, setProofs] = useState([]); // Array of { id, file, preview, url }
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFilesAdd = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      // Create FormData to upload images to backend
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('proofs', file));

      const res = await fetch(`${API_URL}/api/uploads/bank-proof`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.urls)) {
        const newProofs = data.urls.map((url, idx) => ({
          id: Date.now() + '-' + idx + '-' + Math.random(),
          url: url.startsWith('http') ? url : `${API_URL}${url}`,
        }));
        setProofs((prev) => [...prev, ...newProofs]);
      } else {
        alert(data.message || 'Failed to upload proof image(s)');
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeleteProof = (id) => {
    setProofs((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (proofs.length === 0) {
      return alert('Please upload at least one screenshot proof of the bank transfer.');
    }
    setSubmitting(true);
    try {
      const proofUrls = proofs.map((p) => p.url);
      await onSubmitProof(proofUrls[0], account, proofUrls);
    } catch (err) {
      alert(err.message || 'Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  const cardBgColor = account?.bgColor || '#0f172a';
  const cardTextColor = account?.textColor || '#ffffff';
  const cardLabelColor = account?.labelColor || '#94a3b8';

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* ================= HEADER ================= */}
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
          {/* Account Details Card */}
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
                  <span className="text-[10px] block uppercase font-sans font-bold" style={{ color: cardLabelColor }}>Account Holder</span>
                  <span className="font-bold text-sm" style={{ color: cardTextColor }}>{account?.accountHolderName || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.accountHolderName, 'holder')}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer"
                  style={{ color: cardTextColor }}
                >
                  {copiedKey === 'holder' ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* Account Number */}
              <div className="flex items-center justify-between bg-white/10 p-2.5 rounded-xl border border-white/10">
                <div>
                  <span className="text-[10px] block uppercase font-sans font-bold" style={{ color: cardLabelColor }}>Account Number</span>
                  <span className="font-black text-base" style={{ color: cardTextColor }}>{account?.accountNumber || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.accountNumber, 'acc')}
                  className="px-3 py-1.5 bg-white/25 hover:bg-white/35 rounded-lg text-xs font-sans font-black shadow transition-colors cursor-pointer"
                  style={{ color: cardTextColor }}
                >
                  {copiedKey === 'acc' ? '✓ Copied' : 'Copy Acc'}
                </button>
              </div>

              {/* Branch & Location */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] block uppercase font-sans font-bold" style={{ color: cardLabelColor }}>Branch</span>
                  <span className="font-semibold truncate block" style={{ color: cardTextColor }}>{account?.branchName || 'N/A'}</span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] block uppercase font-sans font-bold" style={{ color: cardLabelColor }}>Location</span>
                  <span className="font-semibold truncate block" style={{ color: cardTextColor }}>{account?.upazilaThana}, {account?.district}</span>
                </div>
              </div>

              {/* Routing Number */}
              <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-[10px] block uppercase font-sans font-bold" style={{ color: cardLabelColor }}>Routing Number</span>
                  <span className="font-bold text-sm" style={{ color: cardTextColor }}>{account?.routingNumber || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(account?.routingNumber, 'routing')}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer"
                  style={{ color: cardTextColor }}
                >
                  {copiedKey === 'routing' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Multiple Proof Upload Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Bank Transfer Screenshot Proof *
                </label>
                <span className="text-[11px] font-bold text-emerald-600">
                  {proofs.length} Image(s) Attached
                </span>
              </div>

              <label className="block w-full border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-4 text-center cursor-pointer transition-colors">
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className="text-2xl">📸</span>
                  <span className="text-xs font-bold text-emerald-700">
                    {uploading ? 'Uploading Image...' : '+ Add Proof Image(s)'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Click to select multiple screenshots
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading}
                  onChange={handleFilesAdd}
                  className="hidden"
                />
              </label>
            </div>

            {/* Proof Images Gallery (CRUD) */}
            {proofs.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {proofs.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative group rounded-2xl overflow-hidden border border-gray-200 bg-gray-900 h-32 flex items-center justify-center p-1 shadow-sm"
                  >
                    <img src={item.url} alt={`Proof ${index + 1}`} className="w-full h-full object-contain rounded-xl" />
                    
                    {/* Image Order Badge */}
                    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      #{index + 1}
                    </span>

                    {/* Delete Button (CRUD) */}
                    <button
                      type="button"
                      onClick={() => handleDeleteProof(item.id)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow transition-transform hover:scale-110 cursor-pointer"
                      title="Delete Image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || uploading || proofs.length === 0}
              className={`w-full py-3.5 rounded-2xl text-base font-bold text-white shadow-lg transition-all ${
                proofs.length > 0 && !submitting && !uploading
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
