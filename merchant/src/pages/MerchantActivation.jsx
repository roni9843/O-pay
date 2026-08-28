import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getActivationPackages, createActivationCheckout } from '../lib/api';
import { CheckCircle2, ShieldAlert, CreditCard, Sparkles, Loader2, LogOut } from 'lucide-react';

export default function MerchantActivation() {
  const { user, logout, fetchMe } = useAuthStore();
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const res = await getActivationPackages();
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setPackages(res.data);
          setSelectedPackageId(res.data[0]._id);
        } else if (res.success && res.data) {
          // Fallback if the backend returned a single object instead of array
          setPackages([res.data]);
          setSelectedPackageId(res.data._id);
        } else {
          setError(res.message || 'প্যাকেজ লোড করতে ব্যর্থ হয়েছে');
        }
      } catch (err) {
        console.error(err);
        setError('সার্ভার থেকে তথ্য পাওয়া যায়নি');
      } finally {
        setLoading(false);
      }
    };
    loadPackages();
  }, []);

  const handlePay = async () => {
    if (!selectedPackageId) {
      setError('অনুগ্রহ করে একটি প্যাকেজ নির্বাচন করুন');
      return;
    }
    setPayLoading(true);
    setError('');
    try {
      const res = await createActivationCheckout(selectedPackageId);
      if (res.success) {
        if (res.bypass) {
          // Bypassed (no active package) - refresh profile and let them in
          await fetchMe();
          window.location.href = '/dashboard';
        } else if (res.payment_page_url) {
          // Redirect to payment portal
          window.location.href = res.payment_page_url;
        }
      } else {
        setError(res.message || 'পেমেন্ট সেশন তৈরি করতে ব্যর্থ হয়েছে');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'পেমেন্ট সেশন তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
          <p className="text-sm font-bold text-slate-400">লোডিং হচ্ছে...</p>
        </div>
      </div>
    );
  }

  // Fallback default package details if backend has active package but error occurred or empty config
  const displayPackages = packages.length > 0 ? packages : [{
    _id: 'default',
    name: 'Lifetime Activation Package',
    amount: 5000,
    offerDetails: 'এককালীন ফি প্রদান করে আজীবন আনলিমিটেড পেমেন্ট লিংক তৈরি করুন।',
    features: [
      'লাইফটাইম আনলিমিটেড পেমেন্ট লিংক তৈরি',
      '০% অতিরিক্ত হিডেন চার্জ',
      'রিয়েল-টাইম ট্রানজ্যাকশন মনিটরিং ড্যাশবোর্ড'
    ],
    packageType: 'both'
  }];

  const selectedPkg = displayPackages.find(p => p._id === selectedPackageId) || displayPackages[0];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-violet-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-4xl w-full bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-8 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400 mb-2">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Choose Your Activation Package</h1>
          <p className="text-slate-400 text-sm md:text-base font-medium max-w-lg mx-auto">
            মার্চেন্ট ড্যাশবোর্ড অ্যাক্টিভেট করতে আপনার পছন্দের প্যাকেজটি নির্বাচন করে পেমেন্ট সম্পন্ন করুন।
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayPackages.map((pkg) => (
            <div 
              key={pkg._id}
              onClick={() => setSelectedPackageId(pkg._id)}
              className={`relative cursor-pointer transition-all duration-300 rounded-3xl p-6 border ${
                selectedPackageId === pkg._id 
                  ? 'bg-slate-800/80 border-violet-500 shadow-lg shadow-violet-500/20 transform -translate-y-1' 
                  : 'bg-slate-900 border-white/5 hover:border-white/10 hover:bg-slate-800/50'
              }`}
            >
              {selectedPackageId === pkg._id && (
                <div className="absolute top-4 right-4 bg-violet-500 text-white rounded-full p-1">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                    pkg.packageType === 'deposit' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
                    pkg.packageType === 'withdrawal' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                    'text-violet-400 bg-violet-500/10 border border-violet-500/20'
                  }`}>
                    {pkg.name}
                  </span>
                  <p className="text-xs text-slate-400 font-medium mt-3 h-10 line-clamp-2">
                    {pkg.offerDetails}
                  </p>
                </div>
                
                <div>
                  <span className="text-2xl font-black text-white font-mono">
                    ৳{pkg.amount.toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-white/5 my-4" />

                <div className="space-y-2.5">
                  {pkg.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                        pkg.packageType === 'deposit' ? 'text-blue-500' :
                        pkg.packageType === 'withdrawal' ? 'text-emerald-500' :
                        'text-violet-500'
                      }`} />
                      <span className="leading-tight">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 text-sm font-bold text-rose-400 text-center">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="max-w-md mx-auto space-y-3 pt-4 border-t border-white/5 mt-8">
          <button
            onClick={handlePay}
            disabled={payLoading || !selectedPackageId}
            className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/25 text-base"
          >
            {payLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> পেমেন্ট লিংক তৈরি করা হচ্ছে...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" /> ৳{selectedPkg.amount.toLocaleString()} পেমেন্ট করুন
              </>
            )}
          </button>
          
          <button
            onClick={logout}
            className="w-full py-3 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl font-bold active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" /> লগআউট করুন
          </button>
        </div>

      </div>
    </div>
  );
}
