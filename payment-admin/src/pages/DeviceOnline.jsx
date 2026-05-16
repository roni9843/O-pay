import React, { useCallback, useEffect, useRef, useState } from 'react'
import { listDevicesOnlineStatus } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { Smartphone, Wifi, WifiOff, Clock, User, Phone, Server, CircuitBoard, RefreshCw, Battery, BatteryCharging, Signal } from 'lucide-react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function DeviceOnline() {
  const token = useAuthStore(s => s.token)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
   const [realtime, setRealtime] = useState(false)
   const [lastUpdated, setLastUpdated] = useState(null)
   const socketRef = useRef(null)

   const load = useCallback(async () => {
      if (!token) return
      setLoading(true)
      setError('')
      try {
         const res = await listDevicesOnlineStatus(token)
         setItems(res.data || [])
         setLastUpdated(new Date())
      } catch (e) {
         setError(e.message || 'Failed to load device status')
      } finally {
         setLoading(false)
      }
   }, [token])

  useEffect(() => {
      load()
   }, [load])

   useEffect(() => {
      if (!token) return

      const socket = io(SOCKET_URL, {
         transports: ['websocket'],
         reconnection: true,
         reconnectionAttempts: Infinity,
         reconnectionDelay: 1000,
      })

      socketRef.current = socket

      const refresh = () => {
         load()
    }

      socket.on('connect', () => {
         setRealtime(true)
         refresh()
      })

      socket.on('disconnect', () => {
         setRealtime(false)
      })

      socket.on('device:status', (data) => {
         setItems(prev => prev.map(item => {
            if (item.deviceCode === data.deviceId || item._id === data.deviceId) {
               return { ...item, ...data, online: data.active };
            }
            return item;
         }));
      })

      socket.on('devices:update', (data) => {
         // data is an array of online devices with telemetry
         setItems(prev => prev.map(item => {
            const live = data.find(d => d.deviceId === item.deviceCode || d.deviceId === item._id);
            if (live) {
               return { ...item, ...live, online: live.active };
            }
            return { ...item, online: false };
         }));
      })

      return () => {
         socket.off('connect')
         socket.off('disconnect')
         socket.off('device:status', refresh)
         socket.off('devices:update', refresh)
         socket.close()
         socketRef.current = null
      }
   }, [token, load])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-cyan-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[80px]" />
         <div className="relative z-10">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
               <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  Device Network
               </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
               Monitor real-time status of all connected devices and payment gateways.
            </p>
         </div>
         <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${realtime ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
               {realtime ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
               {realtime ? 'Realtime On' : 'Realtime Off'}
            </div>
            {loading && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider animate-pulse">
                   <RefreshCw className="w-4 h-4 animate-spin" /> Updating Status...
                </div>
            )}
            {lastUpdated && !loading && (
               <div className="text-[10px] text-slate-500 font-mono">
                  Last updated: {lastUpdated.toLocaleTimeString()}
               </div>
            )}
         </div>
      </div>

      {error && (
         <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
            {error}
         </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 gap-6">
        {items.length === 0 && !loading ? (
           <div className="p-12 text-center text-slate-500 rounded-3xl border border-dashed border-white/10 bg-white/5">
              No devices found.
           </div>
        ) : (
           items.map((d) => (
             <div key={d._id} className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/[0.07] transition-all group relative overflow-hidden">
                {/* Glow for Online Status */}
                {d.online && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px]" />}
                
                <div className="flex flex-col lg:flex-row lg:items-start gap-8 relative z-10">
                   
                   {/* Device Icon & Main Status */}
                   <div className="flex flex-col items-center gap-3 min-w-[120px]">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 ${d.online ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20' : 'bg-black/40'}`}>
                         <Smartphone className={`w-8 h-8 ${d.online ? 'text-emerald-400' : 'text-slate-600'}`} />
                      </div>
                      <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${d.online ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}>
                         {d.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                         {d.online ? 'Online' : 'Offline'}
                      </div>
                       <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : 'N/A'}
                      </span>

                      {/* Live Telemetry: Battery & Network */}
                      {d.online && (
                         <div className="flex flex-col gap-2 mt-4 w-full bg-black/20 p-3 rounded-xl border border-white/5">
                            {/* Battery */}
                            <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-1.5">
                                  {d.isCharging ? (
                                     <BatteryCharging className="w-4 h-4 text-amber-400 animate-pulse" />
                                  ) : (
                                     <Battery className={`w-4 h-4 ${(d.batteryLevel || 0) < 20 ? 'text-rose-500' : 'text-emerald-400'}`} />
                                  )}
                                  <span className="text-xs font-bold text-white">{d.batteryLevel || 0}%</span>
                               </div>
                               <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden ml-2">
                                  <div 
                                     className={`h-full transition-all duration-1000 ${d.isCharging ? 'bg-amber-500' : (d.batteryLevel || 0) < 20 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                     style={{ width: `${d.batteryLevel || 0}%` }}
                                  />
                               </div>
                            </div>

                            {/* Network */}
                            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                               {d.networkType === 'WiFi' ? (
                                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                               ) : (
                                  <Signal className="w-3.5 h-3.5 text-indigo-400" />
                               )}
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-300 leading-none">{d.networkType || 'Unknown'}</span>
                                  <span className="text-[9px] text-slate-500 truncate max-w-[80px]">{d.networkName || 'Scanning...'}</span>
                               </div>
                            </div>
                         </div>
                      )}
                   </div>

                   {/* Device Details */}
                   <div className="flex-1 space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                               {d.deviceName || d.deviceUserName || 'Unnamed Device'}
                            </h3>
                            <div className="text-sm text-slate-300 mb-2">User: {d.deviceUserName || 'N/A'}</div>
                            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-slate-300 mb-2">
                               <span className="px-2 py-1 rounded-full bg-white/5 border border-white/5">{d.owner?.role || 'no role'}</span>
                               <span className="px-2 py-1 rounded-full bg-white/5 border border-white/5">{d.owner?.email || 'no email'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-black/20 w-fit px-2 py-1 rounded-lg border border-white/5">
                               <CircuitBoard className="w-3 h-3" />
                               {d.deviceCode || 'NO CODE'}
                            </div>
                         </div>
                         
                         <div className="flex items-start gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                               <User className="w-4 h-4" />
                            </div>
                            <div>
                               <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Owner</div>
                               {d.owner ? (
                                  <div className="text-sm text-white">
                                     {d.owner.name} <span className="text-slate-500 text-xs">({d.owner.role})</span>
                                     <div className="text-xs text-slate-500">{d.owner.email}</div>
                                  </div>
                               ) : <div className="text-sm text-slate-500">Unassigned</div>}
                            </div>
                         </div>
                      </div>

                      {/* Payment Methods / SIMs */}
                      <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Server className="w-4 h-4" /> Connected Gateways
                         </h4>
                         
                         {(!d.paymentMethods || d.paymentMethods.length === 0) ? (
                            <div className="text-sm text-slate-500 italic">No numbers linked to this device.</div>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                               {d.paymentMethods.map((pm) => (
                                  <div key={pm._id} className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center gap-3 hover:bg-white/10 transition-colors">
                                     <div className={`p-2 rounded-lg ${pm.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        <Phone className="w-4 h-4" />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                           <span className="text-xs font-bold text-white capitalize">{pm.provider}</span>
                                           <span className={`w-2 h-2 rounded-full ${pm.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        </div>
                                        <div className="text-xs text-slate-300 font-mono truncate">{pm.accountNumber}</div>
                                        <div className="text-[10px] text-slate-500 flex gap-2 mt-0.5">
                                           <span>SIM {pm.simIndex}</span>
                                           <span>•</span>
                                           <span className="capitalize">{pm.gateway}</span>
                                        </div>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
           ))
        )}
      </div>
    </div>
  )
}
