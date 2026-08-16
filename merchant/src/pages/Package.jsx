import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getActivationPackage } from '../lib/api';
import { CheckCircle2, ShieldCheck, Box, Loader2 } from 'lucide-react';

export default function Package() {
  const { user } = useAuthStore();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPackage = async () => {
      try {
        const res = await getActivationPackage();
        if (res.success) {
          setPkg(res.data);
        }
      } catch (err) {
        console.error(err);
        setError('প্যাকেজ তথ্য লোড করা যায়নি');
      } finally {
        setLoading(false);
      }
    };
    loadPackage();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

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
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <span className="bg-brand-primary/10 p-2.5 rounded-2xl text-brand-primary">
            <Box className="w-6 h-6" />
          </span>
          My Package & Subscription
        </h1>
        <p className="text-slate-500 font-medium mt-1">Manage and view your active merchant subscription details.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        
        {/* Main subscription info (Left / Col-span 2) */}
        <div className="md:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">{displayPkg.name}</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">{displayPkg.offerDetails}</p>
            </div>
            <div className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-4 py-2 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Subscribed
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">প্যাকেজের প্রধান সুবিধাসমূহ</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayPkg.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm text-slate-600 font-semibold p-3.5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-brand-primary/20 transition-all">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing / Details Card (Right) */}
        <div className="bg-slate-900 text-white rounded-[2rem] p-8 border border-white/5 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-[60px] rounded-full pointer-events-none" />
          
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">প্যাকেজ টাইপ</span>
            <span className="text-lg font-black text-white">One-time / Lifetime</span>
          </div>

          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">ফি প্রদান করা হয়েছে</span>
            <span className="text-3xl font-black text-emerald-400 font-mono">
              {displayPkg.amount.toLocaleString()} BDT
            </span>
          </div>

          <div className="border-t border-white/5 pt-6 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">পেমেন্ট স্ট্যাটাস:</span>
              <span className="font-black text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 tracking-wider">PAID</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">মেয়াদকাল:</span>
              <span className="font-black text-violet-400 uppercase bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20 tracking-wider">LIFETIME</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
