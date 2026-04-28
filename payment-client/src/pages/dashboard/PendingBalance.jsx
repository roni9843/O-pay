import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { DollarSign, Clock, Image, AlertCircle, Sparkles } from 'lucide-react';

export default function PendingBalance() {
  const token = useAuthStore(s => s.token);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://api.oraclepay.org'}/api/balance-topups/mine?status=pending&page=1&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load');
      setItems(data.data || []);
    } catch (e) {
      setError(e.message || 'Failed to load pending balance requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <div className="text-center mb-12 mt-10">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 p-1 shadow-2xl mb-6 animate-pulse">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <Clock className="w-16 h-16 text-amber-400" />
            </div>
          </div>
          <h1 className="text-6xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
            Pending Balance
          </h1>
          <p className="text-amber-300 text-xl mt-3">Your top-up requests awaiting approval</p>
          <div className="flex justify-center gap-3 mt-5">
            <Sparkles className="w-6 h-6 text-amber-400 animate-twinkle" />
            <span className="text-purple-300">
              Total pending: <strong>{items.length}</strong> request{items.length !== 1 && 's'}
            </span>
            <Sparkles className="w-6 h-6 text-orange-400 animate-twinkle" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/50 backdrop-blur-xl text-rose-300 text-center font-medium shadow-2xl">
            <AlertCircle className="w-6 h-6 inline mr-2" />
            {error}
          </div>
        )}

        {/* Pending Requests Card */}
        <div className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-transparent to-orange-600/20 opacity-70" />
          
          <div className="relative p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-xl">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Pending Top-up Requests
                </h3>
                <p className="text-amber-300">These will be credited once approved by admin</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-amber-400"></div>
                <p className="mt-4 text-amber-300">Loading pending requests...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 text-amber-300 text-xl">
                <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No pending top-up requests</p>
                <p className="text-sm mt-2 text-purple-300">All your submissions have been processed!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/20 text-amber-300">
                      <th className="pb-4 px-2">Amount</th>
                      <th className="pb-4 px-2"><Image className="w-5 h-5 inline mr-2" />Screenshot</th>
                      <th className="pb-4 px-2"><Clock className="w-5 h-5 inline mr-2" />Submitted At</th>
                      <th className="pb-4 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr
                        key={it._id}
                        className="border-b border-white/10 hover:bg-white/5 transition-all duration-300"
                      >
                        <td className="py-6 px-2 text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                          ${Number(it.amount).toFixed(2)}
                        </td>
                        <td className="py-6 px-2">
                          {it.screenshotUrl ? (
                            <a
                              href={`${import.meta.env.VITE_API_URL || 'https://api.oraclepay.org'}${it.screenshotUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 hover:border-amber-400 transition-all hover:shadow-lg hover:shadow-amber-500/20"
                            >
                              <Image className="w-5 h-5" />
                              View Proof
                            </a>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-6 px-2 text-amber-200">
                          {new Date(it.createdAt).toLocaleString()}
                        </td>
                        <td className="py-6 px-2">
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-medium">
                            <Clock className="w-4 h-4" />
                            {it.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Blobs (same as Payment page) */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-20 left-20 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-80 h-80 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-40 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(50px, -50px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 25s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-twinkle { animation: twinkle 3s infinite; }
        @keyframes twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}