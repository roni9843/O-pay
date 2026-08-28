import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getActivationPackages, createActivationCheckout } from '../lib/api';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Box, 
  Loader2, 
  CreditCard, 
  Sparkles, 
  Crown, 
  Check, 
  Zap, 
  ArrowRight,
  Star,
  CheckCircle
} from 'lucide-react';

export default function Package() {
  const { user, fetchMe } = useAuthStore();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payLoadingId, setPayLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const res = await getActivationPackages();
        if (res.success && res.data) {
          if (Array.isArray(res.data)) {
            setPackages(res.data);
          } else {
            setPackages([res.data]);
          }
        }
      } catch (err) {
        console.error(err);
        setError('প্যাকেজ তথ্য লোড করা যায়নি');
      } finally {
        setLoading(false);
      }
    };
    loadPackages();
  }, []);

  const handlePurchase = async (packageId) => {
    if (user?.isLifetimePaid && user?.activePackageId && String(user.activePackageId) === String(packageId)) {
      setError('আপনার অ্যাকাউন্টে এই প্যাকেজটি ইতিমধ্যেই অ্যাক্টিভ আছে।');
      return;
    }
    setPayLoadingId(packageId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await createActivationCheckout(packageId);
      if (res.success) {
        if (res.bypass) {
          setSuccessMsg('প্যাকেজ সফলভাবে অ্যাক্টিভেট হয়েছে!');
          if (fetchMe) await fetchMe();
        } else if (res.payment_page_url) {
          window.location.href = res.payment_page_url;
        }
      } else {
        setError(res.message || 'পেমেন্ট লিংক তৈরি করা সম্ভব হয়নি');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'পেমেন্ট প্রসেসিং সমস্যা হয়েছে');
    } finally {
      setPayLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-violet-200 animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-violet-600 absolute inset-0" />
        </div>
        <p className="text-sm font-bold text-slate-500 tracking-wide animate-pulse">প্যাকেজ লোড হচ্ছে...</p>
      </div>
    );
  }

  // Find active package for merchant
  const activePackage = user?.isLifetimePaid
    ? (
        packages.find(p => user?.activePackageId && String(p._id) === String(user.activePackageId)) ||
        packages.find(p => {
          if (user?.allowDeposit && user?.allowAutoWithdrawal) return p.packageType === 'both';
          if (user?.allowDeposit) return p.packageType === 'deposit';
          if (user?.allowAutoWithdrawal) return p.packageType === 'withdrawal';
          return false;
        }) ||
        packages[0]
      )
    : null;

  const displayPackages = packages.length > 0 ? packages : [{
    _id: 'default',
    name: 'Lifetime Activation Package',
    amount: 5000,
    offerDetails: 'এককালীন ফি প্রদান করে আজীবন আনলিমিটেড পেমেন্ট লিংক তৈরি করুন।',
    features: [
      'লাইফটাইম আনলিমিটেড পেমেন্ট লিংক তৈরি',
      '০% অতিরিক্ত হিডেন চার্জ',
      'রিয়েল-টাইম ট্রানজ্যাকশন মনিটরিং ড্যাশবোর্ড',
      'গ্রাহকদের জন্য প্রিমিয়াম সাকসেস ল্যান্ডিং পেইজ',
      '২৪/৭ মার্চেন্ট ও কাস্টমার সাপোর্ট সার্ভিস'
    ],
    packageType: 'both'
  }];

  return (
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10 pb-16 font-sans">
      
      {/* Dynamic Header Section */}
      <header className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-2xl overflow-hidden text-white">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-violet-600/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold tracking-wide">
              <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Merchant Subscription Hub</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              My Package & Subscriptions
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed">
              আপনার মার্চেন্ট পোর্টালে সক্রিয় প্যাকেজ পর্যবেক্ষণ করুন অথবা আপনার ব্যবসার প্রয়োজন অনুযায়ী উপযুক্ত প্যাকেজে সুইচ ও আপগ্রেড করুন।
            </p>
          </div>

          {user?.isLifetimePaid && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md p-4 sm:p-5 rounded-2xl flex items-center gap-4 self-start md:self-auto shadow-lg shadow-emerald-500/5">
              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">স্ট্যাটাস</span>
                <span className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  ACTIVE (কেনা হয়েছে)
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Alert Messages */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-shake">
          <div className="p-1.5 bg-rose-500/20 rounded-lg flex-shrink-0">
            <Zap className="w-4 h-4 text-rose-500" />
          </div>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active Package Showcase Banner */}
      {user?.isLifetimePaid && activePackage && (
        <div className="relative bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-emerald-500/40 shadow-2xl space-y-6 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/15 blur-[100px] rounded-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-6">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black uppercase tracking-widest">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> আপনার বর্তমান অ্যাক্টিভ প্যাকেজ
              </span>
              <h2 className="text-xl sm:text-3xl font-black text-white pt-1">{activePackage.name}</h2>
              <p className="text-slate-400 text-xs sm:text-sm font-medium">{activePackage.offerDetails}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left sm:text-right min-w-[170px] backdrop-blur-md">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">পরিশোধিত ফি</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                ৳{(activePackage.amount || 0).toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-emerald-300/80 block mt-0.5">আজীবন সাবস্ক্রিপশন (Lifetime)</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">অ্যাক্টিভ প্যাকেজের সুবিধাসমূহ:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(Array.isArray(activePackage.features) ? activePackage.features : []).map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-200 font-semibold bg-white/5 p-3 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Available Packages Grid */}
      <div className="space-y-6 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-violet-600" />
              উপলব্ধ সকল প্যাকেজসমূহ
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">আপনার বিজনেস প্রয়োজন অনুযায়ী সেরা প্যাকেজটি বেছে নিন</p>
          </div>
          <span className="text-xs font-bold text-violet-600 bg-violet-50 px-3.5 py-1.5 rounded-full border border-violet-200 self-start sm:self-auto">
            {displayPackages.length} টি প্ল্যান উপলব্ধ
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {displayPackages.map((pkg) => {
            const isActive = user?.isLifetimePaid && activePackage && String(activePackage._id) === String(pkg._id);
            const isProcessing = payLoadingId === pkg._id;

            return (
              <div 
                key={pkg._id} 
                className={`group relative bg-white rounded-3xl p-6 sm:p-7 border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                  isActive 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-gradient-to-b from-emerald-50/20 via-white to-white shadow-xl shadow-emerald-500/10' 
                    : 'border-slate-200 hover:border-violet-500/60 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-1'
                }`}
              >
                {/* Top Accent Ribbon for Active Package */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
                )}

                <div className="space-y-5">
                  
                  {/* Header Badge & Name */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full inline-block ${
                        pkg.packageType === 'deposit' ? 'text-blue-700 bg-blue-50 border border-blue-200' :
                        pkg.packageType === 'withdrawal' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' :
                        'text-violet-700 bg-violet-50 border border-violet-200'
                      }`}>
                        {pkg.packageType === 'deposit' ? 'ডিপোজিট প্যাকেজ' :
                         pkg.packageType === 'withdrawal' ? 'উইথড্রয়াল প্যাকেজ' :
                         'অল-ইন-ওয়ান লাইফটাইম'}
                      </span>
                      <h3 className="text-xl font-black text-slate-900 mt-2.5 tracking-tight group-hover:text-violet-600 transition-colors">
                        {pkg.name}
                      </h3>
                    </div>

                    {isActive && (
                      <span className="flex-shrink-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[40px] line-clamp-2">
                    {pkg.offerDetails}
                  </p>

                  {/* Price Tag */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                        ৳{(pkg.amount || 0).toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-400 ml-1.5">BDT</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      One-Time
                    </span>
                  </div>

                  <div className="border-t border-slate-100 my-2" />

                  {/* Feature Checklist */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">প্রধান সুবিধাসমূহ</h4>
                    <div className="space-y-2.5">
                      {(Array.isArray(pkg.features) ? pkg.features : []).map((feature, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold leading-tight">
                          <div className={`p-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                            isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'
                          }`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Purchase / Status Action Button */}
                <div className="mt-8 pt-4 border-t border-slate-100">
                  {isActive ? (
                    <button
                      disabled
                      className="w-full py-3.5 bg-emerald-50 text-emerald-700 font-black text-xs uppercase tracking-wider rounded-2xl border border-emerald-300/80 cursor-default flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> বর্তমানে কেনা প্যাকেজ (Active)
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(pkg._id)}
                      disabled={isProcessing || payLoadingId !== null}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> প্রসেস করা হচ্ছে...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" /> এই প্যাকেজটি কিনুন <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
