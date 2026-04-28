import React from "react";
import { useAuthStore } from "../../store/authStore";
import api from "../../lib/api";
import { User, Lock, Save, Sparkles } from "lucide-react";

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = React.useState(user?.name || "");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [changing, setChanging] = React.useState(false);

  React.useEffect(() => {
    setName(user?.name || "");
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    try {
      setSaving(true);
      const res = await api.updateProfile(token, { name });
      if (res?.user) setUser(res.user);
      setMsg("✨ Profile updated successfully!");
    } catch (e) {
      setErr(e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    if (!currentPassword || !newPassword) {
      setErr("Both passwords are required ⚠️");
      return;
    }
    try {
      setChanging(true);
      const res = await api.changePassword(token, { currentPassword, newPassword });
      setMsg("🔐 Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setErr(e?.message || "Failed to change password");
    } finally {
      setChanging(false);
    }
  };


  if (!user) return <p className="text-center text-gray-500">Loading profile...</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header with Glass Effect */}
        <div className="text-center mb-12 mt-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 p-1 shadow-2xl mb-6 animate-pulse">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-4xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
          <h1 className="text-5xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
            {user.name || "User"}
          </h1>
          <p className="text-purple-300 text-lg mt-2">{user.email}</p>
          <div className="flex justify-center gap-2 mt-4">
            <Sparkles className="w-5 h-5 text-purple-400 animate-twinkle" />
            <span className="text-sm text-purple-300">Manage your cosmic profile</span>
            <Sparkles className="w-5 h-5 text-pink-400 animate-twinkle" />
          </div>
        </div>

        {/* Success / Error Messages */}
        {msg && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 backdrop-blur-xl text-emerald-300 text-center font-medium shadow-2xl animate-bounce">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/50 backdrop-blur-xl text-rose-300 text-center font-medium shadow-2xl">
            {err}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Profile Edit Card - Glassmorphism */}
          <form onSubmit={saveProfile} className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl hover:shadow-purple-500/20 transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Basic Information
                  </h3>
                  <p className="text-purple-300">Update your display name</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm text-purple-300 font-medium">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/30 backdrop-blur-xl focus:border-purple-400 focus:ring-4 focus:ring-purple-500/30 transition-all text-white placeholder-purple-400"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="text-sm text-purple-300 font-medium">Email Address</label>
                  <input
                    value={user.email}
                    disabled
                    className="mt-2 w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/20 text-purple-200 cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full mt-8 py-5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <>Saving... <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/50 border-t-white"></div></>
                  ) : (
                    <>
                      <Save className="w-6 h-6" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Password Change Card */}
          <form onSubmit={changePwd} className="relative overflow-hidden rounded-3xl backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-transparent to-cyan-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-xl">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Security Center
                  </h3>
                  <p className="text-emerald-300">Keep your account protected</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm text-emerald-300 font-medium">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-2 w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/30 backdrop-blur-xl focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 transition-all text-white placeholder-emerald-400"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="text-sm text-emerald-300 font-medium">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-2 w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/30 backdrop-blur-xl focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 transition-all text-white placeholder-emerald-400"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={changing}
                  className="w-full mt-8 py-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-emerald-700 text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:shadow-emerald-500/50 transform hover:scale-105 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {changing ? (
                    <>Changing... <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/50 border-t-white"></div></>
                  ) : (
                    <>
                      <Lock className="w-6 h-6" /> Update Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>


        {/* Floating Particles Effect (Optional CSS needed) */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-32 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-32 left-40 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(40px, -40px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 20s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-twinkle {
          animation: twinkle 3s infinite;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}