import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, Settings, LogOut, Menu, X, FileText, ChevronDown, ChevronUp, Loader2, CreditCard, BookOpen, Clock, Wallet } from 'lucide-react';
import clsx from 'clsx';
import appStoreLogo from "../assets/appstore.png";
import KYCSummary from './KYCSummary';
import { api } from '../lib/api';

export default function DashboardLayout({ children }) {
    const { logout, user, token, fetchMe } = useAuthStore();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Refresh user data on mount to ensure status/domain is up to date
    useEffect(() => {
        if (token) {
            fetchMe();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, location.pathname]); // fetchMe intentionally excluded — it's not memoized in zustand/persist and would cause infinite re-renders

    // KYC Details State
    const [showKycDetails, setShowKycDetails] = useState(false);
    const [kycData, setKycData] = useState(null);
    const [loadingKyc, setLoadingKyc] = useState(false);

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'KYC Verification', href: '/kyc', icon: FileText },
        { label: 'Payment Test', href: '/payment-test', icon: CreditCard },
        { label: 'History', href: '/history', icon: Clock },
        { label: 'Withdrawal', href: '/withdrawal', icon: Wallet },
        { label: 'API Docs', href: '/api-docs', icon: BookOpen },
        { label: 'Settings', href: '/settings', icon: Settings },
    ];

    const handleLogout = () => {
        logout();
    };

    // Fetch KYC Data if pending and details requested
    useEffect(() => {
        if (showKycDetails && !kycData && user?.kycStatus === 'pending') {
            const fetchKyc = async () => {
                setLoadingKyc(true);
                try {
                    const res = await api.get('/opay-business/kyc/status');
                    if (res.data.data?.kycData) {
                        setKycData(res.data.data.kycData);
                    }
                } catch (err) {
                    console.error("Failed to load KYC details", err);
                } finally {
                    setLoadingKyc(false);
                }
            };
            fetchKyc();
        }
    }, [showKycDetails, user?.kycStatus, token, kycData]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    "fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-sm flex flex-col transition-transform duration-300 ease-in-out h-screen overflow-y-auto",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                <div className="p-6 flex items-center gap-3 border-b border-slate-100">
                    <img src={appStoreLogo} alt="Logo" className="w-8 h-8 object-contain" />
                    <div>
                        <span className="font-bold text-lg tracking-tight text-brand-primary block leading-none">Opay</span>
                        <span className="text-xs font-medium text-brand-accent tracking-wide uppercase">Business</span>
                    </div>
                    {/* Mobile Close Button */}
                    <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden ml-auto text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1.5">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={clsx(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium relative",
                                    isActive
                                        ? "bg-brand-primary/5 text-brand-primary shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-brand-primary"
                                )}
                            >
                                <Icon className={clsx("w-5 h-5 transition-colors", isActive ? "text-brand-primary" : "text-slate-400 group-hover:text-brand-primary")} />
                                <span className="flex-1">{item.label}</span>
                                {item.href === '/kyc' && (
                                    <span className={clsx(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                        (user?.kycStatus === 'approved') ? "bg-emerald-100 text-emerald-700" : // Keep status colors standard
                                            (user?.kycStatus === 'pending') ? "bg-amber-100 text-amber-700" :
                                                (user?.kycStatus === 'rejected') ? "bg-rose-100 text-rose-700" :
                                                    "bg-slate-100 text-slate-500"
                                    )}>
                                        {user?.kycStatus || 'New'}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="mb-4 px-4">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-bold text-brand-primary">{user?.name}</div>
                            <span className={clsx(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border",
                                user?.enabled
                                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                    : "bg-rose-100 text-rose-700 border-rose-200"
                            )}>
                                {user?.enabled ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-white hover:text-rose-600 hover:shadow-sm border border-transparent hover:border-slate-200 transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="lg:hidden p-4 border-b border-slate-200 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <img src={appStoreLogo} alt="Logo" className="w-8 h-8 object-contain" />
                        <span className="font-bold text-lg text-brand-primary">Opay Business</span>
                        <span className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ml-2",
                            user?.enabled
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-rose-100 text-rose-700 border-rose-200"
                        )}>
                            {user?.enabled ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-500 hover:text-brand-primary">
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 p-4 lg:p-8 bg-slate-50">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Account Status Banner */}
                        {(!user?.enabled || user?.kycStatus !== 'approved') && location.pathname !== '/kyc' && (
                            <div className={`rounded-xl border transition-all duration-300 ${user?.kycStatus === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="p-4 flex flex-col md:flex-row md:items-start gap-4">
                                    <div className={`p-3 rounded-xl flex-shrink-0 ${user?.kycStatus === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                        <FileText className="w-6 h-6" />
                                    </div>

                                    <div className="flex-1">
                                        <h3 className={`font-bold text-lg mb-1 ${user?.kycStatus === 'pending' ? 'text-amber-900' : 'text-slate-900'}`}>
                                            {user?.kycStatus === 'pending' ? 'Application Under Review' : 'Account Pending Approval'}
                                        </h3>
                                        <p className={`text-sm ${user?.kycStatus === 'pending' ? 'text-amber-700' : 'text-slate-600'}`}>
                                            {user?.kycStatus === 'pending'
                                                ? "Your KYC application has been submitted and is currently being reviewed by our administration team."
                                                : "Your account is currently inactive. Please complete the KYC verification process to unlock all features."
                                            }
                                        </p>

                                        {!user?.enabled && user?.kycStatus === 'not_submitted' && (
                                            <div className="mt-4">
                                                <Link to="/kyc" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-colors">
                                                    Start Verification
                                                </Link>
                                            </div>
                                        )}

                                        {user?.kycStatus === 'pending' && (
                                            <div className="mt-4">
                                                <button
                                                    onClick={() => setShowKycDetails(!showKycDetails)}
                                                    className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-900 transition-colors"
                                                >
                                                    {showKycDetails ? "Hide Application Details" : "View Application Details"}
                                                    {showKycDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Expandable Details Section */}
                                {showKycDetails && user?.kycStatus === 'pending' && (
                                    <div className="border-t border-amber-200/50 p-6 bg-white/50 animate-in slide-in-from-top-2 duration-200">
                                        {loadingKyc ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                                            </div>
                                        ) : kycData ? (
                                            <div className="max-w-4xl">
                                                <h4 className="text-sm font-bold text-amber-800 uppercase tracking-widest mb-6">Submitted Information</h4>
                                                <KYCSummary formData={kycData} />
                                                <div className="mt-6 flex justify-end">
                                                    <Link to="/kyc" className="text-sm font-bold text-violet-600 hover:text-violet-700 hover:underline">
                                                        Go to KYC Page to Edit or Cancel
                                                    </Link>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-amber-700">
                                                Failed to load details. <button onClick={() => window.location.reload()} className="underline font-bold">Retry</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
