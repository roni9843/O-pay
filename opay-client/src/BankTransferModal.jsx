import React, { useState } from 'react';

export default function BankTransferModal({ account, amount, onBack, onSubmitProof }) {
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 to-violet-800 text-white flex items-center justify-between">
          <button onClick={onBack} className="text-xl font-bold opacity-80 hover:opacity-100">← Back</button>
          <span className="font-bold text-sm uppercase tracking-wider">Bank Transfer</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount Badge */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Payable Amount</p>
            <p className="text-2xl font-black text-indigo-950 mt-1">৳{Number(amount).toFixed(2)}</p>
          </div>

          {/* Account Details Box */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 relative shadow-inner">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider border-b border-white/10 pb-2">
              {account?.bankName || 'Bank Details'}
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Account Holder:</span>
                <span className="font-bold text-white">{account?.accountHolderName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Number:</span>
                <span className="font-bold text-emerald-400 text-sm">{account?.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Branch Name:</span>
                <span className="font-bold text-slate-200">{account?.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="font-bold text-slate-200">{account?.upazilaThana}, {account?.district}, {account?.division}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <span className="text-slate-400">Routing Number:</span>
                <span className="font-bold text-amber-300">{account?.routingNumber}</span>
              </div>
            </div>
          </div>

          {/* Upload Proof Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Upload Payment Screenshot Proof *
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            {proofPreview && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-48 flex justify-center p-2">
                <img src={proofPreview} alt="Proof preview" className="max-h-44 object-contain rounded-xl" />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !proofPreview}
              className={`w-full py-4 rounded-2xl text-base font-bold text-white shadow-lg transition-all ${
                proofPreview && !submitting
                  ? 'bg-gradient-to-r from-emerald-500 to-indigo-600 hover:opacity-95 cursor-pointer'
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
