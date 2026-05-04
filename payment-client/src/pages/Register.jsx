import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function Register() {
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }
    if (password.length < 6) {
      return setError("Password must be at least 6 characters");
    }
    
    setLoading(true);
    try {
      await api.sendOtp({ phone });
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.verifyOtpAndRegister({ name, email, phone, password, otp });
      setToken(data.token);
      if (data.user) setUser(data.user);
      nav("/dashboard/device");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animation-delay-2000 animate-blob"></div>
        <div className="absolute -bottom-32 left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animation-delay-4000 animate-blob"></div>
      </div>

      <div className="relative w-full max-w-lg z-10 my-10">
        {/* Glassmorphic Register Card */}
        <div className="backdrop-blur-xl bg-white/10 shadow-2xl rounded-3xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-purple-300 mb-1">Registration</h2>
            <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-3 tracking-tight">
              WALLET AGENT
            </h1>
            <p className="text-white/80 text-base">
              {step === 1 ? "Create your agent account and start earning" : "Verify your phone number"}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-white text-sm rounded-xl px-5 py-3 mb-6 backdrop-blur-sm animate-pulse text-center">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-white/90 text-sm font-semibold mb-2">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  required
                  className="w-full px-5 py-3 bg-white/5 border border-white/20 rounded-xl placeholder-white/30 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all backdrop-blur-md"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-white/90 text-sm font-semibold mb-2">Email Address</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full px-5 py-3 bg-white/5 border border-white/20 rounded-xl placeholder-white/30 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all backdrop-blur-md"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-white/90 text-sm font-semibold mb-2">Phone Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  required
                  className="w-full px-5 py-3 bg-white/5 border border-white/20 rounded-xl placeholder-white/30 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all backdrop-blur-md"
                  placeholder="88017XXXXXXXX"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/90 text-sm font-semibold mb-2">Password</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    required
                    minLength="6"
                    className="w-full px-5 py-3 bg-white/5 border border-white/20 rounded-xl placeholder-white/30 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all backdrop-blur-md"
                    placeholder="Min 6 chars"
                  />
                </div>
                <div>
                  <label className="block text-white/90 text-sm font-semibold mb-2">Confirm Password</label>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    required
                    minLength="6"
                    className="w-full px-5 py-3 bg-white/5 border border-white/20 rounded-xl placeholder-white/30 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all backdrop-blur-md"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-600 hover:to-purple-600 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? "Sending OTP..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center text-white/80 text-sm mb-4">
                We've sent a 6-digit OTP to <span className="font-bold text-white">{phone}</span>
              </div>
              
              <div>
                <label className="block text-white/90 text-sm font-semibold mb-2 text-center">Enter OTP</label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  type="text"
                  required
                  maxLength="6"
                  className="w-full text-center tracking-[0.5em] text-2xl px-5 py-4 bg-white/5 border border-white/20 rounded-xl placeholder-white/30 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all backdrop-blur-md"
                  placeholder="------"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-orange-500 hover:to-yellow-500 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? "Verifying..." : "Verify & Register"}
              </button>
              
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 mt-2 text-white/60 hover:text-white text-sm transition-colors"
              >
                Back to Registration
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-white/80 text-sm">
              Already have an agent account?{" "}
              <a href="/login" className="text-yellow-400 font-bold hover:underline underline-offset-4">
                Log in here
              </a>
            </p>
          </div>
        </div>
      </div>

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