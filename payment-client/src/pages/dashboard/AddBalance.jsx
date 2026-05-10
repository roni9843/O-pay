import React from "react";
import { useAuthStore } from "../../store/authStore";
import api from "../../lib/api";
import {
  Wallet,
  CheckCircle,
  XCircle,
  Loader2,
  Sun,
  Moon,
  Image as ImageIcon,
  Copy,
  ArrowRight,
  ShieldCheck,
  Info,
  ExternalLink
} from "lucide-react";

export default function AddBalance() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [amount, setAmount] = React.useState(25);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [darkMode, setDarkMode] = React.useState(true);
  const [file, setFile] = React.useState(null);
  const [fileError, setFileError] = React.useState(null);
  const [binanceAddress, setBinanceAddress] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const quick = [25, 50, 100, 500, 1000, 5000];

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFileError(null);
    const num = Number(amount);
    if (isNaN(num) || num < 25) {
      setError("Minimum amount is ৳25");
      return;
    }
    if (!file) {
      setFileError("Please upload your Binance transaction screenshot");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('amount', String(num));
      form.append('screenshot', file);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.oraclepay.org'}/api/balance-topups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.message) || 'Failed to submit');
      setSuccess('Topup request submitted! Our team will verify it shortly.');
      setFile(null);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message || "Failed to add balance");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    async function fetchAddress() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.oraclepay.org'}/api/settings/binance-address`);
        const data = await res.json();
        if (res.ok) setBinanceAddress(data.address || '');
      } catch (_) { }
    }
    fetchAddress();
  }, []);

  const copyToClipboard = () => {
    if (!binanceAddress) return;
    navigator.clipboard.writeText(binanceAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-[#0f111a]" : "bg-slate-50"} transition-colors duration-500 overflow-x-hidden`}>
      {/* Background Decorative Blobs */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/20 blur-[120px] rounded-full" />
      </div>

      {/* Settings Bar */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 drop-shadow-md">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-black tracking-tighter ${darkMode ? "text-white" : "text-slate-900"}`}>
              Recharge Center
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Instant wallet topup</p>
          </div>
        </div>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-3 rounded-2xl transition-all shadow-xl shadow-black/5 ${darkMode ? "bg-white/5 text-yellow-400 border border-white/10 hover:bg-white/10" : "bg-white text-indigo-600 border border-slate-200 hover:bg-slate-50"
            }`}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Balance Info & Instructions (Lg: 5 Col) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Current Balance Card */}
            <div className={`p-8 rounded-[2.5rem] border overflow-hidden relative shadow-2xl ${darkMode ? "bg-slate-900 border-white/5" : "bg-white border-slate-200"
              }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                Available Balance
              </p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-sm font-black text-emerald-500">BDT</span>
                <h2 className={`text-5xl font-black ${darkMode ? "text-white" : "text-slate-900"}`}>
                  {user?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <div className="flex gap-4">
                <div className={`flex-1 p-4 rounded-3xl ${darkMode ? "bg-white/5" : "bg-slate-50"}`}>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Status</p>
                  <p className="text-xs font-black text-emerald-500">Fully Verified</p>
                </div>
                <div className={`flex-1 p-4 rounded-3xl ${darkMode ? "bg-white/5" : "bg-slate-50"}`}>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Method</p>
                  <p className={`text-xs font-black ${darkMode ? "text-slate-200" : "text-slate-700"}`}>Binance Pay</p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className={`p-8 rounded-[2.5rem] border ${darkMode ? "bg-white/5 border-white/5" : "bg-indigo-50/50 border-indigo-100"
              }`}>
              <h3 className={`text-sm font-black uppercase tracking-widest mb-6 ${darkMode ? "text-slate-200" : "text-slate-900"}`}>
                Recharge Process
              </h3>
              <div className="space-y-6">
                {[
                  { step: "01", title: "Copy Address", desc: "Copy the official Binance WALLET address provided." },
                  { step: "02", title: "Make Payment", desc: "Send your preferred amount through Binance app." },
                  { step: "03", title: "Upload Receipt", desc: "Select amount and upload the payment screenshot." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 group">
                    <span className="text-lg font-black text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity">
                      {item.step}
                    </span>
                    <div>
                      <h4 className={`text-sm font-black ${darkMode ? "text-white" : "text-slate-800"}`}>{item.title}</h4>
                      <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> Secure Transaction
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Topup Form (Lg: 7 Col) */}
          <div className="lg:col-span-7">
            <div className={`p-8 md:p-10 rounded-[2.5rem] border shadow-2xl relative overflow-hidden ${darkMode ? "bg-slate-900 border-white/5" : "bg-white border-slate-200"
              }`}>

              <div className="space-y-8">
                {/* Step 1: Destination */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Reciever Identity</h3>
                  </div>
                  <div className={`group relative p-4 rounded-3xl border transition-all ${darkMode ? "bg-black/40 border-white/5 hover:border-violet-500/30" : "bg-slate-50 border-slate-200 hover:border-violet-400/30"
                    }`}>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Binance BEP20 Wallet</label>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-mono font-bold break-all pr-4 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                        {binanceAddress || "Loading identity..."}
                      </span>
                      <button
                        onClick={copyToClipboard}
                        className={`p-3 rounded-xl transition-all ${copied ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : darkMode ? "bg-white/5 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-indigo-600 border border-slate-200"
                          }`}
                      >
                        {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2: Amount */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Transaction Volume</h3>
                  </div>

                  {/* Quick Select Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {quick.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(q)}
                        className={`py-3 rounded-2xl font-black text-xs transition-all border ${Number(amount) === q
                          ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                          : darkMode ? "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                      >
                        ৳{q}
                      </button>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-500">৳</div>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`w-full pl-12 pr-6 py-5 rounded-3xl border-2 text-xl font-black transition-all ${darkMode
                        ? "bg-black/50 border-white/5 text-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                        : "bg-slate-50 border-slate-100 text-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                        }`}
                      placeholder="Enter amount"
                    />
                  </div>
                </div>

                {/* Step 3: Proof */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Confirmation Receipt</h3>
                  </div>

                  <div className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all ${file ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-500" : darkMode ? "border-white/10 bg-white/5 hover:border-violet-500/30" : "border-slate-200 bg-slate-50 hover:border-violet-400/30"
                    }`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="screenshot-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setFile(f);
                        setFileError(null);
                      }}
                    />
                    <label htmlFor="screenshot-input" className="cursor-pointer block space-y-3">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-2 text-slate-400">
                        {file ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <ImageIcon className="w-6 h-6" />}
                      </div>
                      <div>
                        <p className={`text-sm font-black ${darkMode ? "text-slate-200" : "text-slate-800"}`}>
                          {file ? file.name : "Select Screenshot"}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          PNG, JPG or JPEG from Binance
                        </p>
                      </div>
                    </label>
                  </div>
                  {fileError && <p className="text-xs font-bold text-rose-500 flex items-center gap-1"><Info className="w-3 h-3" /> {fileError}</p>}
                </div>

                {/* Action */}
                <div className="pt-4">
                  <button
                    onClick={submit}
                    disabled={loading}
                    className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl ${loading
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-violet-600 to-indigo-700 text-white hover:scale-[1.02] active:scale-[0.98] shadow-violet-500/20"
                      }`}
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
                    ) : (
                      <><CheckCircle className="w-5 h-5" /> Request Recharge</>
                    )}
                  </button>
                </div>

                {/* Notifications */}
                {(success || error) && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300 ${success ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                    {success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <span className="text-xs font-black uppercase tracking-tight">{success || error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest">Oracle Pay Gateway • Secure Billing</p>
          <div className="flex gap-4">
            <a href="#" className="text-xs hover:text-violet-500 transition-colors">Privacy Policy</a>
            <span className="text-slate-800 opacity-20">•</span>
            <a href="#" className="text-xs hover:text-violet-500 transition-colors">Support Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
