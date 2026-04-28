import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Check, X, Zap, Clock } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const Subscription = () => {
  const user = useAuthStore((state) => state.user);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // {planId}

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await api.getSubscriptionPlans();
        setPlans(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const colorBg = (c) =>
    c === "green"
      ? "bg-emerald-500"
      : c === "blue"
      ? "bg-blue-500"
      : c === "red"
      ? "bg-rose-500"
      : "bg-gray-500";

  const role = user?.role;
  const visiblePlans =
    role === "wallet_agent"
      ? plans.filter((p) => p.name === "Wallet Agent")
      : role === "user"
      ? plans.filter((p) => p.name !== "Wallet Agent")
      : plans;



  // সব প্ল্যানের জন্য একই সুন্দর পপ-আপ
  const PricingPopup = () => {
    if (!selected) return null;
    const plan = plans.find((p) => p._id === selected.planId);

    const options = [
      { m: 1, label: "Monthly", price: plan.pricing.monthly, save: 0 },
      {
        m: 6,
        label: "6 Months",
        price: plan.pricing.sixMonths?.price ?? 0,
        save: plan.pricing.sixMonths?.save ?? 0,
        
      },
      {
        m: 12,
        label: "1 Year",
        price: plan.pricing.yearly?.price ?? 0,
        save: plan.pricing.yearly?.save ?? 0,
        best: true,
      },
    ].filter(opt => opt.price > 0); // যদি কোনো অপশন না থাকে

    const [selectedOption, setSelectedOption] = useState(null);
    const [domain, setDomain] = useState('');
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    const [message, setMessage] = useState(null);

    const doPurchase = async (opt) => {
      setMessage(null);
      const isWalletAgent = plan.name === 'Wallet Agent';
      if (!isWalletAgent && (!domain || !String(domain).trim())) {
        setMessage({ type: 'error', text: 'Domain is required' });
        return;
      }
      setLoadingPurchase(true);
      try {
        const token = localStorage.getItem('token');
        const payload = { planId: plan._id, durationMonths: opt.m };
        if (!isWalletAgent) {
          payload.domain = domain;
        }
        const res = await api.purchaseSubscription(token, payload);
        setMessage({ type: 'success', text: res.message || 'Purchased successfully!' });
        if (res.user && window.__SET_USER__) window.__SET_USER__(res.user);
        try {
          const { useAuthStore } = await import('../../store/authStore');
          const setUser = useAuthStore.getState().setUser;
          if (setUser) setUser(res.user);
        } catch (e) {}
        setTimeout(() => setSelected(null), 1500);
      } catch (err) {
        setMessage({ type: 'error', text: err.message || 'Purchase failed' });
      } finally {
        setLoadingPurchase(false);
      }
    };

    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={() => setSelected(null)}
      >
        <div
          className="relative w-full max-w-md my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* গ্রেডিয়েন্ট বর্ডার */}
          <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-3xl blur-xl opacity-75"></div>

          {/* মেইন কার্ড - সাদা + ক্লিন */}
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">

            {/* হেডার */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-5 text-center">
              <h3 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                <Zap className="w-7 h-7" />
                {plan.name} Plan
              </h3>
              <p className="text-purple-100 text-sm mt-1">Choose your billing cycle</p>
            </div>

            {/* ক্লোজ বাটন */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 hover:bg-black/30 transition flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* কনটেন্ট */}
            <div className="p-5 space-y-4 text-gray-800">

              {/* অপশনগুলো */}
              <div className="grid gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.m}
                    type="button"
                    onClick={() => setSelectedOption(opt)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center text-sm font-medium relative
                      ${selectedOption?.m === opt.m
                        ? "border-purple-500 bg-purple-50 shadow-sm ring-2 ring-purple-200"
                        : "border-gray-300 hover:border-purple-400 hover:bg-gray-50"
                      }`}
                  >
                    <div>
                      <span className={opt.best ? "text-purple-700 font-bold" : ""}>
                        {opt.label}
                      </span>
                      {opt.save > 0 && (
                        <span className="block text-xs text-green-600 font-semibold">
                          Save ৳{opt.save}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold">৳{opt.price}</div>
                      {opt.m > 1 && (
                        <div className="text-xs text-gray-500">
                          ৳{Math.round(opt.price / opt.m)}/mo
                        </div>
                      )}
                    </div>

                    {/* BEST VALUE ব্যাজ */}
                    {opt.best && (
                      <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs px-3 py-1 rounded-full font-bold shadow">
                        BEST
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Domain + Purchase */}
              <div className="pt-3 border-t border-gray-200">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selected Plan
                  </label>
                  <p className="font-semibold text-purple-700">
                    {selectedOption ? `${selectedOption.label} — ৳${selectedOption.price}` : "—"}
                  </p>
                </div>
                {plan.name !== 'Wallet Agent' && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domain <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-sm"
                      placeholder="example.com"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => doPurchase(selectedOption)}
                    disabled={loadingPurchase || !selectedOption}
                    className={`flex-1 py-2.5 rounded-lg font-semibold transition text-sm
                      ${selectedOption?.best
                        ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:shadow-lg"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loadingPurchase ? "Processing..." : `Purchase${selectedOption ? " " + selectedOption.label : ""}`}
                  </button>
                  <button
                    onClick={() => { setDomain(''); setSelectedOption(null); }}
                    className="px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition font-medium text-sm"
                  >
                    Clear
                  </button>
                </div>

                {message && (
                  <p className={`mt-2 text-sm font-medium ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                    {message.text}
                  </p>
                )}
              </div>
            </div>

            {/* ফুটার */}
            <div className="bg-gray-50 px-5 py-3 text-center border-t">
              <p className="text-xs text-gray-600">
                Secure • Cancel anytime • 30-day money back
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-900 flex items-center justify-center">
        <p className="text-white text-xl animate-pulse">Loading Plans...</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-900 py-12 px-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h1>
          <p className="text-gray-300">30-day money back • Cancel anytime</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {visiblePlans.map((plan, i) => (
            <div
              key={plan._id}
              className={`relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5
                         hover:scale-105 transition-all duration-300
                         ${i === 1 ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-transparent" : ""}`}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-4 py-1 rounded-full text-xs font-bold">
                  POPULAR
                </span>
              )}

              <div className="text-center mb-4">
                <div className={`w-12 h-12 ${colorBg(plan.color)} rounded-full mx-auto mb-3`} />
                <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
              </div>

              <div className="text-center mb-5">
                <p className="text-4xl font-bold text-white">
                  ৳{plan.pricing.monthly}
                  <span className="text-lg text-gray-300">/mo</span>
                </p>
              </div>

              <ul className="space-y-2 text-gray-200 text-sm mb-6">
                {[
                  `${plan.features.domain} Domains`,
                  `${plan.features.devices} Devices`,
                  `${plan.features.simNumbers} SIM`,
                  `${plan.features.uniqueIDs} Unique IDs`,
                ].map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>

              {user?.subscription?.planId === plan._id && new Date(user.subscription.expiryDate) > new Date() ? (
                <div className="w-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5" />
                  {Math.ceil((new Date(user.subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))} days left
                </div>
              ) : (
                <button
                  onClick={() => setSelected({ planId: plan._id })}
                  className="w-full bg-gradient-to-r from-pink-500 to-yellow-500 text-black font-bold py-3 rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  Buy Now
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <PricingPopup />
    </>
  );
};

export default Subscription;