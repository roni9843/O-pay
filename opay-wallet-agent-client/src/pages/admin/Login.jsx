import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuthStore } from '../../store/adminAuthStore';
import api from '../../lib/api';
import { Loader2, Globe, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const setToken = useAdminAuthStore((s) => s.setToken);
  const setUser = useAdminAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
     e.preventDefault();
     setLoading(true);
     setError('');
     try {
        const res = await api.login({ email, password });
        if (res.token) {
           setToken(res.token);
           setUser(res.user);
           navigate('/admin');
        } else {
           setError('Invalid credentials');
        }
     } catch (err) {
        setError(err.message || 'Login failed');
     } finally {
        setLoading(false);
     }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-4 relative overflow-hidden">
       {/* Background Effects */}
       <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/20 blur-[150px]" />
       <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/20 blur-[150px]" />

       <motion.div 
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10"
       >
          <div className="flex flex-col items-center mb-8">
             <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-0.5 shadow-lg shadow-violet-500/20 mb-4">
                <div className="h-full w-full rounded-2xl bg-slate-950 flex items-center justify-center">
                   <Globe className="w-8 h-8 text-white" />
                </div>
             </div>
             <h1 className="text-2xl font-bold text-white">Site Control Center</h1>
             <p className="text-slate-400 text-sm mt-1">Authenticate to manage landing page</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Email</label>
                <div className="relative">
                   <input
                     type="email"
                     required
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     className="w-full pl-4 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                     placeholder="admin@example.com"
                   />
                </div>
             </div>
             
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Password</label>
                <div className="relative">
                   <input
                     type="password"
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full pl-4 pr-10 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                     placeholder="••••••••"
                   />
                   <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
             </div>

             {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm text-center">
                   {error}
                </div>
             )}

             <button 
               type="submit" 
               disabled={loading}
               className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold rounded-xl shadow-lg shadow-violet-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Authenticating...' : 'Access Control Panel'}
             </button>
          </form>
       </motion.div>
    </div>
  );
}
