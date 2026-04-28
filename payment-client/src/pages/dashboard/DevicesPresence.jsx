import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../../store/authStore";
import api from "../../lib/api";
import { Wifi, WifiOff, Clock, Smartphone, Activity, Zap } from "lucide-react";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function DevicesPresence() {
  const token = useAuthStore((s) => s.token);
  const [devices, setDevices] = useState([]);
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  const presenceMap = useMemo(() => {
    const m = new Map();
    presence.forEach((p) => m.set(String(p.deviceId), p));
    return m;
  }, [presence]);

  const merged = useMemo(() => {
    return devices.map((d) => {
      const key = d.deviceCode || d.deviceName || d._id;
      const p = presenceMap.get(String(key));
      return {
        id: d._id,
        userName: d.deviceUserName,
        deviceName: d.deviceName,
        deviceCode: d.deviceCode,
        plan: d.subscription?.plan?.name,
        active: p ? p.active : false,
        lastSeen: p ? p.lastSeen : null,
      };
    });
  }, [devices, presenceMap]);

  const onlineDevices = useMemo(() => merged.filter((m) => m.active), [merged]);

  useEffect(() => {
    let mounted = true;
    const fetchDevices = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await api.getMyDevices(token);
        const payload = res?.data ?? res;
        if (mounted) setDevices(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDevices();
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("devices:list"));
    socket.on("devices:update", (list) => setPresence(Array.isArray(list) ? list : []));
    socket.on("device:status", (entry) => {
      if (!entry || !entry.deviceId) return;
      setPresence((prev) => {
        const map = new Map(prev.map((p) => [p.deviceId, p]));
        map.set(entry.deviceId, { ...(map.get(entry.deviceId) || { deviceId: entry.deviceId }), ...entry });
        return Array.from(map.values());
      });
    });

    return () => socket.disconnect();
  }, []);

  const formatLastSeen = (iso) => {
    if (!iso) return "Never";
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const sec = Math.floor(diffMs / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      return `${day}d ago`;
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-xl font-medium text-purple-200 animate-pulse">Loading your devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 text-center">
        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent animate-pulse">
          Device Presence
        </h1>
        <p className="mt-3 text-lg text-purple-200 font-light tracking-wider">
          Real-time status of all your connected devices
        </p>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-700 p-1 transform hover:scale-105 transition-all duration-500">
          <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-cyan-400 group-hover:animate-bounce" />
            <p className="text-purple-300 text-sm tracking-widest">TOTAL DEVICES</p>
            <p className="text-5xl font-bold text-white mt-2">{devices.length}</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-1 transform hover:scale-105 transition-all duration-500">
          <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <Activity className="w-12 h-12 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-emerald-300 text-sm tracking-widest">ONLINE NOW</p>
            <p className="text-5xl font-bold text-white mt-2 flex items-center justify-center gap-3">
              {onlineDevices.length}
              <Zap className="w-10 h-10 text-yellow-400 animate-ping" />
            </p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500 to-rose-600 p-1 transform hover:scale-105 transition-all duration-500">
          <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-pink-400" />
            <p className="text-pink-300 text-sm tracking-widest">LAST REFRESH</p>
            <p className="text-3xl font-mono text-white mt-2">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Device List */}
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-4">
          {merged.length === 0 ? (
            <div className="text-center py-20">
              <WifiOff className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-2xl text-gray-400">No devices registered yet</p>
            </div>
          ) : (
            merged.map((d, i) => (
              <div
                key={d.id}
                className={`relative overflow-hidden rounded-3xl border ${
                  d.active
                    ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/50 shadow-2xl shadow-emerald-500/20"
                    : "bg-gray-900/50 border-gray-700"
                } backdrop-blur-xl p-6 transform hover:scale-[1.02] transition-all duration-500`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${d.active ? "bg-emerald-500/20" : "bg-gray-800"}`}>
                      {d.active ? (
                        <Wifi className="w-8 h-8 text-emerald-400 animate-pulse" />
                      ) : (
                        <WifiOff className="w-8 h-8 text-gray-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-extrabold text-white">
                          {d.userName || d.deviceName || "Unknown Device"}
                        </h3>
                        {d.active && (
                          <span className="px-4 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 text-black animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      {d.userName && d.deviceName && (
                        <div className="text-sm text-purple-300 mt-0.5">
                          Device: {d.deviceName}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        {d.deviceCode || d.id.slice(-8)}
                      </div>
                      {d.plan && (
                        <p className="text-sm text-cyan-400 mt-1">Plan: {d.plan}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400">Last Seen</p>
                    <p className={`text-2xl font-bold ${d.active ? "text-emerald-400" : "text-gray-500"}`}>
                      {d.active ? "Now" : formatLastSeen(d.lastSeen)}
                    </p>
                    {d.lastSeen && !d.active && (
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {new Date(d.lastSeen).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Animated background glow when online */}
                {d.active && (
                  <div className="absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 animate-pulse" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}