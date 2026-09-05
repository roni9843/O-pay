import React, { useState, useRef, useEffect } from 'react';
import logo from './assets/appstore.png'; // Make sure path is correct

export default function BankTransferModal({ account, amount, sessionCode, supportedBanks = [], onBack, onSubmitProof }) {
  const [selectedBank, setSelectedBank] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [accountNumber, setAccountNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [verifiedAgentAccount, setVerifiedAgentAccount] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);

  // Custom Alert State
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: '',
    type: 'info' // 'info', 'success', 'error'
  });

  const showCustomAlert = (message, type = 'info') => {
    setAlertState({ isOpen: true, message, type });
  };

  const closeCustomAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeBanks = supportedBanks.filter(b => b.status !== 'inactive');

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Format and validate BD Number
  const getFormattedMobileNumber = (raw) => {
    // Strip non-numeric chars
    let num = raw.replace(/[^0-9]/g, '');
    // If user typed 8801... or +8801..., make it 01...
    if (num.length > 11 && num.startsWith('8801')) {
      num = num.substring(2);
    }
    return num;
  };

  const handleMobileNumberChange = (e) => {
    const raw = e.target.value;
    const formatted = getFormattedMobileNumber(raw);
    if (formatted.length <= 11) {
      setMobileNumber(formatted);
    }
  };

  const isMobileValid = mobileNumber.length === 11 && mobileNumber.startsWith('01');

  const handleSendOtp = async () => {
    if (!mobileNumber) return showCustomAlert('Please enter your mobile number', 'error');
    if (!isMobileValid) return showCustomAlert('Please enter a valid 11-digit Bangladeshi mobile number (e.g., 017...)', 'error');

    setOtpSending(true);
    try {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
      const res = await fetch(`${base}/api/opay-business/send-bank-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: mobileNumber })
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpSent(true);
        showCustomAlert('OTP sent to ' + mobileNumber, 'success');
      } else {
        showCustomAlert(data.message || 'Failed to send OTP', 'error');
      }
    } catch (err) {
      showCustomAlert('Error sending OTP. Please try again.', 'error');
    } finally {
      setOtpSending(false);
    }
  };

  const [accountHolderName, setAccountHolderName] = useState('');

  const handleVerifyOtp = async () => {
    if (!otp) return showCustomAlert('Please enter OTP', 'error');
    
    setOtpVerifying(true);
    try {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
      const res = await fetch(`${base}/api/opay-business/verify-bank-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: mobileNumber, otp, bankName: selectedBank?.name, amount, agentBankAccountId: account?.bankAccountId })
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpVerified(true);
        setVerifiedAgentAccount(data.agentAccount);
        showCustomAlert('OTP Verified Successfully', 'success');
      } else {
        showCustomAlert(data.message || 'Invalid OTP', 'error');
      }
    } catch (err) {
      showCustomAlert('Error verifying OTP. Please try again.', 'error');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return showCustomAlert('File size should not exceed 5MB', 'error');
      }
      setProofFile(file);
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBank || !accountNumber || !mobileNumber || !isOtpVerified) {
      return showCustomAlert('Please fill in all details and verify OTP.', 'error');
    }
    
    setSubmitting(true);
    try {
      let finalProofUrl = 'https://dummy-proof-url.com/proof.png';
      
      // Upload proofFile to the server
      if (proofFile) {
        const formData = new FormData();
        formData.append('proofs', proofFile);
        const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
        const uploadRes = await fetch(`${base}/api/uploads/bank-proof`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.urls && uploadData.urls.length > 0) {
          finalProofUrl = uploadData.urls[0];
        } else {
          throw new Error('Image upload failed');
        }
      }

      await onSubmitProof(finalProofUrl, {
        selectedBank: selectedBank.name,
        accountNumber,
        accountHolderName,
        mobileNumber,
        otp,
        agentAccount: verifiedAgentAccount
      }, [finalProofUrl]);
    } catch (err) {
      showCustomAlert(err.message || 'Failed to submit payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-visible relative z-10">
        
        {/* ================= HEADER ================= */}
        <div className="relative px-6 pt-6 pb-28 text-white rounded-t-[32px] overflow-hidden"
          style={{ background: "linear-gradient(135deg, #16007A, #0EB78C)" }}
        >
          <div className="flex justify-between items-center relative z-10">
            <button onClick={onBack} className="text-2xl opacity-80 hover:opacity-100 cursor-pointer">
              ←
            </button>
            <button onClick={onBack} className="text-2xl opacity-80 hover:opacity-100 cursor-pointer">
              ×
            </button>
          </div>

          <div className="mt-2 flex flex-col items-center text-center gap-1 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center p-2">
              <img src={logo} alt="Opay" className="w-full h-full object-contain" />
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-wide">Opay</h1>
            
            <div className="mt-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0EB78C] text-[10px] font-bold text-white">
                i
              </span>
              <p className="text-xs tracking-wide">
                {sessionCode ? `Session #${sessionCode}` : 'Bank Transfer'}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-center gap-3 text-[10px]">
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1e075f]/50 border border-white/10">
                <span className="w-4 h-4 rounded-full bg-[#0EB78C] flex items-center justify-center text-[9px] text-white font-semibold">
                  ?
                </span>
                <span className="uppercase tracking-wide font-medium">Support</span>
              </div>
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1e075f]/50 border border-white/10">
                <span className="w-4 h-4 rounded-full bg-sky-400 flex items-center justify-center text-[9px] text-white font-semibold">
                  ⚡
                </span>
                <span className="uppercase tracking-wide font-medium">Fast Help</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1e075f]/50 border border-white/10">
                <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[9px] text-white font-semibold">
                  ★
                </span>
                <span className="uppercase tracking-wide font-medium">Secure Pay</span>
              </div>
            </div>
          </div>

          {/* Background decorative dots (approximate) */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        </div>

        {/* Floating Amount Card */}
        <div className="px-6 -mt-16 relative z-20">
          <div className="bg-[#0f605c] rounded-[24px] shadow-lg p-5 flex items-center justify-between border-4 border-white">
             <div>
                <p className="text-[10px] text-emerald-200/80 font-bold tracking-widest uppercase mb-1">
                   Amount To Pay
                </p>
                <p className="text-3xl font-black text-white">
                  {Number(amount).toFixed(0)} BDT
                </p>
             </div>
             <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
             </div>
          </div>
        </div>

        {/* ================= CONTENT BODY ================= */}
        <div className="px-6 pt-6 pb-6 space-y-4">
          
          {/* Payment Method Header - Only show if not verified */}
          {!isOtpVerified && (
            <div className="bg-[#783ce2] text-white rounded-[16px] p-3 pl-4 flex items-center shadow-md">
               <div>
                  <p className="text-[9px] uppercase tracking-wider font-semibold opacity-80 mb-0.5">Payment Method</p>
                  <p className="font-bold text-sm tracking-wide">{account?.bankName || 'BANK DEPOSIT (NPSB)'}</p>
               </div>
            </div>
          )}

          {/* Form Fields */}
          <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
            
            {!isOtpVerified ? (
              <>
                {/* Bank Select (Custom Dropdown) */}
            <div className="flex gap-4 items-start">
               <div className="flex-shrink-0 mt-1 w-10 h-10 rounded-full bg-[#783ce2] flex items-center justify-center text-white shadow-md relative z-30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00-.504-.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
               </div>
               <div className="flex-1 relative" ref={dropdownRef}>
                 <label className="block text-xs font-bold text-[#5c6999] mb-1.5">
                   যে ব্যাংক থেকে টাকা পাঠাবেন সেই ব্যাংক সিলেক্ট করুন
                 </label>
                 
                 {/* Dropdown Toggle */}
                 <div 
                   onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                   className="w-full border border-gray-200 rounded-xl p-3 bg-white shadow-sm flex items-center justify-between cursor-pointer focus:border-[#0EB78C] focus:ring-1 focus:ring-[#0EB78C]"
                 >
                    {selectedBank ? (
                      <div className="flex items-center gap-3">
                        {selectedBank.logo ? (
                          <img src={formatImgUrl(selectedBank.logo)} alt={selectedBank.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00-.504-.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          </div>
                        )}
                        <span className="text-sm font-bold text-gray-800 line-clamp-1">{selectedBank.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-gray-400">Select Bank</span>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                 </div>

                 {/* Dropdown Menu */}
                 {isDropdownOpen && (
                   <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                     {activeBanks.length === 0 ? (
                       <div className="p-3 text-sm text-gray-500 text-center">No banks available</div>
                     ) : (
                       activeBanks.map((bank) => (
                         <div 
                           key={bank._id || bank.name} 
                           onClick={() => {
                             setSelectedBank(bank);
                             setIsDropdownOpen(false);
                           }}
                           className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                         >
                            {bank.logo ? (
                              <img src={formatImgUrl(bank.logo)} alt={bank.name} className="w-8 h-8 object-contain" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00-.504-.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                              </div>
                            )}
                            <span className="text-sm font-bold text-gray-700">{bank.name}</span>
                         </div>
                       ))
                     )}
                   </div>
                 )}
               </div>
            </div>

            {/* Account Number */}
            <div className="flex gap-4 items-start relative z-10">
               <div className="flex-shrink-0 mt-1 w-10 h-10 rounded-full bg-[#521ea8] flex items-center justify-center text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
               </div>
               <div className="flex-1">
                 <label className="text-xs font-bold text-[#5c6999] mb-1.5 flex justify-between items-center">
                   <span>আপনার একাউন্ট নম্বর লিখুন</span>
                   <span className={`text-[10px] ${accountNumber.length > 8 ? 'text-[#0EB78C]' : 'text-gray-400'}`}>
                     {accountNumber.length > 0 ? `${accountNumber.length} digits` : ''}
                   </span>
                 </label>
                 <div className="relative">
                   <input 
                      type="text" 
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 10512345678"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-800 bg-white shadow-sm focus:border-[#0EB78C] focus:ring-1 focus:ring-[#0EB78C] outline-none"
                   />
                   <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0EB78C]">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                     </svg>
                   </button>
                 </div>
               </div>
            </div>

            {/* Account Holder Name */}
            <div className="flex gap-4 items-start relative z-10">
               <div className="flex-shrink-0 mt-1 w-10 h-10 rounded-full bg-[#e23c8f] flex items-center justify-center text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
               </div>
               <div className="flex-1">
                 <label className="text-xs font-bold text-[#5c6999] mb-1.5 flex justify-between items-center">
                   <span>একাউন্ট হোল্ডারের নাম লিখুন (ঐচ্ছিক)</span>
                 </label>
                 <div className="relative">
                   <input 
                      type="text" 
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-800 bg-white shadow-sm focus:border-[#0EB78C] focus:ring-1 focus:ring-[#0EB78C] outline-none"
                   />
                 </div>
               </div>
            </div>

            {/* Mobile Number & OTP Send */}
            <div className="flex gap-4 items-start relative z-10">
               <div className="flex-shrink-0 mt-1 w-10 h-10 rounded-full bg-[#3d0d82] flex items-center justify-center text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
               </div>
               <div className="flex-1">
                 <label className="text-xs font-bold text-[#5c6999] mb-1.5 flex justify-between items-center">
                   <span>আপনার মোবাইল নম্বর লিখুন</span>
                   <span className={`text-[10px] ${mobileNumber.length === 11 ? 'text-[#0EB78C]' : 'text-gray-400'}`}>
                     {mobileNumber.length} / 11 digits
                   </span>
                 </label>
                 <div className="flex gap-2">
                   <input 
                      type="text" 
                      value={mobileNumber}
                      onChange={handleMobileNumberChange}
                      placeholder="e.g. 017XXXXXXXX"
                      disabled={isOtpSent}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-800 bg-white shadow-sm focus:border-[#0EB78C] focus:ring-1 focus:ring-[#0EB78C] outline-none disabled:bg-gray-100"
                   />
                   <button 
                     type="button" 
                     onClick={handleSendOtp}
                     disabled={!isMobileValid || isOtpSent || otpSending}
                     className="whitespace-nowrap px-4 bg-[#4dbd74] hover:bg-[#3ea05f] text-white text-xs font-bold rounded-xl shadow flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {otpSending ? (
                       <span className="animate-pulse">Sending...</span>
                     ) : isOtpSent ? (
                       'Sent'
                     ) : (
                       <>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                         </svg>
                         Send OTP
                       </>
                     )}
                   </button>
                 </div>
               </div>
            </div>

            {/* OTP Verify */}
            <div className="flex gap-4 items-start relative z-10">
               <div className="flex-shrink-0 mt-1 w-10 h-10 rounded-full bg-[#783ce2] flex items-center justify-center text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
               </div>
               <div className="flex-1">
                 <label className="block text-xs font-bold text-[#5c6999] mb-1.5">
                   আপনার নাম্বারে পাঠানো ও টি পি লিখুন
                 </label>
                 <div className="flex gap-2">
                   <input 
                      type="text" 
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      disabled={!isOtpSent || isOtpVerified}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-800 bg-white shadow-sm focus:border-[#0EB78C] focus:ring-1 focus:ring-[#0EB78C] outline-none disabled:bg-gray-100"
                   />
                   <button 
                     type="button" 
                     onClick={handleVerifyOtp}
                     disabled={!isOtpSent || isOtpVerified || otpVerifying || otp.length < 4}
                     className={`whitespace-nowrap px-4 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1 transition-colors ${isOtpVerified ? 'bg-gray-400' : 'bg-[#4dbd74] hover:bg-[#3ea05f] cursor-pointer'} disabled:opacity-50`}
                   >
                     {otpVerifying ? (
                       <span className="animate-pulse">Verifying...</span>
                     ) : (
                       <>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                         </svg>
                         {isOtpVerified ? 'VERIFIED' : 'OTP - CONFIRM'}
                       </>
                     )}
                   </button>
                 </div>
               </div>
            </div>
            </>
            ) : (
              /* Verified Agent Account UI */
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Bank Header Card */}
                {verifiedAgentAccount && (
                  <div 
                    className="rounded-t-2xl p-4 flex items-center gap-4 shadow-md"
                    style={{ backgroundColor: selectedBank?.bgColor || '#1E5631', color: selectedBank?.textColor || '#ffffff' }}
                  >
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                      {selectedBank?.logo ? (
                        <img src={formatImgUrl(selectedBank.logo)} alt={verifiedAgentAccount.bankName} className="w-12 h-12 object-contain" />
                      ) : (
                        <span className="text-xl font-black text-gray-800">{verifiedAgentAccount.bankName?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wide">{verifiedAgentAccount.bankName}</h2>
                      <p className="text-xs font-bold text-green-200 uppercase tracking-wider">BRANCH: {verifiedAgentAccount.branchName}</p>
                    </div>
                  </div>
                )}

                {/* Agent Details List */}
                {verifiedAgentAccount && (
                  <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-md p-4 space-y-3 mb-4">
                    {[
                      { icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', label: 'A/C NAME', value: verifiedAgentAccount.accountHolderName },
                      { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'A/C NUMBER', value: verifiedAgentAccount.accountNumber },
                      { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'BRANCH', value: verifiedAgentAccount.branchName },
                      { icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'ROUTING NO', value: verifiedAgentAccount.routingNumber },
                      { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: 'DIVISION', value: verifiedAgentAccount.division },
                      { icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l5.447-2.724A1 1 0 0116 5.618v10.764a1 1 0 01-1.447.894L9 20z', label: 'DISTRICT', value: verifiedAgentAccount.district }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: selectedBank?.bgColor || '#1E5631', color: selectedBank?.textColor || '#ffffff' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-20">{item.label}</span>
                          <span className="text-gray-400 font-bold">:</span>
                          <span className="text-sm font-black text-gray-800 ml-2">{item.value || 'N/A'}</span>
                        </div>
                        <button type="button" onClick={() => {
                          navigator.clipboard.writeText(item.value);
                          showCustomAlert(`Copied ${item.label}!`, 'success');
                        }} className="text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors flex items-center gap-1 cursor-pointer">
                          COPY 
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* NPSB Warning */}
                <div className="bg-[#E71D36] text-white p-4 rounded-xl shadow-md flex gap-3 items-start mb-4">
                  <div className="w-6 h-6 rounded-full bg-white text-[#E71D36] flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
                    !
                  </div>
                  <p className="text-xs leading-relaxed font-medium">
                    নোট: এন পি এস বি ব্যাংক টাকা ট্রান্সফার করার ক্ষেত্রে কোন রকম সেন্ড মানি বা পেমেন্ট অপশন নির্বাচন করবেন না। সেন্ড মানি নির্বাচন করলে আপনার পেমেন্ট আমাদের একাউন্টে আসবে না।
                  </p>
                </div>

                {/* Proof Upload Box */}
                <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-4 flex items-center justify-between mb-2 relative overflow-hidden">
                  <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                      style={{ backgroundColor: selectedBank?.bgColor || '#1E5631', color: selectedBank?.textColor || '#ffffff' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">{proofFile ? 'Proof Selected' : 'Upload Payment Proof'}</p>
                      <p className="text-[10px] font-bold text-gray-500">{proofFile ? proofFile.name : 'JPG, PNG, PDF (Max 5MB)'}</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-400 text-white flex items-center justify-center shadow-md">
                    {proofPreview ? (
                       <img src={proofPreview} alt="Proof" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Footer Notice */}
            <div className="mt-6 bg-[#f3f6f9] p-4 rounded-2xl flex items-center justify-between relative z-10">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#4dbd74] flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium">You are paying</p>
                    <p className="text-sm font-black text-[#1e075f]">{Number(amount).toFixed(2)} BDT</p>
                  </div>
               </div>
               <div className="opacity-20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
               </div>
            </div>

            {/* Pay Button */}
            <button
              type="submit"
              disabled={submitting || !isOtpVerified}
              className={`relative z-10 w-full py-4 mt-2 rounded-2xl text-lg font-bold text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
                isOtpVerified && !submitting
                  ? 'bg-gradient-to-r from-[#0EB78C] to-[#16007A] hover:opacity-95 cursor-pointer'
                  : 'bg-gray-300 opacity-70 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Processing...' : `Pay ৳${Number(amount).toFixed(2)}`}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            <p className="text-center text-[10px] text-gray-500 mt-4 relative z-10">
              By continuing, you agree to our <a href="#" className="text-[#0EB78C] underline">Terms & Conditions</a>
            </p>
            <p className="text-center text-[10px] text-gray-400 mt-1 flex items-center justify-center gap-1 relative z-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Secured & powered by olinuks
            </p>
          </form>
        </div>
      </div>

      {/* ================= CUSTOM OPAY ALERT MODAL ================= */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-[320px] text-center relative overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
            {/* Top accent line */}
            <div className={`absolute top-0 left-0 w-full h-2 ${alertState.type === 'error' ? 'bg-rose-500' : alertState.type === 'success' ? 'bg-emerald-500' : 'bg-[#0EB78C]'}`} />
            
            <div className="mx-auto w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-gray-100">
              <img src={logo} alt="Opay" className="w-10 h-10 object-contain" />
            </div>
            
            <h3 className={`text-lg font-bold mb-2 ${alertState.type === 'error' ? 'text-rose-600' : alertState.type === 'success' ? 'text-emerald-600' : 'text-[#16007A]'}`}>
              {alertState.type === 'error' ? 'Error' : alertState.type === 'success' ? 'Success' : 'Notice'}
            </h3>
            
            <p className="text-sm font-medium text-gray-600 mb-6">
              {alertState.message}
            </p>
            
            <button
              onClick={closeCustomAlert}
              className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${alertState.type === 'error' ? 'bg-rose-500 hover:bg-rose-600' : alertState.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gradient-to-r from-[#0EB78C] to-[#16007A] hover:opacity-90'}`}
            >
              Okay, Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
