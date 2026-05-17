import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import logo from "./assets/appstore.png";
import tngLogo from "./assets/tuch and go.png";
import radopayLogo from "./assets/radopay.png";
import paynorLogo from "./assets/paynor.png";
import instapayLogo from "./assets/instapay.png";
import bypitLogo from "./assets/Bypit.png";
import binanceLogo from "./assets/binance.png";
import BkashPayment from "./BkashPayment";

const mobileWallets = [
  { name: "bKash", logo: "https://images.seeklogo.com/logo-png/27/1/bkash-logo-png_seeklogo-273684.png", account: "" },
  { name: "Nagad", logo: "https://images.seeklogo.com/logo-png/41/3/nagad-logo-png_seeklogo-411803.png" },
  { name: "Rocket", logo: "https://static.vecteezy.com/system/resources/thumbnails/068/706/013/small_2x/rocket-color-logo-mobile-banking-icon-free-png.png" },
  { name: "Upay", logo: "https://static.vecteezy.com/system/resources/previews/068/706/007/non_2x/upay-logo-color-mobile-banking-app-icon-free-png.png" },
];

const bankWallets = [
  { name: "City Bank", logo: "https://paystation.com.bd/paystation/payment_partner/Asset_12city@2x.png" },
  { name: "NexusPay", logo: "https://paystation.com.bd/paystation/payment_partner/Group_12@2x.png" },
  { name: "DBBL", logo: "https://paystation.com.bd/paystation/payment_partner/Asset_10dbbl@2x.png" },
  { name: "UCB", logo: "https://paystation.com.bd/paystation/payment_partner/Asset_7ucb@2x.png" },
  { name: "National Bank Limited", logo: "https://paystation.com.bd/paystation/payment_partner/Asset_42national@2x.png" },
  { name: "Southeast Bank PLC", logo: "https://paystation.com.bd/paystation/payment_partner/Asset_38aib@2x.png" },
];

const cryptoWallets = [
  { name: "Touch 'n Go", logo: tngLogo },
  { name: "RadoPay", logo: radopayLogo },
  { name: "Paynor", logo: paynorLogo },
  { name: "InstaPay", logo: instapayLogo },
  { name: "Bybit", logo: bypitLogo },
  { name: "Binance", logo: binanceLogo },
];

export default function PaymentFootprint() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [playIndex, setPlayIndex] = useState(0);

  // Visual UI state (same layout as PaymentPage)
  const [activeTab, setActiveTab] = useState(1);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [showTrxScreen, setShowTrxScreen] = useState(false);
  const [lastTxid, setLastTxid] = useState("");
  const [replayMethod, setReplayMethod] = useState(null);
  const [replayTemplate, setReplayTemplate] = useState(null);
  const [activeProviders, setActiveProviders] = useState({
    bkash: false,
    nagad: false,
    rocket: false,
    upay: false,
  });
  const [pointerPos, setPointerPos] = useState({ x: null, y: null, visible: false, pointerType: 'mouse' });
  const [verifying, setVerifying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [failMessage, setFailMessage] = useState('');
  const [pendingCountdown, setPendingCountdown] = useState(20);

  useEffect(() => {
    let interval;
    if (verifying) {
      setPendingCountdown(20);
      interval = setInterval(() => {
        setPendingCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [verifying]);

  // Precompute gaps between events (ms) for playback speed
  const gaps = useMemo(() => {
    if (!events.length) return [];
    const arr = [800];
    for (let i = 1; i < events.length; i += 1) {
      const prev = new Date(events[i - 1].at).getTime();
      const cur = new Date(events[i].at).getTime();
      const diff = Math.max(300, Math.min(2500, cur - prev));
      arr.push(diff);
    }
    return arr;
  }, [events]);

  // Load session + events
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/opay-business/session-events/${code}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || "Failed to load session footprint");
          setLoading(false);
          return;
        }
        setSession(data);
        setEvents(data.events || []);
        setPlayIndex(0);
        setActiveTab(1);
        setSelectedWallet(null);
        setUnavailableOpen(false);
        setSelectedMethod("");
        setShowTrxScreen(false);
        setLastTxid("");
        setReplayMethod(null);
        setReplayTemplate(null);
        setPointerPos({ x: null, y: null, visible: false, pointerType: 'mouse' });
        setLoading(false);
      } catch (e) {
        setError("Server connection failed");
        setLoading(false);
      }
    }
    if (code) load();
  }, [code]);

  // Load current active providers (for showing "Active" badges)
  useEffect(() => {
    async function loadWalletStatus() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/opay-business/wallet-status`);
        const data = await res.json();
        if (res.ok && data.success && data.providers) {
          setActiveProviders(prev => ({ ...prev, ...data.providers }));
        }
      } catch (_) {
        // ignore
      }
    }
    loadWalletStatus();
  }, []);

  // Apply events step-by-step to drive the UI like a video
  useEffect(() => {
    if (!events.length) return undefined;
    if (playIndex >= events.length - 1) return undefined;

    const delay = gaps[playIndex + 1] || 1000;
    const id = setTimeout(() => {
      setPlayIndex(i => Math.min(events.length - 1, i + 1));
    }, delay);
    return () => clearTimeout(id);
  }, [events, playIndex, gaps]);

  // Whenever playIndex changes, update visual state
  useEffect(() => {
    if (!events.length) return;
    const ev = events[playIndex];
    if (!ev) return;
    const meta = ev.meta || {};

    switch (ev.type) {
      case 'page_open':
        setActiveTab(1);
        break;
      case 'wallet_select':
        setActiveTab(1);
        setSelectedWallet(meta.walletName || null);
        setUnavailableOpen(false);
        setShowTrxScreen(false);
        break;
      case 'wallet_unavailable_click':
        setSelectedMethod(meta.walletName || 'This payment method');
        setUnavailableOpen(true);
        setShowTrxScreen(false);
        break;
      case 'unavailable_dismiss':
        setUnavailableOpen(false);
        break;
      case 'pay_click':
        setReplayMethod(meta.method || null);
        setReplayTemplate(meta.template || null);
        setShowTrxScreen(true);
        break;
      case 'trx_back':
        setShowTrxScreen(false);
        break;
      case 'trx_verify_click':
        setLastTxid(meta.txid || "");
        setShowTrxScreen(true);
        setVerifying(true);
        setVerificationFailed(false);
        break;
      case 'trx_verify_result':
        setVerifying(false);
        if (meta.success) {
          setPaymentSuccess(true);
          setShowTrxScreen(false);
        } else {
          setVerificationFailed(true);
          setFailMessage(meta.reasonMessage || 'Verification failed');
        }
        break;
      case 'tab_click':
        if (typeof meta.tabIndex === 'number') {
          setActiveTab(meta.tabIndex);
        }
        break;
      case 'pointer_move':
        if (typeof meta.x === 'number' && typeof meta.y === 'number') {
          setPointerPos({ x: meta.x, y: meta.y, visible: true, pointerType: meta.pointerType || 'mouse' });
        }
        break;
      case 'pointer_click':
        if (typeof meta.x === 'number' && typeof meta.y === 'number') {
          setPointerPos({ x: meta.x, y: meta.y, visible: true, pointerType: meta.pointerType || 'mouse' });
        }
        break;
      default:
        break;
    }
  }, [events, playIndex]);

  // For older sessions without explicit unavailable_dismiss events,
  // auto-hide the modal a short time after it appears so it
  // doesn't stay stuck on screen during replay.
  useEffect(() => {
    if (!unavailableOpen) return;

    const timer = setTimeout(() => {
      setUnavailableOpen(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [unavailableOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ececec] text-gray-800">
        <div className="text-center space-y-2">
          <div className="animate-spin h-10 w-10 border-4 border-[#20CFA2] border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500">Loading payment footprint…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ececec] text-gray-800 px-4">
        <div className="max-w-md text-center">
          <p className="text-red-500 mb-3">{error || "Session not found"}</p>
          <Link
            to={code ? `/payment/${code}` : "/"}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-[#20CFA2] text-sm font-medium text-white hover:opacity-90"
          >
            Go to payment page
          </Link>
        </div>
      </div>
    );
  }

  // If transaction screen is visible in replay, show the same BkashPayment UI (read-only feel)
  if (showTrxScreen && selectedWallet) {
    const isMasked = window.location.pathname.includes('/mask/'); // Determine masking again or reuse
    return (
      <div className="relative">
        <BkashPayment
          onBack={() => {}}
          onVerify={() => {}}
          walletName={selectedWallet}
          amount={session.amount?.toFixed ? session.amount.toFixed(2) : String(session.amount || "0")}
          initialTxid={lastTxid}
          accountNumber={replayMethod?.accountNumber}
          gateway={replayMethod?.gateway}
          merchantName={replayMethod?.ownerName}
          template={replayTemplate}
          masked={isMasked}
        />
        {/* Overlay to prevent user interaction while replaying */}
        <div className="pointer-events-none fixed inset-0" />
        {pointerPos.visible && (
          <div className="pointer-events-none fixed inset-0 z-40">
            <div
              className="w-4 h-4 rounded-full border border-white bg-black/40 shadow-lg transition-transform duration-150"
              style={{
                position: 'absolute',
                left: (pointerPos.x || 0) - 8,
                top: (pointerPos.y || 0) - 8,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const payableAmount = session.amount || 0;
  const invoiceNumber = session.invoice_number || null;

  // Detect masking mode from URL
  const { pathname } = window.location;
  const isMasked = pathname.includes('/mask/');

  // Function to mask account number (last 3 visible)
  const maskAccount = (acc) => {
    if (!acc || acc.length < 4) return acc;
    const last3 = acc.slice(-3);
    return `*****${last3}`;
  };

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-10 relative">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Small badge to indicate replay mode */}
        <div className="absolute top-3 right-4 z-20 text-[10px] px-2 py-1 rounded-full bg-black/70 text-white uppercase tracking-widest">
          {isMasked ? 'Secure Replay' : 'Replay'}
        </div>

        {/* ================= HEADER (same as PaymentPage) ================= */}
        <div
          className="relative px-6 pt-6 pb-20 text-white"
          style={{
            background: "linear-gradient(135deg, #211060, #20CFA2)",
          }}
        >
          <div className="flex justify-between items-center">
            <button className="text-2xl opacity-80 hover:opacity-100">←</button>
            <button className="text-2xl opacity-80 hover:opacity-100">×</button>
          </div>

          <div className="mt-6 flex flex-col items-center text-center gap-1">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center p-2">
              <img src={logo} alt="Opay" className="w-full h-full object-contain" />
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-wide">Opay</h1>
            <div className="mt-1 px-3 py-[2px] rounded-full bg-white/20 backdrop-blur inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400 text-[10px] font-bold text-white">
                i
              </span>
              <p className="text-xs tracking-wide">
                {invoiceNumber
                  ? `Invoice #${invoiceNumber}`
                  : code
                  ? `Session #${code}`
                  : 'Secure payment'}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 text-[10px]">
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <span className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center text-[9px] text-white font-semibold">
                  ?
                </span>
                <span className="uppercase tracking-wide">Support</span>
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <span className="w-4 h-4 rounded-full bg-sky-400 flex items-center justify-center text-[9px] text-white font-semibold">
                  ⚡
                </span>
                <span className="uppercase tracking-wide">Fast Help</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[9px] text-white font-semibold">
                  ★
                </span>
                <span className="uppercase tracking-wide">Secure Pay</span>
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 -bottom-10 -translate-x-1/2 w-[90%] bg-white rounded-2xl shadow-lg px-6 py-4 text-center">
            <p className="text-sm text-gray-500">Payable Amount</p>
            <p className="text-2xl font-bold" style={{ color: "#211060" }}>
              ৳{payableAmount?.toFixed ? payableAmount.toFixed(2) : payableAmount}
            </p>
          </div>
        </div>

        {/* ================= TABS ================= */}
        <div className="mt-12 flex text-sm font-medium border-b">
          {["Bank Transfer", "Mobile Banking", "Crypto"].map((tab, i) => (
            <button
              key={tab}
              className={`flex-1 py-4 transition ${
                i === activeTab
                  ? "border-b-2 font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              style={
                i === activeTab
                  ? { color: "#20CFA2", borderColor: "#20CFA2" }
                  : {}
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ================= CONTENT (same grid, state-driven) ================= */}
        <div className="p-6 space-y-6">
          {activeTab === 1 && (
            <div className="grid grid-cols-3 gap-6">
              {mobileWallets.map((wallet) => {
                const providerKeyMap = {
                  bKash: 'bkash',
                  Nagad: 'nagad',
                  Rocket: 'rocket',
                  Upay: 'upay',
                };
                const providerKey = providerKeyMap[wallet.name];
                const isActiveProvider = providerKey ? activeProviders[providerKey] : false;
                const logoSrc = wallet.logo;
                const isSpecial = wallet.name === "bKash" || wallet.name === "Nagad";
                const isSelected = wallet.name === selectedWallet;
                
                // MASK ACCOUNT IF NEEDED
                const displayAccount = isMasked && wallet.account 
                  ? maskAccount(wallet.account) 
                  : wallet.account;

                return (
                  <button
                    key={wallet.name}
                    className="flex flex-col items-center gap-2 group relative cursor-default"
                  >
                    <div
                      className={`
                        relative w-20 h-20 sm:w-24 sm:h-24
                        rounded-2xl bg-white shadow-md flex items-center justify-center p-4
                        transition-all duration-300
                        group-hover:shadow-xl group-hover:-translate-y-2
                        ${isSpecial ? "group-hover:scale-105" : "group-hover:scale-102"}
                        ${isSelected ? "ring-2 ring-[#20CFA2]" : ""}
                      `}
                    >
                      <img
                        src={logoSrc}
                        alt={wallet.name}
                        className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                      />

                      {isActiveProvider && (
                        <div
                          className="
                            absolute -top-1 -right-1
                            px-2.5 py-1 text-[10px] font-bold
                            bg-green-100 text-green-800
                            rounded-full shadow-md
                            border border-green-300
                            transform scale-100 group-hover:scale-110 group-hover:shadow-lg
                            transition-all duration-300
                          "
                          style={{
                            boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)",
                          }}
                        >
                          Active
                        </div>
                      )}
                    </div>

                    <span
                      className={`
                        text-sm font-medium transition-colors
                        ${isSelected
                          ? "text-[#20CFA2] font-semibold"
                          : isSpecial
                          ? "text-[#211060] group-hover:text-[#20CFA2] font-semibold"
                          : "text-gray-600 group-hover:text-gray-800"}
                      `}
                    >
                      {wallet.name}
                      {isSelected && (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-[#20CFA2]">
                          (Selected)
                        </span>
                      )}
                    </span>

                    {displayAccount && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {displayAccount}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 0 && (
            <>
              <div className="grid grid-cols-3 gap-6">
                {bankWallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    className="flex flex-col items-center gap-2 group relative cursor-default"
                  >
                    <div
                      className="
                        relative w-20 h-20 sm:w-24 sm:h-24
                        rounded-2xl bg-white shadow-md flex items-center justify-center p-4
                        transition-all duration-300
                        group-hover:shadow-xl group-hover:-translate-y-2
                      "
                    >
                      <img
                        src={wallet.logo}
                        alt={wallet.name}
                        className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                      />
                    </div>

                    <span
                      className="
                        text-sm font-medium transition-colors
                        text-gray-600 group-hover:text-gray-800
                      "
                    >
                      {wallet.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 2 && (
            <>
              <div className="grid grid-cols-3 gap-6">
                {cryptoWallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    className="flex flex-col items-center gap-2 group relative cursor-default"
                  >
                    <div
                      className="
                        relative w-20 h-20 sm:w-24 sm:h-24
                        rounded-2xl bg-white shadow-md flex items-center justify-center p-4
                        transition-all duration-300
                        group-hover:shadow-xl group-hover:-translate-y-2
                      "
                    >
                      <img
                        src={wallet.logo}
                        alt={wallet.name}
                        className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                      />
                    </div>

                    <span
                      className="
                        text-sm font-medium transition-colors
                        text-gray-600 group-hover:text-gray-800
                      "
                    >
                      {wallet.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Unavailable modal (for when user tried unavailable wallet in original session) */}
        {unavailableOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center relative"
            >
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <span className="text-red-500 text-2xl">!</span>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "#211060" }}>
                Not Available Yet
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {selectedMethod} is currently not available. Please choose another payment option.
              </p>
              <button
                className="mt-1 inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium text-white shadow-md hover:shadow-lg transition"
                style={{ background: "linear-gradient(135deg, #20CFA2, #211060)" }}
              >
                Okay, Got it
              </button>
            </div>
          </div>
        )}

        {/* ================= PAY BUTTON ================= */}
        <div className="px-6 pb-8 pt-4">
          <button
            className="w-full py-4 rounded-2xl text-lg font-semibold text-white shadow-lg transition transform active:scale-[0.98] hover:shadow-xl"
            style={{
              background: "linear-gradient(135deg, #20CFA2, #211060)",
            }}
          >
            Pay ৳{payableAmount?.toFixed ? payableAmount.toFixed(2) : payableAmount} →
          </button>

          <p className="mt-4 text-xs text-center text-gray-500">
            By continuing, you agree to our{" "}
            <span className="underline cursor-pointer" style={{ color: "#20CFA2" }}>
              Terms & Conditions
            </span>
          </p>

          <p className="mt-1 text-xs text-center text-gray-400">
            Secured & powered by olinuxs
          </p>
        </div>
      </div>
      {pointerPos.visible && (
        <div className="pointer-events-none fixed inset-0 z-40">
          <div
            className="w-4 h-4 rounded-full border border-white bg-black/40 shadow-lg transition-transform duration-150"
            style={{
              position: 'absolute',
              left: (pointerPos.x || 0) - 8,
              top: (pointerPos.y || 0) - 8,
            }}
          />
        </div>
      )}

      {/* ================= SUCCESS ANIMATION OVERLAY ================= */}
      {paymentSuccess && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-hidden">
          <style>{`
            @keyframes flyCoin {
              0% { transform: translateX(0) scale(1) rotate(0deg); opacity: 1; }
              60% { transform: translateX(180px) scale(0.6) rotate(360deg); opacity: 1; }
              100% { transform: translateX(180px) scale(0); opacity: 0; }
            }
            @keyframes pulseScale {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .coin-fly {
              animation: flyCoin 1s ease-in-out infinite;
            }
            .shop-pulse {
              animation: pulseScale 1s ease-in-out infinite;
            }
          `}</style>
          
          
          <div className="relative w-full max-w-sm h-64 flex items-center justify-center">
            {/* Wallet / User Side */}
            <div className="absolute left-10 flex flex-col items-center z-10">
              <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-lg border-2 border-slate-100 p-2">
                 <img src={logo} alt="Opay" className="w-full h-full object-contain" />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-600">Opay</p>
            </div>

            {/* Flying Money Stream */}
            <div className="absolute left-28 top-8 w-40 h-20 flex items-center pointer-events-none">
              <div className="coin-fly absolute left-0 text-2xl" style={{ animationDelay: '0s' }}>💰</div>
              <div className="coin-fly absolute left-0 text-2xl" style={{ animationDelay: '0.2s' }}>🪙</div>
              <div className="coin-fly absolute left-0 text-2xl" style={{ animationDelay: '0.4s' }}>💰</div>
              <div className="coin-fly absolute left-0 text-2xl" style={{ animationDelay: '0.6s' }}>💵</div>
            </div>

            {/* Shop / Merchant Side */}
            <div className="absolute right-10 flex flex-col items-center z-10">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-lg border-4 border-emerald-50 shop-pulse">
                 <span className="text-4xl">🏪</span>
              </div>
              <p className="mt-2 text-sm font-bold text-emerald-600">
                Merchant
              </p>
            </div>
          </div>

          <div className="text-center mt-8 animate-[slideUp_0.5s_ease-out]">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 text-white text-3xl mb-4 shadow-xl">
               ✓
             </div>
             <h2 className="text-3xl font-extrabold text-slate-800 mb-2">পেমেন্ট সফল হয়েছে!</h2>
             <p className="text-slate-500 text-lg">লেনদেন সম্পন্ন হয়েছে।</p>
          </div>
        </div>
      )}

      {/* ================= LOADING OVERLAY (AI Forensic Scan) ================= */}
      {verifying && (
        <div className="fixed inset-0 z-[110] bg-[#0a0f1c]/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 8.944 11.922.42.095.858.143 1.295.143a3 3 0 01.435-.008" />
                  </svg>
                </div>
                <div>
                  <div className="text-xl font-semibold text-white tracking-tight">এআই ফরেনসিক স্ক্যান</div>
                  <div className="text-sm text-slate-400">নিরাপদ লেনদেন যাচাইকরণ</div>
                </div>
              </div>
            </div>

            <div className="p-8">
              {/* Scanning Animation */}
              <div className="flex justify-center mb-8">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full animate-[spin_3s_linear_infinite]"></div>
                  <div className="absolute inset-2 border-4 border-dashed border-cyan-400/40 rounded-full animate-[spin_2.2s_linear_infinite_reverse]"></div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-center text-lg font-semibold text-white mb-2">
                লেনদেন বিশ্লেষণ চলছে
              </h3>

              <p className="text-center text-slate-400 text-sm leading-relaxed mb-8">
                আমাদের এআই সিস্টেম রিয়েল-টাইমে ব্যাঙ্কের রেকর্ডের সাথে আপনার লেনদেন যাচাই করছে।
              </p>

              {/* Status Steps */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  </div>
                  <span className="text-slate-300">ট্রানজ্যাকশন আইডি যাচাই করা হচ্ছে</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                  </div>
                  <span className="text-slate-300">ব্যাঙ্ক নেটওয়ার্কের সাথে মেলানো হচ্ছে</span>
                </div>

                <div className="flex items-center gap-3 text-sm opacity-75">
                  <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center">
                    <div className="w-2 h-2 bg-slate-500 rounded-full" style={{ animationDelay: '800ms' }}></div>
                  </div>
                  <span className="text-slate-400">চূড়ান্ত নিরাপত্তা যাচাই</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2 flex justify-between text-xs font-mono text-slate-400">
                <span>অগ্রগতি</span>
                <span className="text-cyan-400 font-semibold">
                  {Math.min(100, Math.floor(((20 - (pendingCountdown || 0)) / 20) * 100))}%
                </span>
              </div>

              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000 ease-out shadow-[0_0_12px_rgb(34,211,238)]"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((20 - (pendingCountdown || 0)) / 20) * 100))}%`
                  }}
                />
              </div>
            </div>

            <div className="px-8 py-4 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                অনুগ্রহ করে এই উইন্ডোটি বন্ধ করবেন না • বাকি সময়: <span className="font-mono text-slate-400">{pendingCountdown || 0}s</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= FAILURE OVERLAY ================= */}
      {verificationFailed && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transform transition-all scale-100 animate-fadeIn">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">❌</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">যাচাইকরণ ব্যর্থ হয়েছে</h3>
            <p className="text-slate-600 mb-6">{failMessage}</p>
            
            <button
              onClick={() => setVerificationFailed(false)}
              className="w-full py-3.5 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all bg-red-500"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
