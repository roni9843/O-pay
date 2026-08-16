import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getActivationPackage, createActivationCheckout } from '../lib/api';
import { CheckCircle2, ShieldAlert, CreditCard, Sparkles, Loader2, LogOut } from 'lucide-react';

export default function MerchantActivation() {
  const { user, logout, fetchMe } = useAuthStore();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPackage = async () => {
      try {
        const res = await getActivationPackage();
        if (res.success) {
          setPkg(res.data);
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
    loadPackage();
  }, []);

  const handlePay = async () => {
    setPayLoading(true);
    setError('');
    try {
      const res = await createActivationCheckout();
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
  const displayPkg = pkg || {
    name: 'Lifetime Activation Package',
    amount: 5000,
    offerDetails: 'এককালীন ফি প্রদান করে আজীবন আনলিমিটেড পেমেন্ট লিংক তৈরি করুন।',
    features: [
      'লাইফটাইম আনলিমিটেড পেমেন্ট লিংক তৈরি',
      '০% অতিরিক্ত হিডেন চার্জ',
      'রিয়েল-টাইম ট্রানজ্যাকশন মনিটরিং ড্যাশবোর্ড',
      'গ্রাহকদের জন্য প্রিমিয়াম সাকসেস ল্যান্ডিং পেইজ',
      '২৪/৭ মার্চেন্ট ও কাস্টমার সাপোর্ট সার্ভিস'
    ]
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-violet-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-xl w-full bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-8 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400 mb-2">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Lifetime Activation Required</h1>
          <p className="text-slate-400 text-sm font-medium">মার্চেন্ট ড্যাশবোর্ড অ্যাক্টিভেট করতে এককালীন ফি প্রদান করুন</p>
        </div>

        {/* Pricing Card */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-2xl rounded-full" />
          
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                {displayPkg.name}
              </span>
              <p className="text-xs text-slate-400 font-bold mt-3 leading-relaxed">
                {displayPkg.offerDetails}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">ফি এর পরিমাণ</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {displayPkg.amount.toLocaleString()} BDT
              </span>
            </div>
          </div>

          <div className="border-t border-white/5 my-5" />

          {/* Features List */}
          <div className="space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">প্যাকেজের প্রধান সুবিধাসমূহ</span>
            <div className="grid grid-cols-1 gap-2.5">
              {displayPkg.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 text-xs font-bold text-rose-400 leading-relaxed">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handlePay}
            disabled={payLoading}
            className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/25 text-sm"
          >
            {payLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> পেমেন্ট লিংক তৈরি করা হচ্ছে...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" /> পেমেন্ট করতে এগিয়ে যান
              </>
            )}
          </button>
          
          <button
            onClick={logout}
            className="w-full py-3 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl font-bold active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" /> লগআউট করুন
          </button>
        </div>

      </div>
    </div>
  );
}
