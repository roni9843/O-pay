import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import api from "../../lib/api";
import { io } from "socket.io-client";
import {
  ArrowUpRight,
  Activity,
  DollarSign,
  Clock,
  Smartphone,
  Globe,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Play,
  CreditCard,
  LayoutDashboard,
  User,
  Wallet,
  Zap,
  ClipboardList,
  Wifi,
  PhoneCall,
  RefreshCw,
  Download,
  History,
  Copy,
  XCircle,
  TrendingUp
} from "lucide-react";
import opayLogo from "../../assets/appstore.png";
import CreditTopup from "./CreditTopup";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function formatAmount(value) {
  if (value == null) return "0.00";
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { 
    month: "short", 
    day: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

function CountdownTimer({ bookedAt }) {
  const [timeLeft, setTimeLeft] = React.useState('');

  React.useEffect(() => {
    if (!bookedAt) return;
    const expiry = new Date(bookedAt).getTime() + 10 * 60 * 1000;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bookedAt]);

  return <>{timeLeft || '10:00'} Min</>;
}

export default function Overview() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [refreshingCredit, setRefreshingCredit] = React.useState(false);
  const [walletSubEnd, setWalletSubEnd] = React.useState(null);
  const [walletSubActive, setWalletSubActive] = React.useState(false);
  const [toggleModal, setToggleModal] = React.useState(null); // { id, currentStatus, provider, number }
  const [pendingTopup, setPendingTopup] = React.useState(null);
  const [copyState, setCopyState] = React.useState('');
  const [pendingNagadList, setPendingNagadList] = React.useState([]);
  const [pendingBankList, setPendingBankList] = React.useState([]);
  const [pendingAutoWithdrawals, setPendingAutoWithdrawals] = React.useState([]);
  const [activeAutoWithdrawal, setActiveAutoWithdrawal] = React.useState(null); // The one currently booked by this agent
  const [completionFiles, setCompletionFiles] = React.useState([]);
  const [completingWithdrawal, setCompletingWithdrawal] = React.useState(false);

  async function acceptPendingNagad(code) {
    if (!token) return;
    if (!window.confirm('Are you sure you want to approve this Nagad payment? Webhook callback and credit deduction will run.')) return;
    try {
      await api.acceptPendingNagad(token, code);
      setPendingNagadList(prev => prev.filter(p => p.code !== code));
      alert('Nagad payment approved successfully.');
    } catch (e) {
      alert(e.message || 'Accept failed');
    }
  }

  async function rejectPendingNagad(code) {
    if (!token) return;
    if (!window.confirm('Are you sure you want to REJECT and CANCEL this Nagad payment session?')) return;
    try {
      await api.rejectPendingNagad(token, code);
      setPendingNagadList(prev => prev.filter(p => p.code !== code));
      alert('Nagad payment rejected successfully.');
    } catch (e) {
      alert(e.message || 'Reject failed');
    }
  }

  async function acceptPendingBank(code) {
    if (!token) return;
    if (!window.confirm('Are you sure you want to APPROVE this Bank Transfer payment? Credit deduction will run.')) return;
    try {
      await api.acceptPendingBankPayment(token, code);
      setPendingBankList(prev => prev.filter(p => p.code !== code));
      alert('Bank transfer payment approved successfully.');
    } catch (e) {
      alert(e.message || 'Accept failed');
    }
  }

  async function rejectPendingBank(code) {
    if (!token) return;
    if (!window.confirm('Are you sure you want to REJECT this Bank Transfer payment session?')) return;
    try {
      await api.rejectPendingBankPayment(token, code);
      setPendingBankList(prev => prev.filter(p => p.code !== code));
      alert('Bank transfer payment rejected successfully.');
    } catch (e) {
      alert(e.message || 'Reject failed');
    }
  }

  const handleToggleStatus = async () => {
    if (!toggleModal) return;
    const { id, currentStatus } = toggleModal;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    // Optimistic update
    const previousMethods = stats.paymentMethods;
    setStats(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(m => 
        m._id === id ? { ...m, status: newStatus } : m
      )
    }));
    setToggleModal(null);

    try {
      await api.togglePaymentMethodStatus(token, id, newStatus);
      // Success toast?
    } catch (err) {
      // Revert on failure
      setStats(prev => ({ ...prev, paymentMethods: previousMethods }));
      alert("Failed to update status: " + err.message);
    }
  };

  const handleRefreshCredit = async () => {
    if (refreshingCredit) return;
    setRefreshingCredit(true);
    try {
      const data = await api.me(token);
      setUser(data);
    } catch (err) {
      console.error("Failed to refresh credit:", err);
    } finally {
      setRefreshingCredit(false);
    }
  };

  const [expiringSubs, setExpiringSubs] = React.useState([]);
  const [totalAgentEarnings, setTotalAgentEarnings] = React.useState(0);
  const [totalAgentVolume, setTotalAgentVolume] = React.useState(0);
  const [completedWithdrawalCount, setCompletedWithdrawalCount] = React.useState(0);

  const loadOverviewData = React.useCallback(async () => {
    if (!token) return;
    try {
      const [dashboardRes, methodsRes, pagesRes, subsRes, topupRes, pendingNagadRes, pendingBankRes, pendingWithdrawalsRes, historyRes, agentStatsRes, meRes] = await Promise.all([
        api.getDashboardOverview(token).catch(() => ({})),
        api.getMyPaymentMethods(token).catch(() => []),
        api.getPaymentMethodPages(token).catch(() => []),
        api.getMySubscriptions(token).catch(() => []),
        api.getMyCreditTopupRequests(token).catch(() => []),
        api.getAgentPendingNagad(token).catch(() => ({ data: [] })),
        api.getAgentPendingBankPayments(token).catch(() => ({ data: [] })),
        api.getPendingAutoWithdrawals(token).catch(() => ({ data: [], pending: [], active: null })),
        api.getAutoWithdrawalHistory(token).catch(() => ({ data: [] })),
        api.getAutoWithdrawalStats(token).catch(() => ({ success: false })),
        api.me(token).catch(() => null)
      ]);

      setStats({
        ...(dashboardRes?.data || {
          totals: { totalTransactions: 0, totalAmount: 0 },
          today: { totalTransactions: 0, totalAmount: 0 },
          devices: [],
          providers: [],
          recent: [],
        }),
        paymentMethods: methodsRes?.data || [],
        methodPages: pagesRes?.data || []
      });

      const requests = topupRes?.data || [];
      const pending = requests.find(r => r.status === 'pending');
      setPendingTopup(pending || null);

      setPendingNagadList(pendingNagadRes?.data || []);
      setPendingBankList(pendingBankRes?.data || []);
      
      const pendingWithdrawalsList = pendingWithdrawalsRes?.pending || [];
      const activeBooking = pendingWithdrawalsRes?.active || null;
      
      setActiveAutoWithdrawal(activeBooking);
      setPendingAutoWithdrawals(pendingWithdrawalsList);

      const activeUser = meRes || user;
      const rawHistory = historyRes?.data || historyRes || [];
      const historyList = Array.isArray(rawHistory) ? rawHistory : [];
      const completedList = historyList.filter(h => String(h.status).toLowerCase() === 'completed');

      const calculatedVol = completedList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const calculatedEarned = completedList.reduce((sum, item) => {
        const comm = item.agentCommissionAmount !== undefined && item.agentCommissionAmount > 0
          ? item.agentCommissionAmount
          : (Number(item.amount || 0) * (activeUser?.autoWithdrawalCommissionRate || 3)) / 100;
        return sum + comm;
      }, 0);

      const userComm = (activeUser?.autoWithdrawalCommission || 0) + (activeUser?.autoWithdrawalBonus || 0);
      const userVol = activeUser?.autoWithdrawalVolume || 0;
      const userCount = activeUser?.autoWithdrawalCompletedCount || 0;

      // If dedicated stats API returned data, use it; otherwise fallback
      const agentStats = agentStatsRes?.data || {};
      const finalVol = agentStats.totalVolume ?? (calculatedVol > 0 ? calculatedVol : userVol);
      const finalCount = agentStats.completedCount ?? (completedList.length > 0 ? completedList.length : userCount);
      const finalEarned = agentStats.totalCommission ?? (userComm > 0 ? userComm : calculatedEarned);

      setTotalAgentEarnings(finalEarned);
      setTotalAgentVolume(finalVol);
      setCompletedWithdrawalCount(finalCount);

      if (meRes) setUser(meRes);

      const now = new Date();
      const tenDaysLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const warnings = (subsRes || []).filter(s => {
        const end = new Date(s.endDate);
        return end < tenDaysLater;
      });
      setExpiringSubs(warnings);

      // Check active subscription for wallet agent card
      const activeSub = (subsRes || []).find(s => s.active && new Date(s.endDate) > now);
      if (activeSub) {
        setWalletSubActive(true);
        setWalletSubEnd(activeSub.endDate);
      } else {
        const latestSub = (subsRes || []).sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
        setWalletSubActive(false);
        setWalletSubEnd(latestSub?.endDate || null);
      }
    } catch (err) {
      console.error("Overview data load error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (token) loadOverviewData();
  }, [token, loadOverviewData]);

  // Window Focus Auto-Refresh as fallback
  React.useEffect(() => {
    const onFocus = () => {
      loadOverviewData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadOverviewData]);

  React.useEffect(() => {
    if (!token || user?.role !== "wallet_agent") return;
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    
    const refreshData = () => {
      loadOverviewData();
    };

    socket.on("connect", () => {
      console.log("Socket connected for auto-withdrawals real-time sync");
    });

    socket.on("new_auto_withdrawal", (data) => {
      if (data && data.status === 'pending') {
        setPendingAutoWithdrawals(prev => {
          if (prev.find(p => p._id === data._id)) return prev;
          return [data, ...prev];
        });
      }
      refreshData();
    });

    socket.on("auto_withdrawal_completed", refreshData);
    socket.on("auto_withdrawal_booked", refreshData);
    socket.on("auto_withdrawal_cancelled", refreshData);
    socket.on("auto_withdrawal_rejected", refreshData);
    socket.on("auto_withdrawal_timeout", refreshData);
    socket.on("auto_withdrawal_updated", refreshData);
    socket.on("pending_bank_payment_created", refreshData);

    return () => {
      socket.disconnect();
    };
  }, [token, user?.role]);



  // Load current subscription end date for wallet agents (for "Valid Thru")
  React.useEffect(() => {
    if (!token || user?.role !== "wallet_agent") return;
    let cancelled = false;

    async function loadWalletSubscription() {
      try {
        const subs = await api.getMySubscriptions(token);
        if (cancelled) return;
        if (!Array.isArray(subs) || subs.length === 0) {
          setWalletSubEnd(null);
          setWalletSubActive(false);
          return;
        }
        const active = subs.filter((s) => s.active);
        const list = active.length ? active : subs;
        const sorted = [...list].sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
        const latest = sorted[0];
        setWalletSubEnd(latest?.endDate || null);
        setWalletSubActive(Boolean(latest?.active));
      } catch (_) {
        if (!cancelled) {
          setWalletSubEnd(null);
          setWalletSubActive(false);
        }
      }
    }

    loadWalletSubscription();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  // Socket for Auto Withdrawals & Real-time Auto Refresh
  React.useEffect(() => {
    if (!token || user?.role !== "wallet_agent") return;
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    
    const refreshData = () => {
      if (loadDataRef.current) loadDataRef.current();
    };

    socket.on("connect", () => {
      console.log("Socket connected for auto-withdrawals");
    });

    socket.on("new_auto_withdrawal", (data) => {
      if (data.status === 'pending') {
        setPendingAutoWithdrawals(prev => {
          if (prev.find(p => p._id === data._id)) return prev;
          return [data, ...prev];
        });
      }
      refreshData();
    });

    socket.on("auto_withdrawal_completed", refreshData);
    socket.on("auto_withdrawal_booked", refreshData);
    socket.on("auto_withdrawal_cancelled", refreshData);
    socket.on("auto_withdrawal_rejected", refreshData);
    socket.on("auto_withdrawal_timeout", refreshData);

    socket.on("auto_withdrawal_updated", (data) => {
      if (data.status !== 'pending') {
        setPendingAutoWithdrawals(prev => prev.filter(p => p._id !== data._id));
      } else {
        setPendingAutoWithdrawals(prev => {
          if (prev.find(p => p._id === data._id)) return prev;
          return [data, ...prev];
        });
      }
      
      setActiveAutoWithdrawal(prev => {
        if (prev && prev._id === data._id && data.status !== 'booked') {
          return null;
        }
        return prev;
      });

      refreshData();
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user?.role]);

  const handleBookWithdrawal = async (id) => {
    try {
      const res = await api.bookAutoWithdrawal(token, id);
      setActiveAutoWithdrawal(res.data);
      setPendingAutoWithdrawals(prev => prev.filter(p => p._id !== id));
      alert("Withdrawal booked successfully. You have 10 minutes to complete it.");
    } catch (err) {
      alert(err.message || "Failed to book");
    }
  };

  const handleRejectWithdrawal = async (id, isActive = false) => {
    const reason = window.prompt("Please enter a reason for cancelling this transfer:");
    if (reason === null) return;
    if (reason.trim() === "") {
      alert("A reason is required to cancel.");
      return;
    }
    
    try {
      await api.rejectAutoWithdrawal(token, id, reason);
      if (isActive) {
        setActiveAutoWithdrawal(null);
      } else {
        setPendingAutoWithdrawals(prev => prev.filter(p => p._id !== id));
      }
      loadOverviewData();
    } catch (err) {
      alert(err.message || "Failed to reject");
    }
  };

  const handleCompleteWithdrawal = async () => {
    if (!activeAutoWithdrawal) return;
    if (completionFiles.length === 0) {
      return alert("Please select at least one screenshot proof.");
    }
    setCompletingWithdrawal(true);
    try {
      await api.completeAutoWithdrawal(token, activeAutoWithdrawal._id, completionFiles);
      alert("Withdrawal completed successfully! Commission & Bonus added to your Auto Withdrawal Commission card.");
      setActiveAutoWithdrawal(null);
      setCompletionFiles([]);
      handleRefreshCredit(); // Refresh credit
    } catch (err) {
      alert(err.message || "Failed to complete");
    } finally {
      setCompletingWithdrawal(false);
    }
  };

  const SubscriptionAlert = () => {
    if (expiringSubs.length === 0) return null;
    
    // Sort so most urgent (expired or soonest expiry) is first
    const sorted = [...expiringSubs].sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    const mostUrgent = sorted[0];
    const isExpired = new Date(mostUrgent.endDate) < new Date();
    const daysLeft = Math.ceil((new Date(mostUrgent.endDate) - new Date()) / (1000 * 60 * 60 * 24));

    return (
      <div className="w-full max-w-6xl mx-auto mb-8 animate-in slide-in-from-top-4 duration-500">
        <div className={`relative overflow-hidden rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl border-4 ${
          isExpired 
            ? 'bg-gradient-to-r from-rose-600 to-red-700 border-rose-400 shadow-rose-500/40 text-white' 
            : 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-300 shadow-amber-500/40 text-black'
        }`}>
          {/* Background Decorative Blur */}
          <div className="absolute -top-24 -right-24 w-64 h-64 blur-[80px] rounded-full opacity-40 bg-white/20"></div>

          <div className="flex items-center gap-5 relative z-10 text-center md:text-left">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl ${
              isExpired ? 'bg-white text-rose-600' : 'bg-black text-amber-500 animate-pulse'
            }`}>
              {isExpired ? <AlertCircle className="w-9 h-9" /> : <Zap className="w-9 h-9" />}
            </div>
            <div className="space-y-1">
              <h2 className={`text-2xl font-black tracking-tight ${isExpired ? 'text-white' : 'text-black'}`}>
                {isExpired ? 'Subscription Expired!' : 'Subscription Expiring Soon!'}
              </h2>
              <p className={`font-black text-xs uppercase tracking-[0.2em] ${isExpired ? 'text-rose-100' : 'text-amber-900/80'}`}>
                {isExpired 
                  ? `Your plan for ${mostUrgent.domains?.[0] || 'your domain'} has ended.` 
                  : `Your plan for ${mostUrgent.domains?.[0] || 'your domain'} ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`}
              </p>
            </div>
          </div>

          <Link
            to="/dashboard/your-plan"
            className={`relative z-10 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all hover:scale-110 active:scale-95 shadow-2xl flex items-center gap-2 ${
              isExpired 
                ? 'bg-white text-rose-600 hover:bg-rose-50 shadow-white/20' 
                : 'bg-black text-amber-500 hover:bg-slate-900 shadow-black/40'
            }`}
          >
            <RefreshCw className="w-4 h-4" /> Renew Now
          </Link>
        </div>
      </div>
    );
  };

  if (!token) return null;

 // Specialized dashboard UI for wallet agents (green banking-style layout)
if (user?.role === "wallet_agent") {
  const emailLine = user?.email || "agent@example.com";
  const validThru = (() => {
    if (!walletSubEnd) return "MM/YY";
    const d = new Date(walletSubEnd);
    if (Number.isNaN(d.getTime())) return "MM/YY";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${yy}`;
  })();
  const creditAmount = formatAmount(user?.credit ?? 0);
  const statusLabel = walletSubActive ? "Active" : "Inactive";
  const shortcutItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/dashboard/profile", label: "Profile", icon: User },
    { to: "/dashboard/payment", label: "Payment", icon: CreditCard },
    { to: "/dashboard/add-balance", label: "Add Balance", icon: Wallet },
    { to: "/dashboard/pending-balance", label: "Pending Balance", icon: Clock },
    { to: "/dashboard/subscription", label: "Subscription", icon: Zap },
    { to: "/dashboard/your-plan", label: "Your Plan", icon: ClipboardList },
    { to: "/dashboard/device", label: "Device", icon: Smartphone },
    { to: "/dashboard/devices-presence", label: "Devices Presence", icon: Wifi },
    { to: "/dashboard/add-payment-method", label: "Add Payment Method", icon: CreditCard },
    { to: "/dashboard/number-status", label: "Number Status", icon: PhoneCall },
    { to: "/dashboard/auto-withdrawal-history", label: "Auto Withdrawals History", icon: History },
  ];

  const isCardActive = (user?.credit > 0) || (walletSubActive && new Date(walletSubEnd) > new Date());

  // Redirect to topup if credit is 0 AND NO pending request
  if ((!user?.credit || user.credit <= 0) && !pendingTopup) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="bg-gradient-to-r from-rose-600 to-rose-500 text-white text-center py-4 font-bold px-4 flex items-center justify-center gap-3 shadow-lg z-50">
           <AlertCircle className="w-6 h-6 animate-pulse" />
           <span className="text-lg">জরুরী পদক্ষেপ: আপনার এজেন্ট ড্যাশবোর্ড ব্যবহার করতে অনুগ্রহ করে একটি ক্রেডিট লিমিট প্যাকেজ কিনে নিন!</span>
        </div>
        <div className="flex-1">
          <CreditTopup />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 flex flex-col items-center px-4 sm:px-6 py-8 md:py-12">
      
      {/* Pending Topup Alert */}
      {pendingTopup && (
        <div className="w-full max-w-md lg:max-w-lg mb-6 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-5 rounded-2xl shadow-xl border border-amber-300 relative overflow-hidden flex items-center gap-4">
            <div className="absolute inset-0 bg-white/10 w-full h-full animate-pulse"></div>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center relative z-10 shrink-0">
              <Clock className="w-7 h-7 text-white animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div className="relative z-10 text-white">
              <h3 className="font-bold text-lg leading-tight mb-1">প্যাকেজ পেন্ডিং রয়েছে!</h3>
              <p className="text-xs opacity-90 font-medium">আপনার প্যাকেজ রিকোয়েস্টটি অ্যাডমিন প্যানেলে রিভিউ হচ্ছে। খুব শীঘ্রই এটি চালু হবে।</p>
            </div>
          </div>
        </div>
      )}

      <SubscriptionAlert />

      {/* --- AUTO WITHDRAWAL AGENT ALERTS (BIG) --- */}
      <div className="w-full max-w-md lg:max-w-lg mb-6 space-y-4">
        {activeAutoWithdrawal && (
          <Link to="/dashboard/auto-withdrawal-history" className="block relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-blue-500/90 border-2 border-blue-400/50 shadow-2xl hover:shadow-blue-500/40 transform hover:scale-[1.02] transition-all duration-300 p-6 group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-cyan-500/30 animate-pulse" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center shadow-lg shadow-blue-500/50 group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Active Transfer Waiting!</h2>
                  <p className="text-blue-100 text-sm mt-1 font-medium">You have a booked withdrawal of ৳{activeAutoWithdrawal.amount}.</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-white text-blue-600 rounded-xl font-bold flex items-center gap-1 group-hover:bg-blue-50 transition-colors text-xs whitespace-nowrap">
                Complete <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        )}

        {!activeAutoWithdrawal && pendingAutoWithdrawals && pendingAutoWithdrawals.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-2">Available Withdrawals ({pendingAutoWithdrawals.length})</h3>
            {pendingAutoWithdrawals.map(w => {
              const commRate = user?.autoWithdrawalCommissionRate || 0;
              const expectedProfit = (w.amount * commRate) / 100;

              return (
                <div key={w._id} className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-gradient-to-r from-amber-500 to-orange-500 border-2 border-amber-400/50 shadow-2xl hover:shadow-amber-500/40 transition-all duration-300 p-6 group animate-in slide-in-from-top-4">
                  <div className="absolute inset-0 bg-white/10 animate-pulse-slow pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex flex-col items-center justify-center mb-6 pt-4 border-b border-white/10 pb-6">
                      <div className="text-amber-100 text-xs uppercase tracking-widest font-bold mb-2 px-3 py-1 bg-white/10 rounded-full">{w.paymentMethod}</div>
                      <div className="text-[10px] text-amber-100/70 uppercase tracking-widest font-bold mb-1">Transfer Amount</div>
                      <div className="text-5xl font-black text-white drop-shadow-md">৳{w.amount}</div>

                      {/* Agent Expected Profit Badge */}
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 border border-white/20 text-white font-bold text-xs shadow-inner backdrop-blur-sm">
                        <TrendingUp className="w-4 h-4 text-emerald-300 animate-bounce" />
                        <span>উইথড্রয়াল কমিশন: <strong className="text-emerald-300 font-mono text-sm">+৳{expectedProfit.toFixed(2)}</strong> ({commRate}%)</span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-[10px] text-amber-100/70 font-mono tracking-widest bg-black/10 px-2 py-1 rounded">ID: {w._id}</span>
                    </div>

                    
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleBookWithdrawal(w._id)}
                        className="flex-1 bg-white text-orange-600 hover:bg-orange-50 hover:scale-[1.02] text-sm font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider flex justify-center items-center gap-2"
                      >
                        Accept Transfer <ArrowUpRight className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleRejectWithdrawal(w._id, false)}
                        className="px-6 bg-black/10 hover:bg-black/20 text-white rounded-xl transition-colors font-bold text-xs"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* --- END AUTO WITHDRAWAL AGENT ALERTS --- */}

      {/* Pending Nagad Alerts for Wallet Agent */}
      {pendingNagadList && pendingNagadList.length > 0 && (
        <div className="w-full max-w-md lg:max-w-lg mb-6 animate-in slide-in-from-top-4 duration-500 space-y-4">
          {pendingNagadList.map(session => (
            <div key={session.code} className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-3xl shadow-xl border border-orange-400 text-white relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-lg leading-tight uppercase tracking-wide">Nagad Verification Pending</h3>
                    <span className="text-[9px] bg-white text-orange-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Awaiting Admin
                    </span>
                  </div>
                  
                  {/* Highlighted Amount */}
                  <div className="text-3xl font-black tracking-tight">
                    ৳{Number(session.amount || 0).toLocaleString()} <span className="text-sm font-medium opacity-80">BDT</span>
                  </div>

                  <div className="pt-2 border-t border-white/20 space-y-1 text-xs font-medium">
                    <div>
                      <span className="opacity-75">Target Number:</span> <strong className="font-mono text-sm">{session.paymentMessage?.accountNumber || session.verificationAttempts?.[session.verificationAttempts.length - 1]?.agentAccountNumber || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="opacity-75">Transaction Code:</span> <strong className="font-mono">{session.code}</strong>
                    </div>
                    {session.paymentMessage?.fullMessage && (
                      <div className="mt-2 bg-black/20 p-3 rounded-xl border border-white/10 font-mono text-[11px] leading-relaxed break-all">
                        <span className="opacity-75 block text-[9px] font-black uppercase mb-1">Incoming SMS:</span>
                        "{session.paymentMessage.fullMessage}"
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-white/20 mt-3">
                    <button
                      onClick={() => acceptPendingNagad(session.code)}
                      className="flex-1 px-4 py-2 bg-green-500/90 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-lg transition-all flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={() => rejectPendingNagad(session.code)}
                      className="flex-1 px-4 py-2 bg-rose-500/90 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-lg transition-all flex items-center justify-center gap-1"
                    >
                      <AlertCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Bank Transfer Proofs for Wallet Agent */}
      {pendingBankList && pendingBankList.length > 0 && (
        <div className="w-full max-w-md lg:max-w-lg mb-6 animate-in slide-in-from-top-4 duration-500 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              🏦 Pending Bank Payments ({pendingBankList.length})
            </h3>
            <Link to="/dashboard/pending-bank" className="text-xs font-bold text-emerald-600 hover:underline">
              View All →
            </Link>
          </div>
          {pendingBankList.map(session => {
            const bDetails = session.bankDetails || {};
            const proofUrls = Array.isArray(bDetails.proofUrls) && bDetails.proofUrls.length > 0 ? bDetails.proofUrls : (bDetails.proofUrl ? [bDetails.proofUrl] : []);

            return (
              <div key={session.code} className="bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 rounded-3xl shadow-2xl border-2 border-emerald-400/50 text-white relative overflow-hidden group">
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between border-b border-white/15 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
                        🏦
                      </div>
                      <div>
                        <h4 className="font-black text-base leading-tight uppercase tracking-wider">{bDetails.bankName || 'Bank Transfer'}</h4>
                        <span className="text-[10px] font-mono text-emerald-200">Session #{session.code}</span>
                      </div>
                    </div>
                    <span className="text-[9px] bg-emerald-400 text-slate-950 font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse shadow">
                      Action Required
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-emerald-100 uppercase tracking-wider font-bold">Transfer Amount</span>
                    <span className="text-3xl font-black text-white drop-shadow-md">
                      ৳{Number(session.amount || 0).toLocaleString()} <span className="text-xs font-normal text-emerald-200">BDT</span>
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-emerald-200 font-sans text-[11px]">Account Holder:</span>
                      <strong className="text-white font-bold">{bDetails.accountHolderName || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-200 font-sans text-[11px]">Account Number:</span>
                      <strong className="text-emerald-300 font-bold">{bDetails.accountNumber || 'N/A'}</strong>
                    </div>
                  </div>

                  {/* Proof Screenshots Preview */}
                  {proofUrls.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">Screenshot Proof ({proofUrls.length}):</span>
                      <div className="grid grid-cols-2 gap-2">
                        {proofUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden border border-white/20 bg-black/40 h-24 relative group/img"
                          >
                            <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover/img:scale-105" />
                            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                              Zoom 🔍
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => acceptPendingBank(session.code)}
                      className="flex-1 py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve Payment
                    </button>
                    <button
                      onClick={() => rejectPendingBank(session.code)}
                      className="px-4 py-3 bg-rose-500/80 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Auto Withdrawal (Booked by Me) */}
      {activeAutoWithdrawal && (
        <div className="w-full max-w-md lg:max-w-lg mb-6 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl shadow-xl border border-indigo-400 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-black text-lg uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-200 animate-spin-slow" /> Active Withdrawal
              </h3>
              <span className="text-[10px] bg-white text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase">
                <CountdownTimer bookedAt={activeAutoWithdrawal.bookedAt} />
              </span>
            </div>

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-end border-b border-white/20 pb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80 mb-1">Send To ({activeAutoWithdrawal.paymentMethod})</div>
                  <div className="text-xl font-mono font-bold tracking-widest">{activeAutoWithdrawal.userIdentityAddress}</div>
                  {activeAutoWithdrawal.accountNumber && (
                    <div className="flex items-center gap-2 mt-2 bg-black/20 p-2 rounded-lg border border-white/10">
                      <div className="font-mono text-sm text-white font-bold flex-1">Acc: {activeAutoWithdrawal.accountNumber}</div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(activeAutoWithdrawal.accountNumber);
                          setCopyState(`active-${activeAutoWithdrawal._id}`);
                          setTimeout(() => setCopyState(''), 2000);
                        }}
                        className="p-1 hover:bg-white/20 rounded transition-colors text-white flex items-center gap-1 text-[10px] font-bold uppercase"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copyState === `active-${activeAutoWithdrawal._id}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider opacity-80 mb-1">Amount</div>
                  <div className="text-3xl font-black text-emerald-300">৳{activeAutoWithdrawal.amount}</div>
                </div>
              </div>
              
              {activeAutoWithdrawal.checkoutItems && activeAutoWithdrawal.checkoutItems.length > 0 && (
                <div className="bg-black/10 p-3 rounded-xl border border-white/10 mt-2 mb-2">
                  <p className="text-[10px] text-white/70 font-bold uppercase mb-2">Checkout Items</p>
                  <div className="space-y-1">
                    {activeAutoWithdrawal.checkoutItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 text-xs font-mono text-white/90">
                        {Object.entries(item).map(([k, v]) => (
                          <span key={k}><span className="font-bold text-white/50">{k}:</span> {v}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <label className="block text-xs font-medium opacity-90 mb-2">Upload Payment Screenshot (Max 5)</label>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  onChange={(e) => setCompletionFiles(Array.from(e.target.files))}
                  className="block w-full text-xs text-slate-100 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white file:text-indigo-700 hover:file:bg-indigo-50"
                />
                {completionFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {completionFiles.map((file, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden border border-white/20 shadow-sm">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="proof preview" 
                          className="w-12 h-12 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                        <button
                          onClick={() => {
                            const newFiles = [...completionFiles];
                            newFiles.splice(index, 1);
                            setCompletionFiles(newFiles);
                          }}
                          className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow transition-colors"
                          title="Remove image"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 mt-2 border-t border-white/20">
                <button
                  onClick={handleCompleteWithdrawal}
                  disabled={completingWithdrawal}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {completingWithdrawal ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Confirm Payment
                </button>
                <button
                  onClick={() => handleRejectWithdrawal(activeAutoWithdrawal._id, true)}
                  disabled={completingWithdrawal}
                  className="px-4 py-3 bg-rose-500 hover:bg-rose-600 shadow-lg text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  title="Cancel & Release"
                >
                  <AlertCircle className="w-5 h-5" />
                  Cancel & Release
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      <div className="w-full max-w-md lg:max-w-lg space-y-8 md:space-y-10">

        {/* ── Realistic & Compact Bank Card ── */}
        <div className="relative w-full aspect-[1.585/1] max-w-[360px] mx-auto rounded-3xl overflow-hidden shadow-2xl transform hover:scale-[1.015] transition-transform duration-400">
          {/* Background + subtle geometric overlay */}
          <div className={`absolute inset-0 bg-gradient-to-br ${
            isCardActive 
              ? "from-emerald-700 via-teal-600 to-emerald-800" 
              : "from-rose-700 via-red-600 to-rose-800"
          }`}>
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_15%_25%,rgba(255,255,255,0.14)_0%,transparent_45%),radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.10)_0%,transparent_55%)]" />
          </div>

          {/* Glossy shine */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/12 to-transparent opacity-70 pointer-events-none" />

          <div className="relative h-full px-5 sm:px-7 pt-5 sm:pt-7 pb-6 sm:pb-8 text-white flex flex-col">
            {/* Header: Bank name + logo */}
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 flex items-center justify-center shadow-inner overflow-hidden">
                  {/* Replace with your actual logo import */}
                  {/* <img src={opayLogo} alt="Opay" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" /> */}
                  <span className={`text-xl font-bold ${isCardActive ? "text-emerald-800" : "text-rose-800"}`}>O</span>
                </div>
                <div>
                  <p className="text-sm sm:text-base font-semibold tracking-wide">Opay Digital Bank</p>
                  <p className="text-xs opacity-85 -mt-0.5">Agent Wallet</p>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl opacity-90">  <div className="w-10 h-8 sm:w-12 sm:h-9 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-400 rounded shadow-inner flex items-center justify-center">
                <div className="w-6 h-4.5 sm:w-7 sm:h-5 bg-gradient-to-br from-amber-100 to-amber-300 rounded shadow-sm" />
              </div></div>
            </div>

     

            {/* Name + Expiry – reduced sizes */}
            <div className="flex justify-between items-end mb-4 sm:mb-5 flex-1">
              <div>
                <p className="text-xs uppercase opacity-80 tracking-wider mb-0.5">Cardholder</p>
                <p className="text-base sm:text-lg font-medium tracking-wide">
                  {user?.name?.toUpperCase() || "AGENT NAME"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase opacity-80 tracking-wider mb-0.5">Valid Thru</p>
                <p className="text-base sm:text-lg font-mono">{validThru}</p>
              </div>
            </div>

            {/* Balance section – compact */}
            <div className="pt-3 sm:pt-4 border-t border-white/30">
              <p className="text-xs uppercase tracking-wider opacity-80 mb-0.5">Available Credit</p>
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold">BDT</span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight">{creditAmount}</span>
                </div>
                <button
                  onClick={handleRefreshCredit}
                  disabled={refreshingCredit}
                  className={`p-1.5 rounded-full transition-all ${
                    refreshingCredit ? "animate-spin" : "hover:bg-white/20"
                  }`}
                  title="Refresh Balance"
                >
                  <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
                </button>
              </div>
            </div>

            {/* Status badge – smaller & positioned tighter */}
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-white/25 backdrop-blur-lg rounded-full text-xs font-medium shadow-inner">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isCardActive ? "bg-emerald-300" : "bg-rose-300"}`} />
                {statusLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Credit Progress Bar - Visualizes range from 0 to Min (Red) to Current (Green) */}
        {user?.credit && user?.minimumCredit !== undefined && (
          <div className="bg-gradient-to-br from-slate-900/90 to-purple-900/90 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-2xl -mt-6 relative z-0 mx-4 sm:mx-8 transform transition-all hover:scale-[1.01]">
             
             {/* Header Section */}
             <div className="flex justify-between items-center mb-3">
               <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${user.credit > user.minimumCredit ? "bg-emerald-400 animate-pulse" : "bg-rose-500 animate-ping"}`} />
                 <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">Credit Health</span>
               </div>
               <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                 user.credit > user.minimumCredit 
                   ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                   : "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
               }`}>
                 {user.credit > user.minimumCredit ? "Great Condition" : "Critical Low"}
               </span>
             </div>
             
             {/* Main Bar Track Container */}
             <div className="relative h-4 bg-slate-800/80 rounded-full overflow-hidden w-full shadow-inner ring-1 ring-white/5">
               
               {/* Animated Gradient Bar */}
               <div 
                 className="absolute inset-y-0 left-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(52,211,153,0.4)]"
                 style={{
                   width: '100%', 
                   background: user.credit <= user.minimumCredit 
                     ? 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)' // Critical Red Gradient
                     : `linear-gradient(90deg, 
                         #f43f5e 0%, 
                         #fb7185 ${Math.min(95, (user.minimumCredit / user.credit) * 100)}%, 
                         #34d399 100%
                       )`
                 }}
               />

               {/* Minimum Credit Marker Line */}
               {user.credit > user.minimumCredit && (
                 <div 
                   className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_rgba(255,255,255,1)]"
                   style={{ left: `${(user.minimumCredit / user.credit) * 100}%` }}
                 >
                   <div className="absolute -top-1 -left-[3px] w-2 h-2 bg-white rounded-full shadow-sm" />
                   <div className="absolute -bottom-1 -left-[3px] w-2 h-2 bg-white rounded-full shadow-sm" />
                 </div>
               )}

               {/* Glossy Overlay */}
               <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
             </div>

             {/* Labels / Metrics */}
             <div className="relative h-6 mt-2 text-[10px] sm:text-xs font-semibold text-slate-400 flex items-center">
               {/* 0 Label */}
               <span className="absolute left-0 text-slate-500">BDT 0</span>
               
               {/* Min Credit Label - Floating Badge */}
               <div 
                  className="absolute transform -translate-x-1/2 transition-all duration-1000 z-10 hidden sm:flex flex-col items-center group"
                  style={{ 
                    left: user.credit <= user.minimumCredit ? '100%' : `${(user.minimumCredit / user.credit) * 100}%`,
                    opacity: user.credit <= user.minimumCredit ? 0 : 1 
                  }}
               >
                 <span className="text-rose-300 group-hover:text-rose-200 transition-colors">Min</span>
                 <span className="text-white px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-[9px] backdrop-blur-sm -mt-0.5">
                   {user.minimumCredit}
                 </span>
                 {/* Little arrow pointing up */}
                 <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-rose-400 -mt-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-0" /> 
               </div>
               
               {/* Mobile-only visible min label if space permits, simplified */}
               {user.credit > user.minimumCredit && (
                  <span 
                    className="absolute transform -translate-x-1/2 text-rose-300 sm:hidden text-[9px]"
                    style={{ left: `${(user.minimumCredit / user.credit) * 100}%` }}
                  >
                    {user.minimumCredit}
                  </span>
               )}

               {/* Critical State Min Label (Fixed Right) */}
               { user.credit <= user.minimumCredit && (
                 <span className="absolute right-12 text-rose-400 animate-pulse">Min: {user.minimumCredit}</span> 
               )}
              <div className="absolute right-0 text-emerald-300 font-bold text-sm drop-shadow-sm">
                 {user.credit}
               </div>
             </div>
          </div>
        )}

        {/* --- Auto Withdrawal Total Earnings & Stats Cards --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {/* Auto Withdrawal Commission Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/90 via-teal-900/90 to-slate-950/90 border border-emerald-500/30 p-5 shadow-2xl backdrop-blur-xl group hover:border-emerald-400/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shadow-inner">
                  <TrendingUp className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Auto Withdrawal Commission</h4>
                  <p className="text-[10px] text-slate-400">কমিশন ও বোনাস একাউন্ট</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                {user?.autoWithdrawalCommissionRate || 0}% Rate
              </span>
            </div>

            <div className="relative z-10 flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-md">
                ৳{formatAmount((user?.autoWithdrawalCommission || 0) + (user?.autoWithdrawalBonus || 0) || totalAgentEarnings)}
              </span>
              <span className="text-xs text-emerald-400 font-bold uppercase">BDT</span>
            </div>
            
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
              <span>কমপ্লিট উইথড্রয়াল: <strong className="text-white font-bold">{completedWithdrawalCount} টি</strong></span>
              <span className="text-emerald-400 font-medium">কমিশন + বোনাস</span>
            </div>
          </div>

          {/* Total Volume Processed */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-950/90 to-purple-950/90 border border-indigo-500/30 p-5 shadow-2xl backdrop-blur-xl group hover:border-indigo-400/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shadow-inner">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">মোট ক্যাশ-আউট ভলিউম</h4>
                  <p className="text-[10px] text-slate-400">Total Processed Volume</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-md">
                ৳{totalAgentVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-indigo-300 font-bold uppercase">BDT</span>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
              <span>ক্রেডিটে যুক্ত হয়েছে</span>
              <span className="text-indigo-300 font-medium">১০০% ভেরিফাইড</span>
            </div>
          </div>
        </div>

        {/* Quick Services - Dynamic Payment Methods + Specific Actions */}
        <div className="bg-white/75 backdrop-blur-lg rounded-3xl shadow-xl p-5 sm:p-6 md:p-8 border border-emerald-100/70">
          <h3 className="text-lg sm:text-xl font-semibold text-emerald-900 mb-5 sm:mb-6">My Linked Numbers</h3>
          
          {loading ? (
             <div className="text-center py-4 text-emerald-600 animate-pulse">Loading services...</div>
          ) : (stats?.paymentMethods && stats.paymentMethods.length > 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 text-center">
              {stats.paymentMethods
               .sort((a, b) => {
                  // Sort by Provider, then SIM Index
                  const pDiff = a.provider.localeCompare(b.provider);
                  if (pDiff !== 0) return pDiff;
                  return (a.simIndex || 0) - (b.simIndex || 0);
               })
               .map((method, idx) => {
                // Find associated page content for image
                const pageContent = stats.methodPages?.find(p => p.paymentMethod === method._id || p.paymentMethod?._id === method._id);
                const methodImage = pageContent?.image;

                // Determine styling based on provider
                let bgColor = "bg-gray-100";
                let borderColor = "border-gray-200";
                let textColor = "text-gray-800";
                let icon = "💳";
                let gradient = "from-gray-50 to-gray-100";
                
                switch(method.provider?.toLowerCase()) {
                  case 'bkash':
                    bgColor = "bg-pink-50";
                    borderColor = "border-pink-200";
                    textColor = "text-pink-700";
                    gradient = "from-pink-50 to-pink-100/50";
                    icon = "b";
                    break;
                  case 'nagad':
                    bgColor = "bg-orange-50";
                    borderColor = "border-orange-200";
                    textColor = "text-orange-700";
                    gradient = "from-orange-50 to-orange-100/50";
                    icon = "N";
                    break;
                  case 'rocket':
                    bgColor = "bg-purple-50";
                    borderColor = "border-purple-200";
                    textColor = "text-purple-700";
                    gradient = "from-purple-50 to-purple-100/50";
                    icon = "🚀";
                    break;
                  case 'upay':
                    bgColor = "bg-blue-50";
                    borderColor = "border-blue-200";
                    textColor = "text-blue-700";
                    gradient = "from-blue-50 to-blue-100/50";
                    icon = "U";
                    break;
                }

                return (
                  <div
                    key={method._id || idx}
                    className={`relative flex flex-col items-center justify-between p-3 rounded-2xl border ${borderColor} bg-gradient-to-br ${gradient} shadow-sm hover:shadow-md transition-all group overflow-hidden`}
                  >
                    {/* Status Indicator - Clickable for Toggle */}
                    <button 
                      onClick={() => {
                        // Prevent activation if credit is too low
                        if (method.status !== 'active' && user?.role === 'wallet_agent') {
                           const credit = Number(user.credit) || 0;
                           const minCredit = Number(user.minimumCredit) || 0;
                           if (credit <= minCredit) {
                             alert(`Insufficient credit! You need more than ৳${minCredit} to activate service.`);
                             return;
                           }
                        }
                        
                        setToggleModal({ 
                        id: method._id, 
                        currentStatus: method.status, 
                        provider: method.provider, 
                        number: method.accountNumber 
                      })}}
                      className={`absolute top-2 right-2 flex items-center gap-1 bg-white/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full border ${borderColor} cursor-pointer hover:bg-white transition-colors z-10`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${method.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        {method.status === 'active' ? 'On' : 'Off'}
                      </span>
                    </button>

                    {/* Provider Logo/Name */}
                    <div className="flex items-center gap-2 mb-2 w-full justify-start">
                       <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden bg-white ${textColor}`}>
                        {methodImage ? (
                          <img 
                            src={methodImage.startsWith('http') ? methodImage : `${import.meta.env.VITE_API_URL}${methodImage}`} 
                            alt={method.provider} 
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerText = icon; }}
                          />
                        ) : (
                          <span className="text-lg font-black">{icon}</span>
                        )}
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-wide opacity-80 ${textColor}`}>
                        {method.provider}
                      </span>
                    </div>
                    
                    {/* Phone Number - Main Focus */}
                    <div className="w-full bg-white/60 backdrop-blur-sm rounded-xl py-2 px-1 mb-2 border border-white/50 shadow-inner group-hover:scale-105 transition-transform origin-center">
                       <p className={`text-sm sm:text-base font-mono font-bold text-center tracking-tight ${textColor}`}>
                         {method.accountNumber}
                       </p>
                    </div>

                    {/* Footer Info */}
                    <div className="flex justify-between items-center w-full px-1">
                      <span className="text-[9px] font-medium text-slate-400 capitalize bg-white/50 px-1.5 py-0.5 rounded">
                        {method.gateway === 'merchant' ? 'Agent' : method.gateway}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        Index: {method.simIndex || 1}
                      </span>
                    </div>
                  </div>
                );
              })}

              
              {/* Add New Button - Styled to match */}
              <Link to="/dashboard/add-payment-method" className="flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 transition-all group min-h-[120px]">
                 <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300 group-hover:text-emerald-500 group-hover:scale-110 transition-all mb-2">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                   </svg>
                 </div>
                 <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-600">Add Method</span>
              </Link>
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
               <p className="text-slate-500 mb-4">No active payment methods found.</p>
               <Link to="/dashboard/add-payment-method" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
                 Add Payment Method
               </Link>
            </div>
          )}
        </div>

        {/* Topup Credit Button for Wallet Agents */}
        {user?.role === "wallet_agent" && (
           <Link to="/dashboard/credit-topup" className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-between group hover:brightness-110 transition-all">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                 </div>
                 <div className="text-left">
                    <h3 className="font-bold text-lg">Topup Credit Limit</h3>
                    <p className="text-indigo-100 text-sm">Increase your daily transaction capacity</p>
                 </div>
              </div>
              <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors">
                 <ArrowUpRight className="w-6 h-6" />
              </div>
           </Link>
        )}
        
        {/* Navigation to Payment Transactions */}
        <Link to="/dashboard/payment-messages" className="bg-white/75 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-emerald-100/70 flex items-center justify-between group hover:bg-emerald-50 transition-colors">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
               <DollarSign className="w-6 h-6" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-800">My Payment Transactions</h3>
               <p className="text-sm text-gray-500">View all device transaction history</p>
             </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-emerald-600 group-hover:translate-x-1 transition-transform">
             <ArrowUpRight className="w-5 h-5" />
          </div>
        </Link>

        {/* Dashboard Shortcuts from sidebar */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl p-5 sm:p-6 md:p-8 border border-emerald-100/70">
          <h3 className="text-lg sm:text-xl font-semibold text-emerald-900 mb-4 sm:mb-5">Dashboard Menu</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {shortcutItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-start gap-2 px-3 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-100 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium leading-snug">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

      {/* Toggle Confirmation Modal */}
      {toggleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setToggleModal(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" />
             
             <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  toggleModal.currentStatus === 'active' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                }`}>
                   {toggleModal.currentStatus === 'active' ? (
                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                     </svg>
                   ) : (
                     <CheckCircle className="w-8 h-8" />
                   )}
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {toggleModal.currentStatus === 'active' ? 'Turn Off Service?' : 'Turn On Service?'}
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to {toggleModal.currentStatus === 'active' ? 'disable' : 'enable'} 
                  <span className="font-bold text-gray-800 mx-1">{toggleModal.provider}</span> 
                  number
                  <span className="block font-mono text-xs font-bold mt-1 text-gray-600">{toggleModal.number}</span>
                </p>
             </div>

             <div className="flex gap-3">
               <button 
                 onClick={() => setToggleModal(null)}
                 className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleToggleStatus}
                 className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold shadow-lg transition-transform active:scale-95 ${
                    toggleModal.currentStatus === 'active' 
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                 }`}
               >
                 Confirm {toggleModal.currentStatus === 'active' ? 'Off' : 'On'}
               </button>
             </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}





  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6 overflow-hidden relative">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-10 left-20 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-40 right-10 w-80 h-80 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <SubscriptionAlert />
        {/* Header */}
        <div className="text-center mb-12 mt-8">
          <h1 className="text-6xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent animate-pulse-slow">
            Dashboard Overview
          </h1>
          <p className="text-purple-300 text-lg mt-4 flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5 animate-twinkle" />
            Real-time payment intelligence at your fingertips
            <Sparkles className="w-5 h-5 animate-twinkle" />
          </p>
        </div>



        {/* Loading State */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 rounded-3xl bg-rose-500/20 border border-rose-500/50 backdrop-blur-xl text-rose-300 text-center font-medium">
            {error}
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && stats && (
          <>
            {/* Stats Cards - Premium Glassmorphism */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mb-10">
              {[
                { label: "Total Transactions", value: stats.totals.totalTransactions, icon: Activity, color: "from-purple-500 to-pink-500" },
                { label: "Total Volume", value: `৳${formatAmount(stats.totals.totalAmount)}`, icon: DollarSign, color: "from-emerald-500 to-teal-500" },
                { label: "Today's Transactions", value: stats.today.totalTransactions, icon: ArrowUpRight, color: "from-orange-500 to-pink-500" },
                { label: "Today's Volume", value: `৳${formatAmount(stats.today.totalAmount)}`, icon: Globe, color: "from-cyan-500 to-blue-500" },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl hover:shadow-purple-500/30 transform hover:scale-105 transition-all duration-500 group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-20 group-hover:opacity-40 transition-opacity`} />
                  <div className="relative p-8">
                    <div className="flex items-center justify-between mb-4">
                      <stat.icon className="w-10 h-10 text-white/80" />
                      <Sparkles className="w-6 h-6 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm text-purple-300 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-4xl font-bold mt-3 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Grid */}
            <div className="grid gap-8 lg:grid-cols-3 mb-10">
              {/* Left Column: Linked Numbers & Recent Transactions */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* My Linked Numbers (SIM Gateways) */}
                <div className="rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-pink-400" /> My Linked Numbers
                      </h3>
                      <p className="text-purple-300 text-xs mt-0.5">Manage active SIM numbers & gateways</p>
                    </div>
                    <Link to="/dashboard/add-payment-method" className="px-3 py-1.5 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold hover:bg-pink-500/30 transition-all flex items-center gap-1">
                      + Add Method
                    </Link>
                  </div>

                  {stats?.paymentMethods && stats.paymentMethods.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {stats.paymentMethods.map((method, idx) => (
                        <div key={method._id || idx} className="p-4 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white uppercase text-xs tracking-wider">{method.provider}</span>
                              <span className={`w-2 h-2 rounded-full ${method.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                            </div>
                            <p className="text-sm font-mono font-bold text-cyan-300 mt-1">{method.accountNumber}</p>
                            <p className="text-[10px] text-purple-300 mt-0.5 uppercase">{method.gateway || 'personal'} • SIM {method.simIndex || 1}</p>
                          </div>
                          
                          <button
                            onClick={() => setToggleModal({ 
                              id: method._id, 
                              currentStatus: method.status, 
                              provider: method.provider, 
                              number: method.accountNumber 
                            })}
                            className={`text-[10px] px-3 py-1.5 rounded-xl font-bold uppercase transition-all ${
                              method.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                            }`}
                          >
                            {method.status === 'active' ? 'Active' : 'Disabled'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-purple-300 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-sm mb-2">No linked numbers found</p>
                      <Link to="/dashboard/add-payment-method" className="text-xs text-pink-400 font-bold hover:underline">Add your first bKash/Nagad number</Link>
                    </div>
                  )}
                </div>

                {/* Recent Transactions */}
                <div className="rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl overflow-hidden">
                  <div className="p-6 sm:p-8 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Recent Transactions
                      </h3>
                      <p className="text-purple-300 text-sm mt-1">Latest incoming verified payments</p>
                    </div>
                    <Link to="/dashboard/payment-messages" className="text-xs text-purple-300 hover:text-white font-bold flex items-center gap-1">
                      View All <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    {stats.recent.length === 0 ? (
                      <div className="p-12 text-center text-purple-300">
                        <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>No transactions yet. Waiting for first payment...</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-purple-300 border-b border-white/10">
                            <th className="pb-4 pl-8">TrxID</th>
                            <th className="pb-4">Amount</th>
                            <th className="pb-4">Provider</th>
                            <th className="pb-4">Device</th>
                            <th className="pb-4">Time</th>
                            <th className="pb-4 pr-8">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recent.map((item, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                              <td className="py-5 pl-8 font-mono text-sm">{item.trxID}</td>
                              <td className="py-5 font-bold text-emerald-400">৳{formatAmount(item.amount)}</td>
                              <td className="py-5 text-purple-300">{item.title || "Unknown"}</td>
                              <td className="py-5 text-cyan-300">{item.deviceName || "—"}</td>
                              <td className="py-5 text-sm text-purple-200">{formatDate(item.createdAt)}</td>
                              <td className="py-5 pr-8">
                                {item.verify ? (
                                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                                    <CheckCircle className="w-4 h-4" /> Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                                    <AlertCircle className="w-4 h-4" /> Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Active Devices & Quick Navigation */}
              <div className="space-y-6">
                {/* Active Devices */}
                <div className="rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-7 h-7 text-cyan-400" />
                      <div>
                        <h3 className="text-xl font-bold text-white">Active Devices</h3>
                        <p className="text-xs text-purple-300">{stats.devices.length} linked devices</p>
                      </div>
                    </div>
                    <Link to="/dashboard/device" className="text-xs font-bold text-cyan-300 hover:underline">
                      Manage
                    </Link>
                  </div>

                  {stats.devices.length === 0 ? (
                    <div className="text-center py-6 text-purple-300 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-sm mb-3">No devices connected</p>
                      <Link to="/dashboard/device" className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-all inline-block">
                        + Add Device
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.devices.map((d) => (
                        <div key={d.deviceId} className="p-4 rounded-2xl bg-black/30 border border-white/10 hover:border-cyan-500/40 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-purple-100 text-sm">{d.deviceName}</p>
                                <span className={`w-2 h-2 rounded-full ${d.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                              </div>
                              <p className="text-xs text-purple-400 font-mono mt-0.5">{d.deviceCode || d.deviceId}</p>
                              <span className={`inline-block mt-1.5 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${d.online ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                                {d.online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-400 text-sm">৳{formatAmount(d.totalAmount)}</p>
                              <p className="text-xs text-purple-300">{d.totalTransactions} trx</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Navigation Menu */}
                <div className="rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl p-6 sm:p-8">
                  <h3 className="text-xl font-bold text-white mb-4">Quick Navigation</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { to: "/dashboard/profile", label: "Profile", icon: User },
                      { to: "/dashboard/device", label: "Devices", icon: Smartphone },
                      { to: "/dashboard/devices-presence", label: "Presence", icon: Wifi },
                      { to: "/dashboard/add-payment-method", label: "Add Number", icon: CreditCard },
                      { to: "/dashboard/number-status", label: "Number Status", icon: PhoneCall },
                      { to: "/dashboard/payment-messages", label: "History", icon: History },
                      { to: "/dashboard/subscription", label: "Subscription", icon: Zap },
                      { to: "/dashboard/your-plan", label: "Your Plan", icon: ClipboardList },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/15 text-purple-200 transition-all text-xs font-bold"
                        >
                          <Icon className="w-4 h-4 text-cyan-400" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Providers Breakdown */}
                {stats.providers && stats.providers.length > 0 && (
                  <div className="rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl p-6 sm:p-8">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-white">
                      <Globe className="w-6 h-6 text-pink-400" /> Top Providers
                    </h3>
                    <div className="space-y-3">
                      {stats.providers.slice(0, 4).map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-black/20 border border-white/5">
                          <span className="text-purple-200 font-bold uppercase text-xs">{p.provider}</span>
                          <div className="text-right">
                            <p className="font-bold text-cyan-300 text-sm">৳{formatAmount(p.totalAmount)}</p>
                            <p className="text-[10px] text-purple-300">{p.totalTransactions} trx</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

                 



      {/* Custom Animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(30px, -30px) scale(1.1); }
        }
        .animate-blob { animation: blob 20s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-twinkle { animation: twinkle 2s infinite alternate; }
        @keyframes twinkle { from { opacity: 0.5; } to { opacity: 1; } }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}