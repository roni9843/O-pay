import React, { useState, useEffect } from 'react';
import { Smartphone, Building, Bitcoin, ArrowRight, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import ApplicationForm from '../components/ApplicationForm';
import { motion, AnimatePresence } from 'framer-motion';
import { getFaqs, getPaymentPartners } from '../lib/api';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { Helmet } from 'react-helmet-async';

export default function LandingPage() {
  const { settings } = useSiteSettings();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [partners, setPartners] = useState([]);
  
  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/')) {
       const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
       return `${apiBase}${url}`;
    }
    return url;
  };

  const getFullUrl = (url) => {
     if (!url) return '';
     if (url.startsWith('http')) return url;
     const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
     return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getVideoUrl = (url) => {
    if (!url) return '';
    // Handle relative paths (uploaded videos)
    if (url.startsWith('/')) {
       const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
       return `${apiBase}${url}`;
    }
    // Handle YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0];
      return `https://www.youtube.com/embed/${cleanId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${cleanId}`;
    }
    return url;
  };

  const isYoutube = (url) => url && (url.includes('youtube.com') || url.includes('youtu.be'));

  // Derived Data
  const videoSettings = settings.landing_video || null;
  const siteTitle = settings.site_title || 'OPay Agent';
  const ogImage = getFullUrl(settings.og_image);
  const siteLogo = getImageUrl(settings.site_logo);
  const siteFavicon = getImageUrl(settings.site_favicon);


  useEffect(() => {
    async function loadData() {
       const [fetchedFaqs, fetchedPartners] = await Promise.all([getFaqs(), getPaymentPartners()]);
       if (fetchedFaqs && fetchedFaqs.length > 0) setFaqs(fetchedFaqs);
       if (fetchedPartners && fetchedPartners.length > 0) setPartners(fetchedPartners);
    }
    loadData();
  }, []);
  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const plans = [
    {
      id: 'mobile_banking',
      title: 'মোবাইল ব্যাংকিং',
      icon: Smartphone,
      description: 'বিকাশ, নগদ, রকেট, উপায় এজেন্ট সিম নিয়ে কাজ করুন।',
      gradient: 'from-pink-500 to-rose-500',
      popular: true
    },
    {
      id: 'bank_transfer',
      title: 'ব্যাংক ট্রান্সফার',
      icon: Building,
      description: 'যেকোনো ব্যাংকে টাকা পাঠান দ্রুত ও নিরাপদে।',
      gradient: 'from-blue-500 to-cyan-500',
      popular: false
    },
    {
      id: 'crypto',
      title: 'কিপ্টো এক্সচেঞ্জ',
      icon: Bitcoin,
      description: 'বাইনান্স ও অন্যান্য কিপ্টো কারেন্সি লেনদেন করুন।',
      gradient: 'from-amber-500 to-orange-500',
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#050B14] text-white font-sans selection:bg-emerald-500/30">
      
      {/* SEO Configuration */}
      <Helmet defer={false}>
        <title>{siteTitle}</title>
        
        {/* Favicon */}
        {siteFavicon && <link rel="icon" href={siteFavicon} />}
      </Helmet>

      {/* Top Bar */}
      <div className="bg-[#02050A] text-slate-400 text-sm py-2 px-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
             {settings.contact_email && (
               <span className="flex items-center gap-2"><Mail size={14} /> {settings.contact_email}</span>
             )}
             {(settings.contact_whatsapp || settings.contact_phone) && (
               <span className="flex items-center gap-2"><Phone size={14} /> Whats App : {settings.contact_whatsapp || settings.contact_phone}</span>
             )}
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 w-full z-40 bg-[#050B14]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {siteLogo ? (
              <img src={siteLogo} alt="Logo" className="h-10 w-auto object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
                O
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{settings.site_title || 'OPay Agent'}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-300 font-medium">
             <a href="#" className="hover:text-emerald-400 transition-colors">প্রথম পাতা</a>
             <a href="#" className="hover:text-emerald-400 transition-colors">আমাদের সম্পর্কে জানুন</a>
             <button onClick={() => setSelectedPlan('General')} className="hover:text-emerald-400 transition-colors">এজেন্ট হিসাবে আবেদন করুন</button>
          </div>

          <button className="px-6 py-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-all text-xs font-bold uppercase tracking-wider">
            লগইন
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-24 pb-20 px-4 overflow-hidden text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] -z-10" />
        
        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
           <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block"
           >
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              ● ৩০০০+ এজেন্ট আমাদের সাথে যুক্ত আছেন
            </span>
           </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold leading-tight"
          >
            {settings.hero_title ? (
               <span dangerouslySetInnerHTML={{ __html: settings.hero_title.replace(/\n/g, '<br/>') }} />
            ) : (
               <>সুন্দর ভবিষৎ গড়তে <br /> <span className="text-emerald-500">OPay ওয়ালেট এজেন্ট</span> হোন</>
            )}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed"
          >
            {settings.hero_subtitle || 'ঘরে বসেই মোবাইল ব্যাংকিং, ব্যাংক ট্রান্সফার এবং কিপ্টো লেনদেন এর ব্যবসা শুরু করুন। সহজ শর্তে এবং কম পুঁজিতে আজই শুরু করুন।'}
          </motion.p>
          
          {/* Video Player */}
          {videoSettings?.isEnabled && videoSettings?.url && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/20 border border-white/10 aspect-video max-w-3xl bg-black relative group"
            >
               {isYoutube(videoSettings.url) ? (
                  <iframe 
                    src={getVideoUrl(videoSettings.url)} 
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Promo Video"
                  />
               ) : (
                  <video 
                    src={getVideoUrl(videoSettings.url)} 
                    className="w-full h-full object-cover"
                    autoPlay 
                    muted 
                    loop 
                    controls
                    playsInline
                  />
               )}
            </motion.div>
          )}

        </div>
      </header>
      
      {/* Services Section */}
      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">আমাদের সার্ভিস সমূহ</h2>
            <p className="text-slate-500 text-sm">নিচের যে কোনো একটি প্ল্যান বেছে নিয়ে আপনার যাত্রা শুরু করুন</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                onClick={() => setSelectedPlan(plan.title)}
                className="relative bg-[#0A1019] border border-white/5 rounded-2xl p-8 hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-8 px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow-lg">
                    Popular Choice
                  </div>
                )}
                
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6`}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-xl font-bold mb-3">{plan.title}</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  {plan.description}
                </p>
                
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold group-hover:gap-3 transition-all">
                  আবেদন করুন <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
             <h2 className="text-2xl font-bold mb-12">কেন OPay এজেন্ট হবেন?</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { val: '২৪/৭', label: 'সাপোর্ট সুবিধা', color: 'text-emerald-400' },
                  { val: '১০০%', label: 'নিরাপদ লেনদেন', color: 'text-blue-400' },
                  { val: 'ফাস্ট', label: 'Withdrawal', color: 'text-indigo-400' },
                  { val: 'সেরা', label: 'কমিশন রেট', color: 'text-amber-400' },
                ].map((item, i) => (
                  <div key={i} className="p-6 rounded-xl bg-[#0A1019] border border-white/5 hover:bg-[#0F1621] transition-colors">
                     <div className={`text-2xl font-bold ${item.color} mb-2`}>{item.val}</div>
                     <div className="text-xs text-slate-400">{item.label}</div>
                  </div>
                ))}
             </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-10 px-4">
         <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
            {faqs.length > 0 ? (
               <div className="space-y-3">
                 {faqs.map((faq, index) => (
                   <div key={index} className="bg-[#0A1019] border border-white/5 rounded-lg overflow-hidden">
                     <button 
                       onClick={() => toggleFaq(index)}
                       className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                     >
                       <span className="text-slate-300 font-medium text-sm">{faq.question}</span>
                       {openFaq === index ? <ChevronUp size={16} className="text-emerald-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                     </button>
                     <AnimatePresence>
                       {openFaq === index && (
                         <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           className="px-6 py-4 pt-0 text-sm text-slate-400 border-t border-white/5 whitespace-pre-wrap"
                         >
                           {faq.answer}
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                 ))}
               </div>
            ) : (
               <div className="text-center text-slate-500">
                  Coming Soon...
               </div>
            )}
         </div>
      </section>

      {/* Footer / Logos */}
      <footer className="mt-20 border-t border-white/10 bg-[#02050A] pt-12 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
           <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
              <div className="flex items-center gap-2">
                 {siteLogo ? (
                    <img src={siteLogo} alt="Logo" className="w-10 h-10 object-contain" />
                 ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white text-xl">O</div>
                 )}
                 <span className="text-2xl font-bold">pay</span>
              </div>
              
              {/* Payment Partners Grid (Simulated) */}
              <div className="flex flex-wrap justify-center gap-3 md:justify-end">
                  {partners.length > 0 ? (
                    partners.map((p) => (
                       <div key={p._id || p.name} className="h-10 px-4 bg-white rounded-lg flex items-center justify-center min-w-[80px] hover:scale-105 transition-transform">
                          {p.logoUrl ? (
                             <img src={getImageUrl(p.logoUrl)} alt={p.name} className="h-6 w-auto object-contain" />
                          ) : (
                             <span className="text-black font-bold text-xs">{p.name}</span>
                          )}
                       </div>
                    ))
                  ) : (
                    ['bKash', 'Nagad', 'Rocket', 'Upay', 'Tap', 'DBBL', 'City', 'MTB', 'AB', 'Binance', 'Instapay', 'Touch'].map(p => (
                        <div key={p} className="h-8 px-3 bg-white rounded flex items-center justify-center opacity-50">
                           <span className="text-black font-bold text-xs">{p}</span>
                        </div>
                    ))
                  )}
              </div>
           </div>
           
           <div className="text-center md:text-left border-t border-white/5 pt-8">
              <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
                 {settings.site_description || 'বাংলাদেশ এ প্রথম পেমেন্ট গেটওয়ে যেখানে যে কেউ আয় করতে পারবে এজেন্ট হয়ে এবং প্রথম ইন্টারন্যাশনাল - ওয়ালেট সাপোর্ট পেমেন্ট গেটওয়ে ও পে।'}
              </p>
           </div>
        </div>
      </footer>

      {/* Application Form Modal */}
      {selectedPlan && (
        <ApplicationForm 
          selectedPlan={selectedPlan} 
          onClose={() => setSelectedPlan(null)} 
        />
      )}
    </div>
  );
}
