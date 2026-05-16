import React, { useCallback, useEffect, useRef, useState } from 'react'
import { listDevicesOnlineStatus } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { Smartphone, Wifi, WifiOff, Clock, User, Mail, Shield, RefreshCw, Zap, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function ActiveDevices() {
  const token = useAuthStore(s => s.token)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [realtime, setRealtime] = useState(false)
  const socketRef = useRef(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await listDevicesOnlineStatus(token)
      const allDevices = res.data || []
      // Filter only online devices
      const onlineDevices = allDevices.filter(d => d.online)
      // Sort by lastSeen (newest first)
      onlineDevices.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
      setDevices(onlineDevices)
    } catch (e) {
      setError(e.message || 'Failed to load active devices')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // Socket.IO listener for realtime updates
  useEffect(() => {
    if (!token) return

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setRealtime(true)
      load()
    })

    socket.on('disconnect', () => {
      setRealtime(false)
    })

    socket.on('device:status', load)
    socket.on('devices:update', load)

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('device:status', load)
      socket.off('devices:update', load)
      socket.close()
      socketRef.current = null
    }
  }, [token, load])

  const formatTime = (dateStr) => {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-8 h-8 text-violet-400 animate-pulse" />
              <h2 className="text-3xl font-bold tracking-tight text-white">
                <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Active Devices
                </span>
              </h2>
            </div>
            <p className="text-slate-400 text-sm">
              Real-time view of all currently connected devices ({devices.length})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${realtime ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
              {realtime ? <Wifi className="w-4 h-4 animate-pulse" /> : <WifiOff className="w-4 h-4" />}
              {realtime ? 'Live' : 'Offline'}
            </div>
            <motion.button
              onClick={() => load()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-300 text-xs font-bold uppercase tracking-wider hover:bg-violet-600/20 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-red-200 text-sm"
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* Devices Grid */}
      {loading && devices.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/5 border border-white/5 p-6 animate-pulse">
              <div className="h-8 bg-white/10 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-white/10 rounded" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl p-12 text-center"
        >
          <WifiOff className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Active Devices</h3>
          <p className="text-slate-500 text-sm">All devices are currently offline or disconnected</p>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device, idx) => (
            <motion.div
              key={device._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-emerald-500/20 p-6 backdrop-blur-xl hover:border-emerald-500/40 transition-all"
            >
              {/* Status indicator */}
              <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-transparent" />

              {/* Badge */}
              <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase">
                <Wifi className="w-3 h-3" />
                Online
              </div>

              {/* Device Info */}
              <div className="mb-6">
                <div className="flex items-start gap-3 mb-2">
                  <div className="p-3 rounded-lg bg-violet-500/20 border border-violet-500/30">
                    <Smartphone className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate text-lg">
                      {device.deviceName || 'Unnamed Device'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {device.deviceCode}
                    </p>
                  </div>
                </div>

                {device.deviceUserName && (
                  <div className="text-sm text-slate-300 font-medium mb-3 pl-0">
                    👤 {device.deviceUserName}
                  </div>
                )}
              </div>

              {/* Owner Info */}
              {device.owner && (
                <div className="space-y-3 pb-4 border-b border-white/5">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Owner</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-200 truncate">
                        {device.owner.name || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300 truncate">
                        {device.owner.email || '--'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Role</p>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                        {device.owner.role || 'user'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Last Seen */}
              <div className="pt-4 flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>Active {formatTime(device.lastSeen)}</span>
              </div>

              {/* Hover effect indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {devices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl p-6"
        >
          <div className="grid gap-6 md:grid-cols-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-300/80 uppercase tracking-wider mb-2">Total Active</p>
              <p className="text-2xl font-bold text-emerald-400">{devices.length}</p>
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-300/80 uppercase tracking-wider mb-2">Owners</p>
              <p className="text-2xl font-bold text-blue-400">
                {new Set(devices.map(d => String(d.owner?._id))).size}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-300/80 uppercase tracking-wider mb-2">Most Recent</p>
              <p className="text-sm font-bold text-violet-400 truncate">
                {devices[0]?.deviceName || devices[0]?.deviceCode || '--'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-xs text-cyan-300/80 uppercase tracking-wider mb-2">Live Status</p>
              <p className={`text-sm font-bold ${realtime ? 'text-emerald-400' : 'text-slate-400'}`}>
                {realtime ? '🟢 Connected' : '🔴 Offline'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
