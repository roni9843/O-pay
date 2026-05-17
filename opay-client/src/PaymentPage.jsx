import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "./assets/appstore.png";
import BkashPayment from "./BkashPayment";
import tngLogo from "./assets/tuch and go.png";
import radopayLogo from "./assets/radopay.png";
import paynorLogo from "./assets/paynor.png";
import instapayLogo from "./assets/instapay.png";
import bypitLogo from "./assets/Bypit.png";
import binanceLogo from "./assets/binance.png";

const mobileWallets = [
  { name: "bKash", providerKey: "bkash" },
  { name: "Nagad", providerKey: "nagad" },
  { name: "Rocket", providerKey: "rocket" },
  { name: "Upay", providerKey: "upay" },
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

export default function SimplePaymentPage() {
  const { code } = useParams();
  const sessionStartRef = useRef(Date.now());
  const [payableAmount, setPayableAmount] = useState(10);
  const [loadingAmount, setLoadingAmount] = useState(!!code);
  const [amountError, setAmountError] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState(null);
  const [sessionCode, setSessionCode] = useState(code || null);
  const [activeProviders, setActiveProviders] = useState({
    bkash: false,
    nagad: false,
    rocket: false,
    upay: false,
  });
  const [activeTab, setActiveTab] = useState(1); // 0=Cards, 1=Mobile Banking, 2=Net Banking
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showBkashPayment, setShowBkashPayment] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [walletTemplates, setWalletTemplates] = useState({});
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState(null);
  const [verifying, setVerifying] = useState(false);
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

  useEffect(() => {
    if (paymentSuccess && redirectTarget) {
      const timer = setTimeout(() => {
        window.location.href = redirectTarget;
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, redirectTarget]);

  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

  const logSessionEvent = useCallback(
    async (type, extraMeta = {}) => {
      if (!code) return;

      try {
        const meta = {
          ...extraMeta,
          fromUrl: typeof document !== 'undefined' ? document.referrer || null : null,
          currentUrl: typeof window !== 'undefined' ? window.location.href : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          timeSincePageLoadMs: Date.now() - (sessionStartRef.current || Date.now()),
        };

        await fetch(`${API_URL}/api/opay-business/session-events/${code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, meta }),
        });
      } catch (_) {
        // ignore logging errors
      }
    },
    [code]
  );

  // Pointer / click tracking for detailed footprint (mouse / touch)
  useEffect(() => {
    if (!code) return undefined;

    let lastMove = 0;

    const handleMove = (e) => {
      const now = Date.now();
      if (now - lastMove < 300) return;
      lastMove = now;

      try {
        const meta = {
          x: e.clientX,
          y: e.clientY,
          pointerType: e.pointerType || 'mouse',
          viewportWidth: typeof window !== 'undefined' ? window.innerWidth : null,
          viewportHeight: typeof window !== 'undefined' ? window.innerHeight : null,
        };
        logSessionEvent('pointer_move', meta);
      } catch (_) {}
    };

    const handleDown = (e) => {
      try {
        const target = e.target || {};
        const rect = target.getBoundingClientRect ? target.getBoundingClientRect() : null;
        const label = (target.innerText || target.textContent || '').trim().slice(0, 80);
        const meta = {
          x: e.clientX,
          y: e.clientY,
          pointerType: e.pointerType || 'mouse',
          targetTag: target.tagName || null,
          targetLabel: label || null,
          targetX: rect ? rect.left : null,
          targetY: rect ? rect.top : null,
          targetWidth: rect ? rect.width : null,
          targetHeight: rect ? rect.height : null,
        };
        logSessionEvent('pointer_click', meta);
      } catch (_) {}
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerdown', handleDown);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerdown', handleDown);
    };
  }, [code, logSessionEvent]);

  // Load amount & meta from backend using short code so it doesn't appear in URL
  useEffect(() => {
    async function loadAmount() {
      if (!code) return;
      try {
        setLoadingAmount(true);
        setAmountError(null);
        const res = await fetch(`${API_URL}/api/opay-business/payment-page/${code}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setAmountError(data.message || 'Invalid or expired payment link');
          setLoadingAmount(false);
          return;
        }

        if (typeof data.amount === 'number' && !Number.isNaN(data.amount)) {
          setPayableAmount(data.amount);
        }
        if (data.invoice_number) {
          setInvoiceNumber(data.invoice_number);
        }
        if (data.code) {
          setSessionCode(data.code);
        }
        setLoadingAmount(false);
      } catch (err) {
        setAmountError('Server connection failed');
        setLoadingAmount(false);
      }
    }

    loadAmount();
  }, [code]);

  // Initial page open footprint
  useEffect(() => {
    logSessionEvent('page_open', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Load which wallet providers are currently active (bkash/nagad/rocket/upay)
  useEffect(() => {
    async function loadWalletStatus() {
      try {
        const env = import.meta.env.VITE_APP_ENV || 'local';
        const query = sessionCode ? `?code=${sessionCode}&env=${env}` : `?env=${env}`;
        const res = await fetch(`${API_URL}/api/opay-business/wallet-status${query}`);
        const data = await res.json();
        if (res.ok && data.success && data.providers) {
          setActiveProviders(prev => ({ ...prev, ...data.providers }));
        }
      } catch (_) {
        // Ignore error; just keep defaults (no active badge)
      }
    }

    loadWalletStatus();
  }, []);

  // Load global wallet-agent templates (for logos / colors)
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch(`${API_URL}/api/opay-business/wallet-templates`);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          const map = {};
          data.data.forEach((tpl) => {
            if (!tpl || !tpl.provider) return;
            const key = tpl.provider.toLowerCase();
            // Prefer merchant template for branding if available, else personal
            if (!map[key] || tpl.gateway === 'merchant') {
              map[key] = tpl;
            }
          });
          setWalletTemplates(map);
        }
      } catch (_) {
        // ignore
      }
    }

    loadTemplates();
  }, []);

  function handleUnavailableClick(name) {
    setSelectedMethod(name || "This payment method");
    setUnavailableOpen(true);
    logSessionEvent('wallet_unavailable_click', { walletName: name || null });
  }

  // If there is no payment session code in URL (e.g. direct /payment hit),
  // show an unauthorized / invalid link message instead of the payment UI.
  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ececec] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
          <h2 className="text-lg font-semibold mb-2" style={{ color: "#211060" }}>
            Unauthorized payment link
          </h2>
          <p className="text-sm text-gray-600">
            This payment URL is not valid. Please open the payment page from a valid checkout link generated by your merchant.
          </p>
        </div>
      </div>
    );
  }

  // When Pay is clicked with an active wallet selected, show the transaction ID screen
  if (showBkashPayment && selectedWallet && !paymentSuccess && !verifying && !verificationFailed) {
    return (
      <BkashPayment
        onBack={() => {
          setShowBkashPayment(false);
          logSessionEvent('trx_back', { walletName: selectedWallet, amount: payableAmount });
        }}
        onVerify={async (txid) => {
          setVerifying(true);
          setVerificationFailed(false);
          logSessionEvent('trx_verify_click', { walletName: selectedWallet, amount: payableAmount, txid });
          
          try {
            // Collect footprint data
            const footprint = {
              screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              language: navigator.language,
              platform: navigator.platform,
              userAgent: navigator.userAgent
            };

            const providerKeyMap = {
              bKash: 'bkash',
              Nagad: 'nagad',
              Rocket: 'rocket',
              Upay: 'upay',
            };
            const provider = providerKeyMap[selectedWallet];

            const res = await fetch(`${API_URL}/api/opay-business/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: sessionCode,
                trxid: txid,
                agentAccountNumber: selectedAccount?.accountNumber,
                provider, // Send provider for credit deduction
                footprint
              })
            });
            const data = await res.json();
            logSessionEvent('trx_verify_result', {
              walletName: selectedWallet,
              txid,
              success: Boolean(data?.success),
              reasonCode: data?.reasonCode || data?.code || null,
              reasonMessage: data?.message || null,
            });
            
            setVerifying(false);

            if (data.success && data.redirect_url) {
              setRedirectTarget(data.redirect_url);
              setShowBkashPayment(false);
              setPaymentSuccess(true);
            } else {
              setFailMessage(data.message || 'Verification failed. Please check the Transaction ID.');
              setVerificationFailed(true);
            }
          } catch (e) {
            console.error(e);
            setVerifying(false);
            setFailMessage(`Connection failed: ${e.message}. Please check console for details.`);
            setVerificationFailed(true);
          }
        }}
        walletName={selectedWallet}
        amount={payableAmount.toFixed(2)}
        accountNumber={selectedAccount?.accountNumber}
        gateway={selectedAccount?.gateway}
        merchantName={selectedAccount?.ownerName}
        template={selectedAccount?.template || null}
      />
    );
  }

  // Determine when the Pay button should be enabled:
  // - a mobile wallet is selected
  // - that wallet is active in backend
  // - amount is loaded and has no error
  const providerKeyMapForPay = {
    bKash: 'bkash',
    Nagad: 'nagad',
    Rocket: 'rocket',
    Upay: 'upay',
  };
  const selectedProviderKey = selectedWallet ? providerKeyMapForPay[selectedWallet] : null;
  const isPayEnabled = Boolean(
    selectedWallet &&
    selectedProviderKey &&
    activeProviders[selectedProviderKey] &&
    !amountError &&
    !loadingAmount,
  );

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ================= HEADER ================= */}
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
                  : sessionCode
                  ? `Session #${sessionCode}`
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
            {amountError ? (
              <p className="text-sm text-red-500">{amountError}</p>
            ) : (
              <p className="text-2xl font-bold" style={{ color: "#211060" }}>
                {loadingAmount ? '…' : `৳${payableAmount.toFixed(2)}`}
              </p>
            )}
          </div>
        </div>

        {/* ================= TABS ================= */}
        <div className="mt-12 flex text-sm font-medium border-b">
          {["Bank Transfer", "Mobile Banking", "Crypto"].map((tab, i) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(i);
                logSessionEvent('tab_click', { tabIndex: i, tabName: tab });
              }}
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

        {/* ================= CONTENT ================= */}
        <div className="p-6 space-y-6">
          {activeTab === 1 && (
            <div className="grid grid-cols-3 gap-6">
              {mobileWallets.map((wallet) => {
                const providerKey = wallet.providerKey;
                const isActiveProvider = providerKey ? activeProviders[providerKey] : false;
                const isSpecial = wallet.name === "bKash" || wallet.name === "Nagad";
                const isSelected = wallet.name === selectedWallet;
                const logoSrc =
                  wallet.name === 'bKash'
                    ? 'https://images.seeklogo.com/logo-png/27/1/bkash-logo-png_seeklogo-273684.png'
                    : wallet.name === 'Nagad'
                    ? 'https://images.seeklogo.com/logo-png/41/3/nagad-logo-png_seeklogo-411803.png'
                    : wallet.name === 'Rocket'
                    ? 'https://static.vecteezy.com/system/resources/thumbnails/068/706/013/small_2x/rocket-color-logo-mobile-banking-icon-free-png.png'
                    : wallet.name === 'Upay'
                    ? 'https://static.vecteezy.com/system/resources/previews/068/706/007/non_2x/upay-logo-color-mobile-banking-app-icon-free-png.png'
                    : null;

                const handleWalletClick = () => {
                  if (!isActiveProvider) {
                    // Not active in backend – show standard "Not Available Yet" modal
                    handleUnavailableClick(wallet.name);
                    return;
                  }

                  // Active provider (bKash, Nagad, Rocket, Upay): select it
                  logSessionEvent('wallet_select', { walletName: wallet.name });
                  setSelectedWallet(wallet.name);
                };

                return (
                  <button
                    key={wallet.name}
                    onClick={handleWalletClick}
                    className="flex flex-col items-center gap-2 group relative"
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
                        src={logoSrc || ''}
                        alt={wallet.name}
                        className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                      />

                      {/* Active badge for providers that are enabled in backend */}
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
                            boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)", // light green glow
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

                    {wallet.account && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {wallet.account}
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
                {bankWallets.map((wallet) => {
                  return (
                    <button
                      key={wallet.name}
                      onClick={() => handleUnavailableClick(wallet.name)}
                      className="flex flex-col items-center gap-2 group relative"
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
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 2 && (
            <>
              <div className="grid grid-cols-3 gap-6">
                {cryptoWallets.map((wallet) => {
                  return (
                    <button
                      key={wallet.name}
                      onClick={() => handleUnavailableClick(wallet.name)}
                      className="flex flex-col items-center gap-2 group relative"
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
                  );
                })}
              </div>
            </>
          )}
        </div>

        {unavailableOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => {
              logSessionEvent('unavailable_dismiss', { via: 'backdrop', method: selectedMethod });
              setUnavailableOpen(false);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg"
                onClick={() => {
                  logSessionEvent('unavailable_dismiss', { via: 'close_icon', method: selectedMethod });
                  setUnavailableOpen(false);
                }}
              >
                ×
              </button>
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
                onClick={() => {
                  logSessionEvent('unavailable_dismiss', { via: 'primary_button', method: selectedMethod });
                  setUnavailableOpen(false);
                }}
              >
                Okay, Got it
              </button>
            </div>
          </div>
        )}

        {/* ================= PAY BUTTON ================= */}
        <div className="px-6 pb-8 pt-4">
          <button
            disabled={!isPayEnabled}
            className={`w-full py-4 rounded-2xl text-lg font-semibold text-white shadow-lg transition transform hover:shadow-xl ${
              isPayEnabled ? 'active:scale-[0.98] cursor-pointer' : 'opacity-60 cursor-not-allowed'
            }`}
            style={{
              background: "linear-gradient(135deg, #20CFA2, #211060)",
            }}
            onClick={async () => {
              if (!isPayEnabled || !selectedWallet) return;

              const providerKeyMap = {
                bKash: 'bkash',
                Nagad: 'nagad',
                Rocket: 'rocket',
                Upay: 'upay',
              };
              const providerKey = providerKeyMap[selectedWallet];

              if (!providerKey || !activeProviders[providerKey]) {
                handleUnavailableClick(selectedWallet);
                return;
              }

              try {
                const env = import.meta.env.VITE_APP_ENV || 'local';
                const res = await fetch(`${API_URL}/api/opay-business/random-payment-method?provider=${selectedWallet.toLowerCase()}&code=${sessionCode || ''}&env=${env}`);
                const data = await res.json();
                if (!res.ok || !data.success || !data.method) {
                  handleUnavailableClick(selectedWallet);
                  return;
                }

                setSelectedAccount({
                  ...data.method,
                  template: data.template || null,
                });

                // Active wallet + chosen method: open transaction ID page and log footprint
                logSessionEvent('pay_click', {
                  walletName: selectedWallet,
                  amount: payableAmount,
                  method: data.method,
                  template: data.template || null,
                });
                setShowBkashPayment(true);
              } catch (e) {
                handleUnavailableClick(selectedWallet);
              }
            }}
          >
            Pay ৳{payableAmount.toFixed(2)} →
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
            {/* Wallet / User Side - REPLACED WITH OPAY LOGO */}
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
                {redirectTarget ? new URL(redirectTarget).hostname.replace('www.', '') : 'Merchant'}
              </p>
            </div>
          </div>

          <div className="text-center mt-8 animate-[slideUp_0.5s_ease-out]">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 text-white text-3xl mb-4 shadow-xl">
               ✓
             </div>
             <h2 className="text-3xl font-extrabold text-slate-800 mb-2">পেমেন্ট সফল হয়েছে!</h2>
             <p className="text-slate-500 text-lg">মার্চেন্টে রিডাইরেক্ট করা হচ্ছে...</p>
             
             <div className="mt-8 text-xs text-gray-400">
               <p>যদি স্বয়ংক্রিয়ভাবে রিডাইরেক্ট না হয়,</p>
               <a href={redirectTarget} className="text-emerald-600 underline hover:text-emerald-700 font-medium">
                 এগিয়ে যেতে এখানে ক্লিক করুন
               </a>
             </div>
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