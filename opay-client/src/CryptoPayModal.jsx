import React, { useState, useEffect } from 'react';
import logo from "./assets/appstore.png";

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function CryptoPayModal({ amount, sessionCode, initialCryptoName, onBack, onSubmitSuccess }) {
  const [step, setStep] = useState(1); // 1 = Calculation, 2 = Payment Details & Screenshot
  const [loadingCryptos, setLoadingCryptos] = useState(true);
  const [supportedCryptos, setSupportedCryptos] = useState([]);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  
  // Account details loaded from random agent
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [agentAccount, setAgentAccount] = useState(null);
  const [accountError, setAccountError] = useState('');

  // Screenshot Upload State
  const [uploading, setUploading] = useState(false);
  const [proofUrls, setProofUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load supported cryptos from API
  useEffect(() => {
    async function loadCryptos() {
      try {
        setLoadingCryptos(true);
        const env = import.meta.env.VITE_APP_ENV || 'local';
        const res = await fetch(`${API_URL}/api/opay-business/supported-cryptos?env=${env}`);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setSupportedCryptos(data.data);
          const initial = initialCryptoName ? data.data.find(c => c.name === initialCryptoName) : null;
          setSelectedCrypto(initial || data.data[0]);
        } else {
          // Fallback mock cryptos if server has no entries yet
          const defaultCryptos = [
            {
              _id: 'default_usdt',
              name: 'Binance Pay',
              code: 'USDT',
              currency: 'USDT',
              rate: 120,
              chargePercent: 0,
              bgColor: '#021e38',
              logo: 'https://cdn.pixabay.com/photo/2021/04/30/16/47/binance-pay-6219323_12840.png'
            },
            {
              _id: 'default_tng',
              name: 'Touch and Go',
              code: 'RM',
              currency: 'RM',
              rate: 32,
              chargePercent: 2,
              bgColor: '#e6005c',
              logo: ''
            }
          ];
          setSupportedCryptos(defaultCryptos);
          setSelectedCrypto(defaultCryptos[0]);
        }
      } catch (err) {
        console.error('Failed to load supported cryptos:', err);
      } finally {
        setLoadingCryptos(false);
      }
    }

    loadCryptos();
  }, []);

  // Fetch random active agent account when proceeding to Step 2
  const handleProceedToStep2 = async () => {
    if (!selectedCrypto) return;
    setLoadingAccount(true);
    setAccountError('');
    try {
      const env = import.meta.env.VITE_APP_ENV || 'local';
      const res = await fetch(API_URL + "/api/opay-business/random-crypto-account?cryptoName=" + encodeURIComponent(selectedCrypto.name) + "&amount=" + totalPayBill.toFixed(2) + "&env=" + env + "&code=" + (sessionCode || ""));
      const data = await res.json();
      if (res.ok && data.success && data.account) {
        setAgentAccount(data.account);
        setStep(2);
      } else {
        setAccountError(data.message || 'এই ক্রিপ্টো মেথডে পেমেন্ট গ্রহণে কোনো সক্রিয় অ্যাকাউন্ট পাওয়া যায়নি');
      }
    } catch (err) {
      setAccountError('সার্ভারের সাথে সংযোগ স্থাপন করতে সমস্যা হচ্ছে');
    } finally {
      setLoadingAccount(false);
    }
  };

  // Calculations
  const rate = selectedCrypto?.rate || 1;
  const currency = selectedCrypto?.currency || 'USDT';
  const chargePercent = selectedCrypto?.chargePercent || 0;

  const baseCalculatedAmount = (Number(amount) || 0) / rate;
  const chargeAmount = baseCalculatedAmount * (chargePercent / 100);
  const totalPayBill = baseCalculatedAmount + chargeAmount;

  // Image File Upload
  const handleScreenshotUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (proofUrls.length + files.length > 5) {
      setErrorMsg('Maximum 5 proofs allowed');
      return;
    }

    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Each file must be under 5MB limit');
        return;
      }
    }

    setUploading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('proofs', file));

      const res = await fetch(API_URL + "/api/uploads/bank-proof", {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.urls && data.urls.length > 0) {
        setProofUrls(prev => [...prev, ...data.urls]);
      } else {
        setErrorMsg('Failed to upload screenshots');
      }
    } catch (err) {
      setErrorMsg('Screenshot upload error');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = null; // reset input
    }
  };

  // Copy Binance Pay ID / Wallet Address to clipboard
  const handleCopyAddress = () => {
    if (!agentAccount?.accountNumber) return;
    navigator.clipboard.writeText(agentAccount.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Submit Proof
  const handleSubmitProof = async () => {
    if (proofUrls.length === 0) {
      setErrorMsg('Please upload at least one payment screenshot proof');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(API_URL + "/api/opay-business/submit-crypto-proof", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: sessionCode,
          cryptoName: selectedCrypto?.name,
          proofUrls,
          agentAccountId: agentAccount?._id,
          userPayAmount: totalPayBill.toFixed(2),
          cryptoCurrency: currency
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSubmitSuccess(data.redirect_url || data.success_redirect_url || data.successRedirectUrl);
      } else {
        setErrorMsg(data.message || 'Failed to submit crypto payment proof');
      }
    } catch (err) {
      setErrorMsg('Server connection error during submission');
    } finally {
      setSubmitting(false);
    }
  };

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return API_URL + (url.startsWith('/') ? '' : '/') + url;
  };

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative border border-gray-100">
        
        {/* ================= TOP HEADER ================= */}
        <div
          className="relative px-6 pt-6 pb-12 text-white"
          style={{
            background: "linear-gradient(135deg, #1b0a48, #0e8c6d)",
          }}
        >
          <div className="flex justify-between items-center">
            <button onClick={step === 2 ? () => setStep(1) : onBack} className="text-2xl opacity-80 hover:opacity-100 transition-opacity">
              ←
            </button>
            <button onClick={onBack} className="text-2xl opacity-80 hover:opacity-100 transition-opacity">
              ×
            </button>
          </div>

          <div className="mt-2 flex flex-col items-center text-center gap-1">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center p-2">
              <img src={logo} alt="Opay" className="w-full h-full object-contain" />
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-wide">Opay</h1>
            <div className="mt-1 px-3 py-[2px] rounded-full bg-white/20 backdrop-blur inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-400 text-[10px] font-bold text-white">
                i
              </span>
              <p className="text-xs tracking-wide">
                Session #{sessionCode || 'db433d06e1'}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-[10px]">
              <span className="px-2.5 py-1 rounded-full bg-white/15 uppercase font-medium">? Support</span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 uppercase font-medium">⚡ Fast Help</span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 uppercase font-medium">🛡️ Secure Pay</span>
            </div>
          </div>
        </div>

        {/* ================= STEP 1: CALCULATION VIEW (Screenshot 3) ================= */}
        {step === 1 && (
          <div className="p-5 space-y-5 -mt-6 relative z-10">
            
            {/* PAYABLE AMOUNT BANNER */}
            <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-indigo-900 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg border border-emerald-400/20">
               <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                 👛
               </div>
               <div className="text-center flex-1">
                 <p className="text-[11px] uppercase tracking-widest font-bold text-emerald-200">Payable Amount</p>
                 <p className="text-2xl font-black">{Number(amount).toFixed(0)} BDT</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                 🔒
               </div>
            </div>

            {/* TAB / CATEGORY BANNER */}
            <div className="text-center">
               <span className="inline-block px-6 py-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md">
                 🌐 International & Crypto Pay
               </span>
            </div>

            {/* SELECTION DROPDOWN SECTION */}
            <div className="space-y-4 bg-gray-50/80 p-4 rounded-2xl border border-gray-200">
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    Select Method / Currency:
                  </label>
                  
                  {loadingCryptos ? (
                    <div className="py-3 text-center text-sm text-gray-400">Loading Crypto Methods...</div>
                  ) : (
                    <select
                      value={selectedCrypto?._id || ''}
                      onChange={(e) => {
                        const target = supportedCryptos.find(c => c._id === e.target.value);
                        if (target) setSelectedCrypto(target);
                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                    >
                      {supportedCryptos.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.currency || 'USDT'}) - 1 {c.currency || 'USDT'} = {c.rate} BDT
                        </option>
                      ))}
                    </select>
                  )}
               </div>

               {/* CALCULATION CARD (Matches Screenshot 3) */}
               <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-100">
                     <span className="text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        📊 Today Rate
                     </span>
                     <span className="font-extrabold text-slate-800 text-sm">
                        1 {currency} = {rate} BDT
                     </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-100">
                     <span className="text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        🔄 You Pay
                     </span>
                     <span className="font-extrabold text-slate-800 text-sm">
                        {amount} BDT = {baseCalculatedAmount.toFixed(2)} {currency}
                     </span>
                  </div>

                  {chargePercent > 0 && (
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-100">
                       <span className="text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          💵 Converting Charge ({chargePercent}%)
                       </span>
                       <span className="font-extrabold text-amber-600 text-sm">
                          {chargeAmount.toFixed(2)} {currency}
                       </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs pt-1">
                     <span className="text-gray-700 font-extrabold uppercase tracking-wider flex items-center gap-1">
                        📑 Total Pay Bill
                     </span>
                     <span className="font-black text-emerald-600 text-base">
                        {totalPayBill.toFixed(2)} {currency}
                     </span>
                  </div>
               </div>
            </div>

            {/* HIGHLIGHT BANNER (Matches Screenshot 3) */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center shadow-sm">
               <p className="text-sm font-black text-purple-700">
                 আপনার পরিশোধ করতে হবে - {totalPayBill.toFixed(2)} {currency}
               </p>
            </div>

            {/* BENGALI INSTRUCTION NOTE */}
            <div className="bg-purple-500/10 border border-purple-200 rounded-xl p-3 flex items-start gap-2.5">
               <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                 i
               </span>
               <p className="text-[11px] text-purple-900 font-medium leading-relaxed">
                 আপনি সঠিক পরিমাণে {totalPayBill.toFixed(2)} {currency} মাধ্যমে ডিপোজিট করতে পে করার পর পেমেন্ট প্রুফ বা স্ক্রিনশট আপলোড করে কনফার্ম করুন ।
               </p>
            </div>

            {accountError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl p-3 text-center shadow-sm">
                ⚠️ {accountError}
              </div>
            )}

            {/* PAY NOW BUTTON */}
            <button
              onClick={handleProceedToStep2}
              disabled={loadingAccount}
              className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-transform hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #10b981, #6366f1)" }}
            >
              🔒 Pay Now - {totalPayBill.toFixed(2)} Confirm
            </button>
          </div>
        )}

        {/* ================= STEP 2: CHECKOUT DETAILS & PROOF UPLOAD (Screenshots 1 & 2) ================= */}
        {step === 2 && (
          <div className="p-5 space-y-4 -mt-6 relative z-10">

            {/* THE CARD CONTAINER matching user screenshot 2 layout */}
            <div 
              className="rounded-2xl p-5 text-white shadow-xl space-y-4 border border-white/10"
              style={{ backgroundColor: selectedCrypto?.bgColor || '#031b33' }}
            >
              
              {/* TOTAL AMOUNT BADGE */}
              <div className="bg-emerald-700/80 border border-emerald-400/30 rounded-xl p-3 text-center shadow-inner">
                <p className="text-xs uppercase font-bold tracking-widest text-emerald-200">Amount to Pay</p>
                <p className="text-2xl font-black tracking-tight text-white">
                  AMOUNT {totalPayBill.toFixed(2)} {currency}
                </p>
              </div>

              {/* METHOD LOGO / NAME BADGE */}
              <div className="bg-amber-400 text-slate-900 rounded-xl py-3 px-4 font-black text-center text-lg shadow-md flex items-center justify-center gap-3">
                {selectedCrypto?.logo ? (
                  <img src={formatImgUrl(selectedCrypto.logo)} alt={selectedCrypto.name} className="w-7 h-7 object-contain" />
                ) : (
                  <span className="text-xl">❖</span>
                )}
                <span>{selectedCrypto?.name || 'Crypto Pay'}</span>
              </div>

              {/* WALLET AGENT ACCOUNT DETAILS */}
              <div className="bg-white border-x border-b border-gray-200 rounded-2xl shadow-md p-4 space-y-3 mb-4">
                {[
                  { icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', label: 'ACCOUNT NAME', value: agentAccount?.accountHolderName || selectedCrypto?.name },
                  { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'WALLET ADDRESS', value: agentAccount?.accountNumber || '1234567899' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{item.label}</span>
                    </div>
                    <div className="flex items-center justify-between group">
                      <span className="text-xs font-black text-gray-800 font-mono tracking-wide break-all mr-2">{item.value}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          navigator.clipboard.writeText(item.value || '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-[9px] font-bold text-[#0EB78C] bg-[#0EB78C]/10 px-1.5 py-0.5 rounded cursor-pointer transition-opacity shrink-0"
                      >
                        {copied ? 'COPIED' : 'COPY'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* QR CODE DISPLAY (If available) */}
              {agentAccount?.qrCodeLogo && (
                <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center max-w-[200px] mx-auto shadow-md">
                   <img src={formatImgUrl(agentAccount.qrCodeLogo)} alt="QR Code" className="w-36 h-36 object-contain" />
                   <span className="text-[10px] font-bold text-slate-800 mt-1">SCAN QR TO PAY</span>
                </div>
              )}

              {/* UPLOAD SCREENSHOT BOX (Matching screenshot 1 & 2) */}
              <div className="bg-purple-900/40 border-2 border-dashed border-purple-400/40 rounded-xl p-4 text-center hover:border-purple-400 transition-colors">
                <label className="cursor-pointer block">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-purple-200">
                          {proofUrls.length > 0 ? proofUrls.length + ' File(s) Selected - Upload More' : 'Upload Screenshot Proof'}
                        </p>
                      <p className="text-[10px] text-purple-300/70 mt-0.5">JPG, PNG, PDF (Max 5MB)</p>
                    </div>
                  </div>
                  <input type="file" multiple accept="image/*,.pdf" onChange={handleScreenshotUpload} className="hidden" />
                </label>
                {uploading && <p className="text-xs text-yellow-300 mt-2 font-bold animate-pulse">Uploading screenshot(s)...</p>}
                
                {proofUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 justify-center">
                    {proofUrls.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={formatImgUrl(url)} alt={"Proof " + (i+1)} className="w-12 h-12 object-cover rounded-md border border-purple-400/30" />
                        <button 
                          onClick={(e) => { e.preventDefault(); setProofUrls(prev => prev.filter((_, idx) => idx !== i)); }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {proofUrls.length > 0 && !uploading && <p className="text-xs text-emerald-400 mt-2 font-bold">✓ Screenshot(s) Uploaded!</p>}
              </div>

              {/* INFO NOTICE BANNER */}
              <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed text-slate-200">
                 <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                   i
                 </span>
                 <p>
                   এই আইডিতে/ঠিকানায় পেমেন্ট করে স্ক্রিনশট আপলোড করে নিচের <strong className="text-amber-300">কনফার্ম পেমেন্ট</strong> বাটন ক্লিক করুন ।
                 </p>
              </div>

            </div>

            {/* ERROR DISPLAY */}
            {errorMsg && (
              <div className="bg-rose-100 border border-rose-300 text-rose-700 px-4 py-2.5 rounded-xl text-xs font-bold text-center">
                {errorMsg}
              </div>
            )}

            {/* CONFIRM PAYMENT BUTTON */}
            <button
              onClick={handleSubmitProof}
              disabled={submitting || proofUrls.length === 0}
              className={`w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-transform flex items-center justify-center gap-2 ${
                proofUrls.length > 0 && !submitting ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-[1.01] active:scale-95' : 'bg-slate-400 cursor-not-allowed opacity-70'
              }`}
            >
              {submitting ? (
                <span>Processing Payment...</span>
              ) : (
                <>
                  <span>✈️</span>
                  <span>Confirm Payment</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-center text-gray-400 pt-1">
              By continuing, you agree to our Terms & Conditions
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
