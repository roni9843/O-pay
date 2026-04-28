import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Copy, RefreshCw, Timer, CheckCircle, XCircle, Smartphone, Laptop, Calendar, Clock } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const Device = () => {
  const token = useAuthStore((state) => state.token);

  // === STATE ===
  const [devices, setDevices] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState('');
  const [error, setError] = useState('');
  const [createdDevice, setCreatedDevice] = useState(null);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [countdowns, setCountdowns] = useState({});

  const pollIntervalRef = useRef(null);

  // === FETCH DEVICES (Stable with useCallback) ===
  const fetchDevices = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/devices', token);
      const payload = res?.data ?? res ?? [];
      setDevices(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Fetch devices failed:', err);
    }
  }, [token]);

  // === FETCH SUBSCRIPTIONS (Only once) ===
  const fetchSubscriptions = useCallback(async () => {
    if (!token || subscriptions.length > 0) return;
    try {
      const res = await api.getMySubscriptions(token);

    
      

      const subs = Array.isArray(res) ? res : [];
      setSubscriptions(subs);
    } catch (err) {
      console.error('Fetch subscriptions failed:', err);
    }
  }, [token, subscriptions.length]);

  // === INITIAL DATA LOAD ===
  useEffect(() => {
    if (!token) return;

    const loadInitial = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDevices(), fetchSubscriptions()]);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [token, fetchDevices, fetchSubscriptions]);

  // === SMART POLLING: Only when pending activation exists ===
  useEffect(() => {
    if (!token) return;

    const hasPending = devices.some(d => d.activationId && !d.state);

    // Always clear previous interval first
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (hasPending) {
      console.log('Polling started: Checking for activation every 3s');
      pollIntervalRef.current = setInterval(() => {
        fetchDevices();
      }, 3000);
    } else {
      console.log('Polling stopped: No pending activations');
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [devices, token, fetchDevices]);

  // === LIVE COUNTDOWN (Client-side) ===
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns = {};
      devices.forEach(d => {
        if (d.endActivationTime && !d.state) {
          const diff = new Date(d.endActivationTime) - new Date();
          if (diff > 0) {
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            newCountdowns[d._id] = { minutes: m, seconds: s };
          }
        }
      });
      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const id = setInterval(updateCountdowns, 1000);
    return () => clearInterval(id);
  }, [devices]);

  // === ADD DEVICE ===
  const handleAddDevice = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/api/devices', {
        deviceUserName: newDeviceName,
        subscriptionId: selectedSubscription,
      }, token);

      await fetchDevices();
      setShowAddDialog(false);
      setNewDeviceName('');
      setSelectedSubscription('');
      setCreatedDevice(res?.data ?? res);
      
      setShowActivationModal(true);


       if (window.Android) {
      window.Android.receiveActivationId(res?.data?.activationId || res?.activationId || '');
          }




    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add device');
    }
  };

  // === REGENERATE ACTIVATION CODE ===
  const handleRegenerate = async (id) => {
    try {
      await api.post(`/api/devices/${id}/regenerate-activation`, {}, token);
      await fetchDevices();
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
  };

  // === DELETE DEVICE ===
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this device?')) return;
    try {
      await api.delete(`/api/devices/${id}`, token);
      await fetchDevices();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // === UTILS ===
  const canAdd = (sub) => {
    const used = devices.filter(d => String(d.subscription?._id) === String(sub._id)).length;
    const rawMax = sub?.plan?.maxDevices ?? sub?.plan?.features?.devices ?? Infinity;
    // Treat non-numeric / "Unlimited" as no limit
    const n = Number(rawMax);
    const max = Number.isFinite(n) && n > 0 ? n : Infinity;
    return used < max;
  };

  const timeLeft = (device) => {
    const t = countdowns[device._id];
    if (!t) return 'Expired';
    return `${t.minutes}:${t.seconds.toString().padStart(2, '0')}`;
  };

  const getColor = (c) => {
    const map = {
      green: 'from-emerald-500 to-teal-600',
      blue: 'from-blue-500 to-cyan-600',
      red: 'from-rose-500 to-pink-600',
      purple: 'from-purple-500 to-indigo-600',
    };
    return map[c?.toLowerCase()] || 'from-gray-500 to-gray-600';
  };

  const getIcon = (model) => {
    if (!model) return <Smartphone className="w-4 h-4" />;
    const m = model.toLowerCase();
    if (m.includes('iphone') || m.includes('ipad')) return <Smartphone className="w-4 h-4" />;
    if (m.includes('mac') || m.includes('laptop')) return <Laptop className="w-4 h-4" />;
    return <Smartphone className="w-4 h-4" />;
  };

  // === LOADING STATE ===
  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading devices...</p>
        </div>
      </div>
    );
  }

  // === MAIN RENDER ===
  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              Device Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {devices.some(d => d.activationId && !d.state)
                ? 'Auto-refresh every 3s (waiting for activation)'
                : 'All devices active'}
            </p>
          </div>
          <button
            onClick={() => setShowAddDialog(true)}
            disabled={!subscriptions.some(canAdd)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg ${
              !subscriptions.some(canAdd)
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:shadow-xl'
            }`}
          >
            <Plus className="w-5 h-5" />
            Add Device
          </button>
        </div>
      </div>

      {/* Device Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map(d => {
          const color = getColor(d.subscription?.plan?.color);
          const pending = d.activationId && !d.state;

          return (
            <div
              key={d._id}
              className="relative bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden"
            >
              <div className={`absolute -inset-1 bg-gradient-to-r ${color} blur-xl opacity-70 ${pending ? 'animate-pulse' : ''}`}></div>

              <div className="relative p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                      {getIcon(d.deviceModelName)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{d.deviceUserName}</h3>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${color}`}>
                        {d.subscription?.plan?.name || 'Plan'}
                      </span>
                    </div>
                  </div>
                  {!d.state && (
                    <button
                      onClick={() => handleDelete(d._id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Status */}
                <div className={`p-3 rounded-2xl mb-4 flex items-center gap-2 ${d.state ? 'bg-emerald-500/20' : 'bg-yellow-500/20'} backdrop-blur`}>
                  {d.state ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="font-bold text-emerald-400">Active</span>
                    </>
                  ) : (
                    <>
                      <Timer className="w-5 h-5 text-yellow-400" />
                      <span className="font-bold text-yellow-400">Pending Activation</span>
                    </>
                  )}
                </div>

                {/* Countdown */}
                {pending && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white mb-4 animate-pulse shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Expires in
                      </span>
                      <span className="text-2xl font-mono font-bold">{timeLeft(d)}</span>
                    </div>
                  </div>
                )}

                {/* Activation Code */}
                {d.activationId && (
                  <div className="p-3 bg-white/10 rounded-xl border border-white/20 mb-4">
                    <p className="text-xs text-gray-400 mb-1">Activation Code</p>
                    <div className="flex justify-between items-center">
                      <code className="font-mono text-sm text-white select-all">{d.activationId}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(d.activationId)}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Chips */}
                <div className="space-y-2 text-sm">
                  {d.deviceName && (
                    <div className="flex justify-between p-2 bg-white/10 rounded-lg">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" /> Name
                      </span>
                      <span className="font-medium text-white">{d.deviceName}</span>
                    </div>
                  )}
                  {d.subscriptionEndDate && (
                    <div className="flex justify-between p-2 bg-white/10 rounded-lg">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Expires
                      </span>
                      <span className="font-medium text-white">
                        {new Date(d.subscriptionEndDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Regenerate Button */}
                {pending && (
                  <button
                    onClick={() => handleRegenerate(d._id)}
                    className="mt-4 w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-medium flex items-center justify-center gap-2 transition-all backdrop-blur"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate Code
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* === ADD DEVICE MODAL === */}
    {/* === ADD DEVICE MODAL === */}
{showAddDialog && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fadeIn">
    <div className="bg-white/95 backdrop-blur-3xl rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-white/30 transform transition-all scale-100 hover:scale-[1.01]">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
          Add New Device
        </h2>
        <button
          onClick={() => {
            setShowAddDialog(false);
            setError('');
            setNewDeviceName('');
            setSelectedSubscription('');
          }}
          className="p-2 rounded-full hover:bg-gray-100 transition-all"
        >
          <XCircle className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleAddDevice} className="space-y-6">

        {/* Device Name */}
        <div className="relative group">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Smartphone className="w-4 h-4 text-violet-600" />
            Device Name
          </label>
          <div className="relative">
            <input
              type="text"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 transition-all duration-300 bg-white/80 backdrop-blur-sm placeholder-gray-400 text-gray-900 font-medium"
              required
              placeholder="e.g. My iPhone 15"
            />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500 to-pink-500 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity pointer-events-none"></div>
          </div>
        </div>

        {/* Subscription Plan */}
        <div className="relative group">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Choose Plan
          </label>
          <div className="relative">
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-300 bg-white/80 backdrop-blur-sm text-gray-900 font-medium appearance-none cursor-pointer pr-12"
              required
            >
              <option value="">Select a subscription plan</option>
              {subscriptions.map((sub) => {
                const used = devices.filter(d => String(d.subscription?._id) === String(sub._id)).length;
                const max = sub?.plan?.maxDevices ?? sub?.plan?.features?.devices ?? 'Unlimited';
                const isDisabled = !canAdd(sub);
                return (
                  <option key={sub._id} value={sub._id} disabled={isDisabled}>
                    {sub.plan?.name} ({used}/{max} used)
                  </option>
                );
              })}
            </select>
            {/* Custom Arrow */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity pointer-events-none"></div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 flex items-center gap-3 animate-pulse">
            <XCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => {
              setShowAddDialog(false);
              setError('');
              setNewDeviceName('');
              setSelectedSubscription('');
            }}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-300 hover:bg-gray-50 font-semibold text-gray-700 transition-all transform hover:scale-105"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Device
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* === ACTIVATION SUCCESS MODAL === */}
      {showActivationModal && createdDevice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
              Activation Code Ready!
            </h2>
            <p className="mb-4 text-gray-700">
              Use this code on your device within the time limit.
            </p>

            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl text-white shadow-lg mb-4">
              <div className="flex items-center justify-between">
                <code className="font-mono text-lg select-all">{createdDevice.activationId}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(createdDevice.activationId)}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mt-2 flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Expires in: <span className="font-mono">{timeLeft(createdDevice)}</span>
              </p>
            </div>

            <button
              onClick={() => {
                setShowActivationModal(false);
                setCreatedDevice(null);
              }}
              className="w-full py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Device;