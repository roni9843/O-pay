import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { updateSupportNumber } from '../../lib/api';
import { Phone, CheckCircle, AlertCircle, Copy, Sparkles } from 'lucide-react';

export default function AddSupport() {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);

  const [number, setNumber] = useState(user?.supportNumber || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.supportNumber) setNumber(user.supportNumber);
  }, [user?.supportNumber]);

  async function submit(e) {
    e.preventDefault();
    setError(''); 
    setSuccess('');
    
    if (!number.trim()) {
      setError('Support number is required');
      return;
    }

    setLoading(true);
    try {
      const res = await updateSupportNumber(token, number.trim());
      if (res?.user) setUser(res.user);
      setSuccess('Support number updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update support number');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(user.supportNumber);
    // Optional: tiny feedback
    const btn = document.getElementById('copy-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<CheckCircle className="w-5 h-5" /> Copied!';
    setTimeout(() => btn.innerHTML = original, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6 relative overflow-hidden">
      <div className="max-w-4xl mx-auto relative z-10">

        {/* Header */}
        <div className="text-center mb-12 mt-10">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 p-1 shadow-2xl mb-6 animate-pulse">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <Phone className="w-16 h-16 text-pink-400" />
            </div>
          </div>
          <h1 className="text-6xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Support Contact
          </h1>
          <p className="text-purple-300 text-xl mt-3">Let users reach you instantly</p>
          <div className="flex justify-center gap-3 mt-5">
            <Sparkles className="w-6 h-6 text-pink-400 animate-twinkle" />
            <span className="text-purple-300">Quick & secure contact setup</span>
            <Sparkles className="w-6 h-6 text-indigo-400 animate-twinkle" />
          </div>
        </div>

        {/* Success / Error Messages */}
        {success && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/50 backdrop-blur-xl text-emerald-300 text-center font-medium shadow-2xl flex items-center justify-center gap-3">
            <CheckCircle className="w-6 h-6" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/50 backdrop-blur-xl text-rose-300 text-center font-medium shadow-2xl flex items-center justify-center gap-3">
            <AlertCircle className="w-6 h-6" />
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-10">

          {/* Form Card */}
          <div className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl hover:shadow-purple-500/30 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-indigo-600/20 opacity-70" />
            
            <div className="relative p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-xl">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                    {user?.supportNumber ? 'Update' : 'Add'} Support Number
                  </h3>
                  <p className="text-purple-300">Users will see this number to contact you</p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-6">
                <div>
                  <label className="block text-purple-200 text-lg mb-3">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                    placeholder="+880 17XXX XXXXX"
                    className="w-full px-6 py-5 rounded-2xl bg-white/10 border border-white/30 backdrop-blur-xl focus:border-purple-400 focus:ring-4 focus:ring-purple-500/30 transition-all text-white placeholder-purple-400 text-lg"
                  />
                  <p className="text-sm text-purple-300 mt-3">
                    Include country code. This number will be visible to users.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !number.trim()}
                  className="w-full px-8 py-5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 font-bold text-xl shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-4 border-white/30 border-t-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-7 h-7" />
                      Save Support Number
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Current Number Card */}
          {user?.supportNumber && (
            <div className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-indigo-600/20 opacity-70" />
              
              <div className="relative p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-xl">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Current Support Number
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/20 backdrop-blur-xl text-center">
                    <p className="text-purple-300 text-lg mb-3">Active Number</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent tracking-wider">
                      {user.supportNumber}
                    </p>
                  </div>

                  <button
                    id="copy-btn"
                    onClick={copyToClipboard}
                    className="w-full px-8 py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-xl shadow-xl hover:shadow-pink-500/50 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <Copy className="w-6 h-6" />
                    Copy Number
                  </button>

                  <div className="text-center text-purple-300 text-sm">
                    <Sparkles className="w-5 h-5 inline mr-1" />
                    Users can now contact you directly
                    <Sparkles className="w-5 h-5 inline ml-1" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-20 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(50px, -50px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 25s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-twinkle { animation: twinkle 3s infinite; }
        @keyframes twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}