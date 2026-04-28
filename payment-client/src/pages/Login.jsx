import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";
import logo from "../assets/appstore.png";

export default function Login() {
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const token = useAuthStore((s) => s.token);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  // If already logged in and no specific "from" route, go to dashboard
  React.useEffect(() => {
    if (token && !location.state?.from) {
      nav("/dashboard", { replace: true });
    }
  }, [token, location.state, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      setToken(data.token);
      if (data.user) setUser(data.user);
      nav(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Mobile app style card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl px-6 py-7">
          <div className="mb-6 flex flex-col items-center text-center gap-1">
            <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden">
              <img src={logo} alt="Oracle Pay" className="h-10 w-10 object-contain" />
            </div>
            <h1 className="mt-2 text-xl font-semibold text-slate-50 tracking-tight">
              Sign in to Oracle Pay
            </h1>
            <p className="text-xs text-slate-400">Enter your email and password to continue</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400 text-white text-sm rounded-xl px-4 py-3 mb-6 backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-slate-200 text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl placeholder-slate-500 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 transition-all duration-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-slate-200 text-sm font-medium mb-2">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl placeholder-slate-500 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-base rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Logging in...
                </span>
              ) : (
                "Login Now"
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}