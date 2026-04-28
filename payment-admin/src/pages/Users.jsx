import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listUsers, createUser } from '../lib/api'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Users as UsersIcon, UserPlus, Loader2, X, Search, ArrowUpRight } from 'lucide-react'

export default function Users() {
  const token = useAuthStore(s => s.token)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const res = await listUsers(token, { page: 1, limit: 20 })
        if (!ignore) setItems(res.data || [])
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load users')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [token])

  async function handleCreate(e) {
    e.preventDefault()
    if (!token) return
    setCreateError('')
    if (!form.name || !form.email || !form.password) {
      setCreateError('Name, email and password are required')
      return
    }
    try {
      setCreateLoading(true)
      await createUser(token, {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      })
      setForm({ name: '', email: '', password: '', role: 'user' })
      setCreating(false)

      // reload
      const res = await listUsers(token, { page: 1, limit: 20 })
      setItems(res.data || [])
    } catch (err) {
      setCreateError(err.message || 'Failed to create user')
    } finally {
      setCreateLoading(false)
    }
  }

  const filtered = items.filter(u => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      (u.name?.toLowerCase().includes(q)) ||
      (u.email?.toLowerCase().includes(q)) ||
      (u.role?.toLowerCase().includes(q))
    )
  })

  return (

    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex flex-col gap-2">
          <h2 className="inline-flex items-center gap-3 text-3xl font-bold tracking-tight">
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white shadow-lg shadow-violet-500/30"
            >
              <UsersIcon className="w-5 h-5" />
            </motion.span>
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-200 bg-clip-text text-transparent">
              Users Galaxy
            </span>
          </h2>
          <p className="text-slate-300/80">Manage platform members, roles & wallet access</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-violet-400 transition-colors" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white/10 w-64 transition-all"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setCreating(true); setCreateError('') }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all border border-white/10"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </motion.button>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-red-500/10 border border-red-400/20 backdrop-blur-xl p-4 text-red-200 flex items-center gap-3"
        >
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          {error}
        </motion.div>
      )}

      {/* Create User Modal */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-lg rounded-3xl bg-[#0a0a1a] border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Modal Background Effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/20 blur-3xl" />

              <div className="relative p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-violet-400" />
                    Create New Orbit User
                  </h3>
                  <button
                    onClick={() => setCreating(false)}
                    className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all"
                        placeholder="user@domain.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Role</label>
                      <div className="relative">
                        <select
                          value={form.role}
                          onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 focus:bg-white/10 appearance-none cursor-pointer"
                        >
                          <option value="user" className="bg-[#0a0a1a]">Normal User</option>
                          <option value="wallet_agent" className="bg-[#0a0a1a]">Wallet Agent</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {createError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2">
                      <X className="w-4 h-4" />
                      {createError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-colors font-medium text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 transition-all text-sm"
                    >
                      {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {createLoading ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">All Platform Users</h3>
            <p className="text-xs text-slate-400 mt-1">
              Total: {items.length} • Showing: {filtered.length}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-xs uppercase tracking-wider text-slate-400 font-medium">
                <th className="px-6 py-4 text-left">Name</th>
                <th className="px-6 py-4 text-left">Email</th>
                <th className="px-6 py-4 text-left">Role</th>
                <th className="px-6 py-4 text-left">Subscription Balance</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 italic">
                    No users found matching your search term
                  </td>
                </tr>
              ) : (
                filtered.map((u, idx) => (
                  <motion.tr
                    key={u._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                          {(u.name?.[0] || 'U').toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-200 group-hover:text-white transition-colors">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{u.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm
                          ${u.role === 'admin' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                            : u.role === 'wallet_agent' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}
                      >
                        {u.role ? u.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-emerald-300">
                        {typeof u.balance === 'number' ? `৳${u.balance.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/users/${u._id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-violet-600/20 hover:text-violet-300 text-slate-400 text-xs font-medium transition-all group/btn border border-transparent hover:border-violet-500/30"
                      >
                        Edit
                        <ArrowUpRight className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                      </Link>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

function ChevronDown(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}