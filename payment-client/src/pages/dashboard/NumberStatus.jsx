import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import api from "../../lib/api";
import { Phone, RefreshCw, CheckCircle2, XCircle, CreditCard } from "lucide-react";

export default function NumberStatus() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!token) return;
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.getMyPaymentMethods(token);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (!ignore) setItems(list);
      } catch (e) {
        if (!ignore) setError(e?.message || "Failed to load numbers");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [token]);

  const activeCount = items.filter((m) => m.status === "active").length;
  const inactiveCount = items.filter((m) => m.status !== "active").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 mt-8">
          <div>
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Number Status
              </h1>
            </div>
            <p className="text-sm text-emerald-200">
              View all linked payment numbers and their active / inactive status.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Active: {activeCount}</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-300" />
              <span>Inactive: {inactiveCount}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-400/40 text-rose-100 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-emerald-100">
              <div className="w-10 h-10 border-4 border-emerald-400/40 border-t-transparent rounded-full animate-spin mb-3" />
              Loading numbers...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-emerald-100">
              <Phone className="w-10 h-10 mb-3 opacity-60" />
              No numbers found. Add payment methods first.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center justify-between rounded-2xl bg-slate-900/60 border border-white/10 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white tracking-wide">{m.accountNumber}</div>
                      <div className="text-[11px] text-emerald-200">
                        {(m.provider || "").toUpperCase()} • SIM {m.simIndex} • {m.gateway || "personal"}
                      </div>
                      {m.device && (
                        <div className="text-[11px] text-emerald-300/80 mt-0.5">
                          Device: {m.device.deviceUserName || m.device.deviceName || m.device._id}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] px-3 py-1 rounded-full inline-flex items-center gap-1 font-medium capitalize ${
                        m.status === "active"
                          ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                          : "bg-rose-500/20 text-rose-100 border border-rose-400/40"
                      }`}
                    >
                      {m.status === "active" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {m.status || "inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
