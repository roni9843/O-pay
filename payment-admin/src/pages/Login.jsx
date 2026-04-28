import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, me } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import logo from '../asstes/appstore.png'
import { Loader2, Lock, Mail, ChevronRight } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login({ email, password })
      setToken(res.token)
      const profile = await me(res.token)
      setUser(profile.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050510] relative overflow-hidden">
        {/* Cosmic Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]" />
           <div className="absolute top-[40%] left-[60%] w-[20%] h-[20%] bg-emerald-500/10 rounded-full blur-[80px]" />
        </div>

      <div className="relative z-10 w-full max-w-md p-4">
        <form
          onSubmit={onSubmit}
          className="rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl p-8 sm:p-10 space-y-8 relative overflow-hidden group"
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-white/10 shadow-lg shadow-violet-500/10 mb-2 ring-1 ring-white/5">
              <img src={logo} alt="Oracle Admin" className="h-16 w-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
            </div>
            <div>
               <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
               <p className="text-slate-400 text-sm mt-2">Sign in to access your admin dashboard</p>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs font-medium text-center animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group/input">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-violet-400 text-slate-500">
                    <Mail className="w-5 h-5" />
                 </div>
                 <input
                   className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500/50 transition-all text-sm"
                   placeholder="admin@example.com"
                   value={email}
                   onChange={e => setEmail(e.target.value)}
                 />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group/input">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-violet-400 text-slate-500">
                    <Lock className="w-5 h-5" />
                 </div>
                 <input
                   className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500/50 transition-all text-sm"
                   type="password"
                   placeholder="••••••••"
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                 />
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm uppercase tracking-wider flex items-center justify-center gap-2 group/btn"
          >
            {loading ? (
               <>
                 <Loader2 className="w-5 h-5 animate-spin" />
                 Signing in...
               </>
            ) : (
               <>
                 Sign In 
                 <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
               </>
            )}
          </button>

          <p className="text-[10px] text-center text-slate-500 pt-4">
            Protected by enterprise-grade security. <br/>
            Unauthorized access is strictly prohibited.
          </p>
        </form>
      </div>
    </div>
  )
}
