import React from 'react';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function Settings() {
    const { user } = useAuthStore();

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                    <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-2xl">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                            <Mail className="w-4 h-4" />
                            {user.email}
                        </div>
                    </div>
                    <div className="ml-auto">
                        <StatusBadge status={user.kycStatus} enabled={user.enabled} />
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Business Domain</label>
                        <div className="font-mono text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
                            {user.domain}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account ID</label>
                        <div className="font-mono text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
                            {user.id}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">API Token</label>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600 break-all">
                            {user.apiToken}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Keep this token secret. Do not share it with anyone.
                        </p>
                    </div>
                </div>
            </div>

            {/* KYC Status Details */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-violet-600" />
                    Verification Status
                </h3>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-start gap-4">
                        <div className="mt-1">
                            <StatusIcon status={user.kycStatus} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 capitalize">
                                KYC {user.kycStatus?.replace('_', ' ')}
                            </h4>
                            <p className="text-sm text-slate-600 mt-1">
                                {user.kycStatus === 'approved' && "Your account is fully verified. You have access to all merchant features."}
                                {user.kycStatus === 'pending' && "Your documents are currently under review. We will notify you once the process is complete."}
                                {(user.kycStatus === 'not_submitted' || !user.kycStatus) && "You have not submitted your KYC documents yet. Please complete verification to unlock all features."}
                                {user.kycStatus === 'rejected' && "Your previous application was rejected. Please review our guidelines and try again."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status, enabled }) {
    if (!enabled && status !== 'approved') {
        return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide">Inactive</span>
    }

    switch (status) {
        case 'approved':
            return <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wide">Verified</span>
        case 'pending':
            return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wide">Pending</span>
        case 'rejected':
            return <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wide">Rejected</span>
        default:
            return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide">Unverified</span>
    }
}

function StatusIcon({ status }) {
    switch (status) {
        case 'approved': return <CheckCircle className="w-6 h-6 text-emerald-500" />
        case 'pending': return <Clock className="w-6 h-6 text-amber-500" />
        case 'rejected': return <AlertCircle className="w-6 h-6 text-rose-500" />
        default: return <User className="w-6 h-6 text-slate-400" />
    }
}
