import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { History, CheckCircle2, Timer, Smartphone } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PushHistory() {
    const token = useAuthStore(s => s.token);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadPushHistory = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/admin/push-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPushHistory();
    }, [token]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-transparent p-6 backdrop-blur-xl flex items-center justify-between shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px]" />
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <History className="w-6 h-6 text-indigo-400" />
                        <span className="bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                            Push Notification History
                        </span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Track delivery status of all sent notifications and alarms.
                    </p>
                </div>
                <button
                    onClick={loadPushHistory}
                    className="relative z-10 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">Loading history...</div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No push notifications found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-white/5 text-xs uppercase font-bold text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">Device</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Content</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Sent Time</th>
                                    <th className="px-6 py-4">Delivered Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                                                    <Smartphone className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white">
                                                        {log.device?.deviceName || log.device?.deviceUserName || 'Unknown'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono">
                                                        {log.device?.deviceCode}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${log.type === 'alarm' ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                {log.type === 'alarm' ? '🚨 Alarm' : '📩 Notification'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="font-semibold text-slate-200 truncate">{log.title}</div>
                                            <div className="text-xs text-slate-400 truncate mt-0.5">{log.message}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.status === 'delivered' ? (
                                                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold w-fit">
                                                    <CheckCircle2 className="w-4 h-4" /> Delivered
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold w-fit animate-pulse">
                                                    <Timer className="w-4 h-4" /> Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            {log.deliveredAt ? new Date(log.deliveredAt).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
