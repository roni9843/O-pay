import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Phone,
  CheckCircle,
  XCircle,
  Shield,
  Lock,
  RotateCcw,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const AddPaymentMethod = () => {
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?._id); // Dynamic owner ID
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState({});
  const [gateways, setGateways] = useState({});
  const [otpSent, setOtpSent] = useState({});
  const [otps, setOtps] = useState({});
  const [existingMethods, setExistingMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [pollingInterval, setPollingInterval] = useState({});

  const providers = ['bKash', 'Rocket', 'Nagad', 'Upay'];
  const PAYMENT_GATEWAYS = ['personal', 'merchant'];

  /* ────────────────────── Fetch devices ────────────────────── */
  const fetchDevices = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/devices', token);
      setDevices((res?.data ?? []).filter((d) => d.state));
    } catch {
      setError('Failed to load devices');
    }
  }, [token]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  /* ────────────────────── Load saved methods ────────────────────── */
  useEffect(() => {
    if (!selectedDevice || devices.length === 0) {
      setPhoneNumbers({});
      setGateways({});
      setOtpSent({});
      setOtps({});
      setExistingMethods([]);
      return;
    }

    const load = async () => {
      try {
        const res = await api.get(`/api/payment-methods?device=${selectedDevice}`, token);
        const methods = Array.isArray(res?.data) ? res.data : [];
        setExistingMethods(methods);

        const device = devices.find((d) => d._id === selectedDevice);
        if (!device) return;

        const rawSim = device.subscription?.plan?.features?.simNumbers;
        let simCount = 1;
        if (rawSim !== undefined && rawSim !== null) {
          const n = parseInt(rawSim, 10);
          simCount = Number.isFinite(n) && n > 0 ? n : 2; // Wallet Agent or non-numeric -> 2 SIM
        }

        const initNums = {};
        const initGws = {};
        providers.forEach((p) => {
          initNums[p] = Array(simCount).fill('');
          initGws[p] = Array(simCount).fill('personal');
        });

        methods.forEach((m) => {
          const providerKey = providers.find(p => p.toLowerCase() === m.provider.toLowerCase());
          if (!providerKey) return;
          const idx = m.simIndex - 1;
          if (idx >= 0 && idx < simCount) {
            initNums[providerKey][idx] = m.accountNumber;
            initGws[providerKey][idx] = m.gateway || 'personal';
          }
        });

        setPhoneNumbers(initNums);
        setGateways(initGws);
        setOtpSent({});
        setOtps({});
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load saved numbers');
      }
    };

    load();
  }, [selectedDevice, devices, token]);

  const getSimCount = () => {
    if (!selectedDevice) return 0;
    const device = devices.find((d) => d._id === selectedDevice);
    const rawSim = device?.subscription?.plan?.features?.simNumbers;
    if (rawSim === undefined || rawSim === null) return 1;
    const n = parseInt(rawSim, 10);
    return Number.isFinite(n) && n > 0 ? n : 2;
  };

  const isSlotTaken = (provider, simIndex) =>
    existingMethods.some(
      (m) =>
        String(m.provider).toLowerCase() === String(provider).toLowerCase() &&
        Number(m.simIndex) === Number(simIndex)
    );

  const confirmSendOtp = (provider, index) => {
    const number = phoneNumbers[provider]?.[index] || '';
    const gateway = gateways[provider]?.[index] || 'personal';
    if (!number || number.length < 11) {
      setError('Enter a valid 11-digit number');
      return;
    }
    setConfirmModal({ provider, index, number, gateway });
  };

  const sendOtp = async () => {
    const { provider, index, number, gateway } = confirmModal;
    const key = `${provider}-${index}`;
    setLoading(true);
    setError('');

    try {
      await api.post(
        '/api/payment-methods/send-otp',
        {
          provider: provider.toLowerCase(),
          accountNumber: number,
          deviceId: selectedDevice,
          simIndex: index + 1,
          gateway,
        },
        token
      );

      setOtpSent((p) => ({ ...p, [key]: true }));
      setSuccess(`OTP sent to ${number}`);
      setTimeout(() => setSuccess(''), 3000);

      // Start polling
      startPolling(provider, index, number, gateway);
    } catch (e) {
      setError(e?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
      setConfirmModal(null);
    }
  };

  const startPolling = (provider, index, number, gateway) => {
    const key = `${provider}-${index}`;
    const ownerId = userId || '68e3e9148ac5c3e71b857170';

    // Clear previous
    if (pollingInterval[key]) clearInterval(pollingInterval[key]);

    const interval = setInterval(async () => {
      try {
        const res = await api.get(
          `/api/payment-methods/find?owner=${ownerId}&device=${selectedDevice}&provider=${provider.toLowerCase()}&accountNumber=${number}&gateway=${gateway}&simIndex=${index + 1}`,
          token
        );

        if (res?.success === true) {
          clearInterval(interval);
          setPollingInterval((p) => {
            const n = { ...p };
            delete n[key];
            return n;
          });

          const refresh = await api.get(`/api/payment-methods?device=${selectedDevice}`, token);
          setExistingMethods(Array.isArray(refresh?.data) ? refresh.data : []);

          setOtps((p) => ({ ...p, [key]: 'VERIFIED' }));
          setSuccess('Number added successfully (Auto-verified)!');
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err) {
        // Continue polling
      }
    }, 2000);

    setPollingInterval((p) => ({ ...p, [key]: interval }));
  };

  const resetOtp = (provider, index) => {
    const key = `${provider}-${index}`;
    setOtpSent((p) => ({ ...p, [key]: false }));
    setOtps((p) => ({ ...p, [key]: '' }));

    if (pollingInterval[key]) {
      clearInterval(pollingInterval[key]);
      setPollingInterval((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingInterval).forEach(clearInterval);
    };
  }, [pollingInterval]);

  if (!token) return null;

  /* ────────────────────── SELECT STYLES ────────────────────── */
  const selectClasses =
    'w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-base font-medium text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all duration-300 appearance-none cursor-pointer [&>option]:bg-slate-800 [&>option]:text-gray-200 [&>option:checked]:bg-gradient-to-r [&>option:checked]:from-cyan-600 [&>option:checked]:to-purple-600 [&>option:checked]:text-white';

  const arrowSvg = (
    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg">
              Add Payment Method
            </h1>
            <p className="text-gray-300 mt-3 text-lg font-medium">
              Link mobile numbers permanently to your device
            </p>
          </div>

          {/* Device Selector */}
          <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-7 border border-white/10 shadow-2xl mb-10">
            <label className="flex items-center gap-3 text-sm font-semibold text-cyan-300 mb-4">
              <Smartphone className="w-6 h-6 text-cyan-400" />
              Select Active Device
            </label>

            <div className="relative">
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className={selectClasses}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a5f3fc' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 1.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.2em',
                  paddingRight: '3rem',
                }}
              >
                <option value="" disabled>Choose a device</option>
                {devices.map((d) => {
                  const rawSim = d.subscription?.plan?.features?.simNumbers;
                  const n = rawSim != null ? parseInt(rawSim, 10) : 1;
                  const sims = Number.isFinite(n) && n > 0 ? n : 2;
                  return (
                    <option key={d._id} value={d._id}>
                      {d.deviceUserName} ({d.subscription?.plan?.name})   {sims} SIM
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                {arrowSvg}
              </div>
            </div>
          </div>

          {/* Providers */}
          {selectedDevice && getSimCount() > 0 && (
            <div className="grid gap-8">
              {providers.map((provider) => {
                const simCount = getSimCount();
                const numbers = phoneNumbers[provider] || Array(simCount).fill('');
                const gatewayList = gateways[provider] || Array(simCount).fill('personal');

                return (
                  <div
                    key={provider}
                    className="bg-white/5 backdrop-blur-2xl rounded-3xl p-7 border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 mb-7">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                          provider === 'bKash' ? 'bg-gradient-to-br from-pink-500 to-rose-600' :
                          provider === 'Rocket' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' :
                          provider === 'Nagad' ? 'bg-gradient-to-br from-orange-500 to-red-600' :
                          'bg-gradient-to-br from-teal-500 to-cyan-600'
                        }`}
                      >
                        <Phone className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-3xl font-bold text-white">{provider}</h3>
                    </div>

                    <div className="space-y-6">
                      {Array.from({ length: simCount }, (_, i) => {
                        const key = `${provider}-${i}`;
                        const value = numbers[i] || '';
                        const gateway = gatewayList[i] || 'personal';
                        const taken = isSlotTaken(provider, i + 1);
                        const otpProgress = otpSent[key];
                        const verified = otps[key] === 'VERIFIED';

                        return (
                          <div key={i} className="relative">

                            {/* Already added */}
                            {taken && (
                              <div className="flex items-center justify-between p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-xl">
                                <div>
                                  <p className="text-sm font-medium text-emerald-300">SIM {i + 1}</p>
                                  <p className="font-mono text-xl font-bold text-emerald-400 mt-1">{value || '—'}</p>
                                  <p className="text-xs text-emerald-400 capitalize mt-1">{gateway === 'merchant' ? 'Agent' : gateway}</p>
                                </div>
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                              </div>
                            )}

                            {/* Add new */}
                            {!taken && (
                              <div className="space-y-4">
                                <div className="flex gap-4">
                                  <div className="flex-1">
                                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                                      SIM {i + 1} Number
                                    </label>
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                        setPhoneNumbers((p) => {
                                          const arr = p[provider] || Array(simCount).fill('');
                                          arr[i] = val;
                                          return { ...p, [provider]: arr };
                                        });
                                      }}
                                      placeholder="01XXXXXXXXX"
                                      className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 transition-all duration-300 text-lg font-mono"
                                    />
                                  </div>

                                  <div className="w-36">
                                    <label className="text-sm font-medium text-gray-300 mb-2 block">Type</label>
                                    <div className="relative">
                                      <select
                                        value={gateway}
                                        onChange={(e) => {
                                          setGateways((p) => {
                                            const arr = [...(p[provider] || Array(simCount).fill('personal'))];
                                            arr[i] = e.target.value;
                                            return { ...p, [provider]: arr };
                                          });
                                        }}
                                        className={selectClasses}
                                        style={{
                                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a5f3fc' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                          backgroundPosition: 'right 1.2rem center',
                                          backgroundRepeat: 'no-repeat',
                                          backgroundSize: '1.1em',
                                          paddingRight: '2.8rem',
                                        }}
                                      >
                                        {['personal', 'merchant'].map((g) => (
  <option key={g} value={g} className="bg-gray-900 text-white">
    {g === 'merchant' ? 'Agent' : g.charAt(0).toUpperCase() + g.slice(1)}
  </option>
))}

                                      </select>
                                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        {arrowSvg}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Add Number Button */}
                                {!otpProgress && (
                                  <button
                                    onClick={() => confirmSendOtp(provider, i)}
                                    disabled={!value || value.length < 11}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-300"
                                  >
                                    <Phone className="w-5 h-5" />
                                    Add Number
                                  </button>
                                )}

                                {/* Auto Verifying */}
                                {otpProgress && !verified && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-center gap-2 text-cyan-300 animate-pulse">
                                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent"></div>
                                      <span className="text-sm font-medium">Verifying automatically...</span>
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">
                                      Please complete the OTP in your {provider} app.
                                    </p>
                                    <button
                                      onClick={() => resetOtp(provider, i)}
                                      className="w-full py-3 rounded-xl bg-red-600/80 text-white hover:bg-red-600 text-sm font-medium"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}

                                {/* Verified */}
                                {verified && (
                                  <div className="p-5 rounded-2xl bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 text-center font-bold text-lg">
                                    <CheckCircle className="w-6 h-6 inline-block mr-2" />
                                    Successfully Added
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm Modal */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-white/20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Phone className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Add Mobile Number</h2>
              </div>

              <div className="space-y-5 mb-7">
                <p className="text-gray-300 text-lg">You are about to add:</p>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                  <p className="font-mono text-2xl text-cyan-400">{confirmModal.number}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {confirmModal.provider} • {confirmModal.gateway} • SIM {confirmModal.index + 1}
                  </p>
                </div>
                <div className="p-5 bg-amber-900/30 border border-amber-500/50 rounded-2xl">
                  <p className="text-amber-300 font-bold flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    This number <span className="underline">cannot be changed or removed</span> later.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 rounded-2xl border-2 border-gray-600 text-gray-300 hover:bg-white/5 font-bold text-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={sendOtp}
                  disabled={loading}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-70"
                >
                  {loading ? <RotateCcw className="w-6 h-6 animate-spin" /> : <>Confirm & Add</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {error && (
          <div className="fixed bottom-8 right-8 p-5 rounded-2xl bg-red-600 text-white shadow-2xl flex items-center gap-4 animate-pulse z-50 font-bold text-lg">
            <XCircle className="w-7 h-7" />
            {error}
          </div>
        )}
        {success && (
          <div className="fixed bottom-8 right-8 p-5 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-4 animate-pulse z-50 font-bold text-lg">
            <CheckCircle className="w-7 h-7" />
            {success}
          </div>
        )}
      </div>
    </>
  );
};

export default AddPaymentMethod;