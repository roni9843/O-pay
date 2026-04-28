import React from 'react';
import { Key, RefreshCw, Eye, EyeOff, ShieldCheck, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { 
  getMySubscriptions,
  getSubscriptionApiKey,
  generateSubscriptionApiKey,
  toggleSubscriptionApiKey,
  revokeSubscriptionApiKey,
  getMyPaymentMethods,
  getMyDevices
} from '../../lib/api';

export default function ApiKeyPage() {
  const token = useAuthStore(s => s.token);
  const [subs, setSubs] = React.useState([]);
  const [loadingSubs, setLoadingSubs] = React.useState(true);
  const [paymentMethods, setPaymentMethods] = React.useState([]);
  const [devices, setDevices] = React.useState([]);
  const [loadingExtras, setLoadingExtras] = React.useState(true);
  const [selected, setSelected] = React.useState('');
  const [status, setStatus] = React.useState({ hasKey: false, last4: '', active: false });
  const [fullKey, setFullKey] = React.useState(''); // only available right after generation
  const [callbackUrl, setCallbackUrl] = React.useState('');
  const [hidden, setHidden] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');
  const [cbTouched, setCbTouched] = React.useState(false);

  const isValidUrl = (u) => /^https?:\/\//i.test(String(u || '').trim());

  React.useEffect(()=> {
    let mounted = true;
    (async ()=> {
      try {
        setLoadingSubs(true);
        const data = await getMySubscriptions(token);
        if (mounted) setSubs(data);
      } catch (e) {
        setError(e.message || 'Failed to load subscriptions');
      } finally {
        if (mounted) setLoadingSubs(false);
      }
    })();
    return ()=> { mounted = false; };
  }, [token]);

  // load payment methods & devices for enriched subscription info
  React.useEffect(()=> {
    let mounted = true;
    (async ()=> {
      try {
        setLoadingExtras(true);
        const [pm, dv] = await Promise.all([
          getMyPaymentMethods(token),
          getMyDevices(token)
        ]);
        if (mounted) {
          const pmNormalized = pm && Array.isArray(pm.data) ? pm.data : (Array.isArray(pm) ? pm : []);
          setPaymentMethods(pmNormalized);
          setDevices(dv?.success ? dv.data : []);
        }
      } catch (e) {
        // non-blocking error
      } finally { if (mounted) setLoadingExtras(false); }
    })();
    return ()=> { mounted = false; };
  }, [token]);
  const subscriptionDetails = (sub) => {
    if (!sub) return { matchedMethods: [], otherMethods: [], devicesForSub: [], allMethodsForSub: [] };
    // devices belonging to this subscription
    const devicesForSub = devices.filter(d => String(d.subscription?._id || d.subscription) === String(sub._id));
    const deviceIds = new Set(devicesForSub.map(d => String(d._id)));
    // payment methods only for those devices
    const pmListRaw = Array.isArray(paymentMethods) ? paymentMethods : [];
    const methodsForSub = pmListRaw.filter(pm => {
      const devRef = pm.device?._id || pm.device; // populated or id
      return deviceIds.has(String(devRef));
    });
    // allowed providers from subscription plan snapshot
    const allowedProviders = Array.isArray(sub.featuresSnapshot?.paymentMethods)
      ? sub.featuresSnapshot.paymentMethods.map(p => p.toLowerCase())
      : [];
    const matchedMethods = methodsForSub.filter(pm => allowedProviders.includes(pm.provider?.toLowerCase()));
    const otherMethods = methodsForSub.filter(pm => !allowedProviders.includes(pm.provider?.toLowerCase()));
    return { matchedMethods, otherMethods, devicesForSub, allMethodsForSub: methodsForSub };
  };


  const loadStatus = async (subId) => {
    if (!subId) return;
    try {
      setBusy(true);
  const data = await getSubscriptionApiKey(token, subId);
  setStatus({ hasKey: data.hasKey, last4: data.apiKey ? data.apiKey.slice(-4) : '', active: !!data.active });
  setCallbackUrl(data.callbackUrl || '');
      if (data.apiKey) {
        setFullKey(data.apiKey);
        setHidden(false); // show by default per new requirement
      } else {
        setFullKey('');
        setHidden(true);
      }
    } catch (e) {
      setError(e.message || 'Status load failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = (e) => {
    const id = e.target.value;
    setSelected(id);
    setStatus({ hasKey: false, last4: '', active: false });
    setFullKey('');
    if (id) loadStatus(id);
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      // require a valid callback when creating
      if (!status.hasKey && !isValidUrl(callbackUrl)) {
        setCbTouched(true);
        throw new Error('Callback URL (http/https) is required to generate API key');
      }
  const res = await generateSubscriptionApiKey(token, selected, callbackUrl);
      setFullKey(res.apiKey);
  setStatus({ hasKey: true, last4: res.apiKey.slice(-4), active: res.active });
  setCallbackUrl(res.callbackUrl || callbackUrl || '');
      setHidden(false);
    } catch (e) { setError(e.message || 'Generate failed'); }
    finally { setBusy(false); }
  };

  const handleToggle = async () => {
    if (!selected || !status.hasKey) return;
    setBusy(true); setError('');
    try {
      const res = await toggleSubscriptionApiKey(token, selected, !status.active);
      setStatus(s => ({ ...s, active: res.active }));
    } catch (e) { setError(e.message || 'Toggle failed'); }
    finally { setBusy(false); }
  };

  const handleRevoke = async () => {
    if (!selected || !status.hasKey) return;
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      await revokeSubscriptionApiKey(token, selected);
      setStatus({ hasKey: false, last4: '', active: false });
      setFullKey('');
      setHidden(true);
    } catch (e) { setError(e.message || 'Revoke failed'); }
    finally { setBusy(false); }
  };

  const displayKey = () => {
    if (!status.hasKey) return 'কোনো কী নেই';
    return hidden ? fullKey.replace(/./g,'•') : fullKey;
  };

  const handleCopy = async () => {
    if (!status.hasKey) return;
    try {
      const copyVal = fullKey || '(hidden)';
      await navigator.clipboard.writeText(copyVal);
      setCopied(true);
      setTimeout(()=> setCopied(false),1500);
    } catch(_){/* ignore */}
  };

  const handleSaveCallback = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      // lazy import to avoid circular
      const { updateSubscriptionCallbackUrl } = await import('../../lib/api');
      await updateSubscriptionCallbackUrl(token, selected, callbackUrl);
    } catch (e) {
      setError(e.message || 'Failed to save callback URL');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg mb-4">
          <Key className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">Subscription API Key</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">নির্দিষ্ট সাবস্ক্রিপশন এর জন্য API Key তৈরি, দেখা, এক্টিভ / ইনএক্টিভ ও রিভোক করুন।</p>
      </div>

      <div className="space-y-6">
        <div className="p-5 rounded-2xl border bg-white/80 dark:bg-gray-800/70 backdrop-blur-xl shadow">
          <label className="text-sm font-medium mb-2 block">সাবস্ক্রিপশন নির্বাচন করুন *</label>
          <select value={selected} onChange={handleSelect} className="w-full mb-4 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-900 border focus:outline-none">
         
            <option value="">-- Select Subscription --</option>
            {subs.map(s => {
              const { matchedMethods, devicesForSub, allMethodsForSub } = subscriptionDetails(s);
              return (
                <option key={s._id} value={s._id}>
                  {s.plan?.name || 'Plan'} | {s.durationMonths}m | End {new Date(s.endDate).toLocaleDateString()} | Numbers {allMethodsForSub.length} (Allowed {matchedMethods.length}) | Devices {devicesForSub.length}
                </option>
              );
            })}
          </select>
          {loadingSubs && <p className="text-xs text-gray-500">লোড হচ্ছে...</p>}
          {loadingExtras && <p className="text-xs text-gray-500">এডিশনাল ডাটা লোড হচ্ছে...</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
              {/* Subscription enrichment panel */}
              <div className="mt-6 grid gap-6">
                {(() => {
                  const subObj = subs.find(s=> s._id === selected);
                  const { matchedMethods, devicesForSub } = subscriptionDetails(subObj);
                  return (
                    <>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 border">
                        <h3 className="font-medium mb-2 text-sm">এই সাবস্ক্রিপশনের সাথে ম্যাচ করা নম্বরসমূহ ({matchedMethods.length})</h3>
                        {matchedMethods.length === 0 && <p className="text-xs text-gray-500">কোনো ম্যাচ করা নম্বর নেই</p>}
                        <div className="flex flex-wrap gap-2">
                          {matchedMethods.map(m => (
                            <div key={m._id} className="px-2 py-1 text-xs rounded-lg bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700 flex items-center gap-1">
                              <span className="font-mono">{m.accountNumber}</span>
                              <span className="uppercase text-[10px] text-indigo-600 dark:text-indigo-300">{m.provider}</span>
                              <span className="text-[10px] text-gray-500">SIM{m.simIndex}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 border">
                        <h3 className="font-medium mb-2 text-sm">ডিভাইস ({devicesForSub.length})</h3>
                        {devicesForSub.length === 0 && <p className="text-xs text-gray-500">ডিভাইস নেই</p>}
                        <div className="space-y-2">
                          {devicesForSub.map(d => (
                            <div key={d._id} className="px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border flex flex-col text-xs">
                              <span className="font-semibold">{d.deviceUserName}</span>
                              <span className="text-gray-600 dark:text-gray-300">{d.deviceName || 'Unnamed'} • {d.state ? 'Active' : 'Inactive'}</span>
                              {d.deviceCode && <span className="font-mono text-[11px] text-gray-500">{d.deviceCode}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
               <div className="mt-4">
            <label className="text-sm font-medium mb-1 block">Callback URL (http/https) {status.hasKey ? '' : <span className="text-red-600">*</span>}</label>
            <div className="flex gap-2">
              {(() => { const invalidCb = !status.hasKey && cbTouched && !isValidUrl(callbackUrl); return (
              <input
                type="url"
                placeholder="https://your-server.com/webhook"
                value={callbackUrl}
                onChange={e=> setCallbackUrl(e.target.value)}
                onBlur={()=> setCbTouched(true)}
                className={`w-full flex-1 px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 ${invalidCb ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
              />
              ); })()}
              {status.hasKey && (
                <button onClick={handleSaveCallback} disabled={busy} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm">Save</button>
              )}
            </div>
            {!status.hasKey && cbTouched && !isValidUrl(callbackUrl) && (
              <p className="text-xs text-red-600 mt-1">Valid http/https callback URL দিন (উদাহরণ: https://example.com/webhook)</p>
            )}
            <p className="text-xs text-gray-500 mt-1">API key তৈরি করার সময় এই URL সংরক্ষণ হবে। পরে Save করে আপডেট করতে পারবে।</p>
          </div>

          {selected && (
            <div className="mt-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" /> API Key
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">এই সাবস্ক্রিপশন এর জন্য কী স্টেটাস।</p>
                </div>
                {status.hasKey && (
                  <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg text-xs bg-indigo-600 text-white hover:bg-indigo-700">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono break-all select-all ${status.hasKey ? 'bg-gray-100 dark:bg-gray-900' : 'bg-yellow-50 dark:bg-gray-900'}`}> {displayKey()} </div>
                {status.hasKey && (
                  <button onClick={()=> setHidden(h=>!h)} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
                    {hidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {!status.hasKey && (
                  <button
                    disabled={busy || !isValidUrl(callbackUrl)}
                    onClick={handleGenerate}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition shadow ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'}`}
                  >
                    {busy ? 'Working...' : (<><RefreshCw className="w-4 h-4"/> Generate Key</>)}
                  </button>
                )}
                {status.hasKey && (
                  <>
                    <button
                      disabled={busy}
                      onClick={handleToggle}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition shadow ${status.active ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
                    >
                      {status.active ? <ToggleRight className="w-5 h-5"/> : <ToggleLeft className="w-5 h-5"/>}
                      {status.active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={handleGenerate}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition shadow ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700'}`}
                    >Rotate</button>
                    <button
                      disabled={busy}
                      onClick={handleRevoke}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-red-600 hover:bg-red-700 text-white shadow"
                    ><Trash2 className="w-4 h-4"/> Revoke</button>
                  </>
                )}
              </div>
              {status.hasKey && <p className="text-xs text-amber-600 mt-2">পূর্ণ API Key সর্বদা এখানে দেখা যাবে (গোপন করতে আইকন চাপুন)।</p>}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <p>নোট:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>কী সব সময় পূর্ণভাবে দেখা যাবে; নিরাপত্তার জন্য Hide ব্যবহার করুন।</li>
            <li>এক্টিভ বন্ধ করলে রিকুয়েস্ট অথরাইজ হবে না, কিন্তু কী পুনরায় Active করলে আবার কাজ করবে।</li>
            <li>Rotate করলে পুরোনো কী অবৈধ হয়ে যাবে এবং নতুন কী দেখানো হবে।</li>
            <li>Revoke করলে কী মুছে যাবে; পুনরায় Generate করতে হবে।</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
