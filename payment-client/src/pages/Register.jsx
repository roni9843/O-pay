import React from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function Register() {
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.register({ name, email, password });
      setToken(data.token);
      if (data.user) setUser(data.user);
      nav("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob"></div>
        <div className="absolute top-40 right-0 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animation-delay-2000 animate-blob"></div>
        <div className="absolute -bottom-32 left-40 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-4000 animate-blob"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Glassmorphic Register Card */}
        <div className="backdrop-blur-2xl bg-white/10 shadow-2xl rounded-3xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
              Join Us Today!
            </h1>
            <p className="text-white/80 text-base">
              Create your account and start your adventure
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-white text-sm rounded-xl px-5 py-3 mb-6 backdrop-blur-sm animate-pulse">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-white/90 text-sm font-semibold mb-2">
                Full Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                required
                className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-xl placeholder-white/50 text-white text-base focus:outline-none focus:ring-4 focus:ring-purple-400/60 focus:border-purple-400 transition-all duration-300 backdrop-blur-md"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-white/90 text-sm font-semibold mb-2">
                Email Address
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-xl placeholder-white/50 text-white text-base focus:outline-none focus:ring-4 focus:ring-purple-400/60 focus:border-purple-400 transition-all duration-300 backdrop-blur-md"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-white/90 text-sm font-semibold mb-2">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength="6"
                className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-xl placeholder-white/50 text-white text-base focus:outline-none focus:ring-4 focus:ring-purple-400/60 focus:border-purple-400 transition-all duration-300 backdrop-blur-md"
                placeholder="Minimum 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-pink-600 hover:to-purple-600 text-white font-bold text-lg rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
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
                  Creating Account...
                </>
              ) : (
                "Register Now"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-white/80 text-sm">
              Already have an account?{" "}
              <a href="/login" className="text-white font-bold hover:underline underline-offset-4">
                Log in here
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-10">
          © 2025 YourApp • Built with passion & coffee
        </p>
      </div>

      {/* Custom Animation Keyframes */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(50px, -80px) scale(1.15); }
          66% { transform: translate(-40px, 60px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 25s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}