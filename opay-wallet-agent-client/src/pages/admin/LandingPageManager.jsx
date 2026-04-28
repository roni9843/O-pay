import React, { useEffect, useState } from 'react';
import { useAdminAuthStore } from '../../store/adminAuthStore';
import api from '../../lib/api';
import { Plus, Trash2, Edit2, Play, AlertCircle, Save, Loader2, Video as VideoIcon, UploadCloud, Globe, Search, Phone, Layout, MessageSquare, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingPageManager() {
  const token = useAdminAuthStore((s) => s.token);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // 'logo', 'favicon', 'og_image', 'video'

  // Settings State
  const [settings, setSettings] = useState({
    site_title: '',
    site_description: '',
    site_keywords: '',
    site_logo: '',
    site_favicon: '',
    og_image: '',
    contact_email: '',
    contact_phone: '',
    contact_whatsapp: '',
    hero_title: '',
    hero_subtitle: ''
  });

  const [videoSettings, setVideoSettings] = useState({ url: '', isEnabled: false });

  // FAQ State
  const [faqs, setFaqs] = useState([]);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', order: 0 });

  // Payment Partners State
  const [partners, setPartners] = useState([]);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: '', logoUrl: '', order: 0 });
  const [partnerUploading, setPartnerUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allSettings, faqsRes, partnersRes] = await Promise.all([
        api.getAllLandingSettings(),
        api.getAdminFAQs(token),
        api.getPaymentPartnersAdmin(token)
      ]);

      if (allSettings) {
        if (allSettings.landing_video) {
          setVideoSettings(allSettings.landing_video);
        }
        setSettings(prev => ({ ...prev, ...allSettings }));
      }
      setFaqs(faqsRes || []);
      setPartners(partnersRes || []);
    } catch (error) {
      console.error(error);
      // alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, key) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(key);
    try {
      let res;
      if (key === 'landing_video') {
         res = await api.uploadLandingVideo(token, file);
      } else {
         res = await api.uploadPaymentPageImage(token, file);
      }

      if (res && res.url) {
        if (key === 'landing_video') {
          setVideoSettings(prev => ({ ...prev, url: res.url }));
        } else {
          setSettings(prev => ({ ...prev, [key]: res.url }));
        }
      }
    } catch (error) {
      alert(error.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handlePartnerImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPartnerUploading(true);
    try {
       const res = await api.uploadPaymentPageImage(token, file);
       if (res && res.url) {
          setPartnerForm(prev => ({ ...prev, logoUrl: res.url }));
       }
    } catch (error) {
       alert('Image upload failed');
    } finally {
       setPartnerUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const settingsArray = Object.keys(settings).map(key => ({
        key,
        value: settings[key],
        description: 'General Site Setting'
      }));

      settingsArray.push({
        key: 'landing_video',
        value: videoSettings,
        description: 'Landing Page Hero Video'
      });

      await api.saveBulkLandingSettings(token, settingsArray);
      alert('All setttings saved successfully!');
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  // FAQ Handlers
  const handleSaveFaq = async (e) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await api.updateFAQ(token, editingFaq._id, faqForm);
      } else {
        await api.createFAQ(token, faqForm);
      }
      setShowFaqModal(false);
      fetchData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteFaq = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await api.deleteFAQ(token, id);
      fetchData();
    } catch (error) {
      alert(error.message);
    }
  };

  const openFaqModal = (faq = null) => {
    setEditingFaq(faq);
    setFaqForm(faq ? { question: faq.question, answer: faq.answer, order: faq.order } : { question: '', answer: '', order: 0 });
    setShowFaqModal(true);
  };

  // Partner Handlers
  const handleSavePartner = async (e) => {
    e.preventDefault();
    try {
      await api.createPaymentPartner(token, partnerForm);
      setShowPartnerModal(false);
      fetchData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeletePartner = async (id) => {
     if (!confirm('Remove this partner?')) return;
     try {
        await api.deletePaymentPartner(token, id);
        fetchData();
     } catch (error) {
        alert(error.message);
     }
  };


  if (loading) return (
     <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-violet-400">
           <Loader2 className="w-8 h-8 animate-spin" />
           <span className="font-medium animate-pulse">Loading settings...</span>
        </div>
     </div>
  );

  const tabs = [
    { id: 'general', label: 'General & Branding', icon: Layout },
    { id: 'contact', label: 'Contact Info', icon: Phone },
    { id: 'video', label: 'Hero Video', icon: VideoIcon },
    { id: 'partners', label: 'Payment Partners', icon: CreditCard },
    { id: 'faqs', label: 'FAQs', icon: MessageSquare },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent p-8 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Globe className="w-8 h-8 text-violet-400" />
             <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
               Site Control Center
             </span>
          </h2>
          <p className="text-base text-slate-400 mt-2 max-w-xl">
             Manage global branding, SEO configurations, hero content, video assets, and frequently asked questions from one place.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 rounded-xl flex items-center gap-2.5 font-bold text-sm transition-all duration-300 ${
              activeTab === tab.id 
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Panel */}
      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-xl min-h-[500px] p-8 relative overflow-hidden">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-4xl">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Site Title</label>
                  <input 
                    value={settings.site_title}
                    onChange={e => setSettings({...settings, site_title: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="OPay Agent - Mobile Banking..."
                  />
                  <p className="text-xs text-slate-500 pl-1">Appears in browser tab and search results.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Hero Title</label>
                  <input 
                    value={settings.hero_title}
                    onChange={e => setSettings({...settings, hero_title: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="Main headline..."
                  />
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Hero Subtitle</label>
                <textarea 
                  value={settings.hero_subtitle}
                  onChange={e => setSettings({...settings, hero_subtitle: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all resize-none"
                  placeholder="Supporting text for the hero section..."
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                <ImageUploader 
                   label="Site Logo (NavBar)" 
                   value={settings.site_logo} 
                   loading={uploading === 'site_logo'}
                   onChange={(e) => handleFileUpload(e, 'site_logo')}
                />
                <ImageUploader 
                   label="Favicon (Browser Icon)" 
                   value={settings.site_favicon} 
                   loading={uploading === 'site_favicon'}
                   onChange={(e) => handleFileUpload(e, 'site_favicon')}
                />
             </div>
          </motion.div>
        )}

        {/* CONTACT TAB */}
        {activeTab === 'contact' && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Support Email</label>
                  <input 
                    value={settings.contact_email}
                    onChange={e => setSettings({...settings, contact_email: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                    placeholder="support@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">WhatsApp Number</label>
                  <input 
                    value={settings.contact_whatsapp}
                    onChange={e => setSettings({...settings, contact_whatsapp: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                    placeholder="+880..."
                  />
                </div>
              </div>
           </motion.div>
        )}

        {/* VIDEO TAB */}
        {activeTab === 'video' && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl space-y-8">
             <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={videoSettings.isEnabled} 
                    onChange={e => setVideoSettings({...videoSettings, isEnabled: e.target.checked})}
                    className="sr-only peer" 
                  />
                  <div className="w-14 h-8 bg-black/40 peer-focus:outline-none border border-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-slate-400 after:border-gray-300 after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500/20 peer-checked:after:bg-emerald-400 peer-checked:border-emerald-500/50"></div>
                  <span className="ml-4 font-bold text-white group-hover:text-emerald-300 transition-colors">Show Video on Landing Page</span>
                </label>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Video URL</label>
                <div className="flex gap-3">
                  <input 
                    value={videoSettings.url || ''}
                    onChange={e => setVideoSettings({...videoSettings, url: e.target.value})}
                    placeholder="https://example.com/video.mp4"
                    className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                  />
                  <label className="cursor-pointer px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 flex items-center gap-2 font-bold transition-all text-sm uppercase tracking-wider hover:shadow-lg">
                    {uploading === 'landing_video' ? <Loader2 className="animate-spin w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
                    <span>Upload</span>
                    <input type="file" accept="video/*" onChange={(e) => handleFileUpload(e, 'landing_video')} className="hidden" disabled={uploading} />
                  </label>
                </div>
                {videoSettings.url && (
                    <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-video relative group">
                        <video src={videoSettings.url} className="w-full h-full object-cover" controls />
                    </div>
                )}
             </div>
           </motion.div>
        )}

        {/* PARTNERS TAB */}
        {activeTab === 'partners' && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => { setPartnerForm({ name: '', logoUrl: '', order: 0 }); setShowPartnerModal(true); }}
                  className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all text-sm uppercase tracking-wide"
                >
                  <Plus size={18} /> Add Partner
                </button>
              </div>

              {partners.length === 0 ? (
                 <div className="text-center py-16 text-slate-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    No payment partners added yet.
                 </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {partners.map(p => (
                    <div key={p._id} className="relative group bg-white p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2 hover:shadow-xl transition-all">
                       <img src={p.logoUrl && p.logoUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${p.logoUrl}` : p.logoUrl} alt={p.name} className="h-12 w-auto object-contain" />
                       <span className="text-black font-bold text-xs">{p.name}</span>
                       <button 
                         onClick={() => handleDeletePartner(p._id)}
                         className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                       >
                         <Trash2 size={14} />
                       </button>
                    </div>
                  ))}
                </div>
              )}
           </motion.div>
        )}

        {/* FAQs TAB */}
        {activeTab === 'faqs' && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-end">
                <button 
                   onClick={() => openFaqModal()} 
                   className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 flex items-center gap-2 shadow-lg shadow-violet-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm uppercase tracking-wide"
                >
                   <Plus size={18} /> Add FAQ
                </button>
              </div>

              {faqs.length === 0 ? (
                 <div className="text-center py-16 text-slate-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    No FAQs added yet.
                 </div>
              ) : (
                <div className="grid gap-4">
                  {faqs.map((faq) => (
                    <div key={faq._id} className="p-6 border border-white/5 rounded-2xl bg-black/20 hover:bg-white/5 hover:border-white/10 transition-all flex justify-between items-start group relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
                       
                       <div className="flex-1 relative z-10">
                          <div className="flex items-center gap-3 mb-2">
                             <span className="px-2 py-0.5 bg-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded border border-white/5">Order: {faq.order}</span>
                             <h3 className="font-bold text-white text-lg">{faq.question}</h3>
                          </div>
                          <p className="text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{faq.answer}</p>
                       </div>
                       
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10 pl-4">
                          <button onClick={() => openFaqModal(faq)} className="p-2.5 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 rounded-lg transition-colors">
                             <Edit2 size={18} />
                          </button>
                          <button onClick={() => handleDeleteFaq(faq._id)} className="p-2.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg transition-colors">
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </div>
                  ))}
                </div>
              )}
           </motion.div>
        )}

        {/* Global Save Button (except for FAQs and Partners which save immediately) */}
        {activeTab === 'general' || activeTab === 'contact' || activeTab === 'video' ? (
          <div className="mt-12 pt-8 border-t border-white/5 flex justify-end">
             <button 
               onClick={handleSaveSettings}
               disabled={saving || uploading}
               className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
             >
               {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
               Save All Changes
             </button>
          </div>
        ) : null}

      </div>

      {/* FAQ Modal */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-[#0f1016] border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                 <MessageSquare className="w-6 h-6 text-violet-400" />
                 {editingFaq ? 'Edit FAQ' : 'Create New FAQ'}
              </h2>
              <form onSubmit={handleSaveFaq} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Question</label>
                    <input 
                      required
                      value={faqForm.question}
                      onChange={e => setFaqForm({...faqForm, question: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                      placeholder="e.g. How do I reset my password?"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Answer</label>
                    <textarea 
                      required
                      rows={4}
                      value={faqForm.answer}
                      onChange={e => setFaqForm({...faqForm, answer: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all resize-none"
                      placeholder="e.g. You can reset it by..."
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Order (Sort)</label>
                    <input 
                      type="number"
                      value={faqForm.order}
                      onChange={e => setFaqForm({...faqForm, order: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                 </div>
                 <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/5">
                    <button type="button" onClick={() => setShowFaqModal(false)} className="px-6 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-bold text-sm">Cancel</button>
                    <button type="submit" className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-900/20 text-sm">Save FAQ</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Partner Modal */}
      {showPartnerModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-[#0f1016] border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                 <CreditCard className="w-6 h-6 text-violet-400" />
                 Add Payment Partner
              </h2>
              <form onSubmit={handleSavePartner} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Partner Name</label>
                    <input 
                      required
                      value={partnerForm.name}
                      onChange={e => setPartnerForm({...partnerForm, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                      placeholder="e.g. bKash"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Logo</label>
                    <div className="flex gap-4">
                       <input 
                         value={partnerForm.logoUrl}
                         readOnly
                         className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-slate-400 text-xs"
                         placeholder="Upload image..."
                       />
                       <label className="cursor-pointer px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 flex items-center gap-2">
                          {partnerUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <UploadCloud className="w-4 h-4"/>}
                          <input type="file" accept="image/*" className="hidden" onChange={handlePartnerImageUpload} disabled={partnerUploading}/>
                       </label>
                    </div>
                 </div>
                 <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/5">
                    <button type="button" onClick={() => setShowPartnerModal(false)} className="px-6 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-bold text-sm">Cancel</button>
                    <button type="submit" disabled={!partnerForm.logoUrl || partnerUploading} className="px-8 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-900/20 text-sm disabled:opacity-50">Add Partner</button>
                 </div>
              </form>
           </div>
         </div>
      )}
    </div>
  );
}

// Helper Component for Image Upload
function ImageUploader({ label, value, loading, onChange }) {
  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('/')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${url}`;
    }
    return url;
  };

  return (
    <div>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-3 block">{label}</label>
      <div className="flex flex-col sm:flex-row gap-5 items-start">
         <div className="w-32 h-32 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group relative">
            {value ? <img src={getImageUrl(value)} alt="Preview" className="w-full h-full object-contain p-2" /> : <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No Image</div>}
            <div className="absolute inset-0 bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
         </div>
         <div className="flex-1 w-full space-y-3">
            <div className="flex gap-2">
              <input value={value || ''} readOnly className="w-full px-4 py-2.5 bg-black/20 border border-white/5 rounded-xl text-xs text-slate-500 font-mono focus:outline-none" placeholder="Image URL..." />
            </div>
            <label className="inline-flex cursor-pointer px-6 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 hover:text-white items-center gap-2 font-bold transition-all text-xs uppercase tracking-wider hover:shadow-lg w-full sm:w-auto justify-center">
               {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
               <span>Upload New Image</span>
               <input type="file" accept="image/*" onChange={onChange} className="hidden" disabled={loading} />
            </label>
         </div>
      </div>
    </div>
  );
}
