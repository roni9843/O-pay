import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getGlobalStatus, setGlobalStatus, setUserStatus, listUsersWithStatus, sendAlarm } from '../lib/api';
import {
   Radio, Zap, Globe, Users, Search, Send, RefreshCw, Loader2, X,
   ShieldCheck, Clock, Smartphone, ChevronRight, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminStatus() {
   const { token } = useAuthStore();
   const [loading, setLoading] = useState(false);
   const [usersLoading, setUsersLoading] = useState(false);

   const [globalStatus, setGlobalStatusState] = useState({
      title: '',
      subtitle: '',
      active: false
   });

   const [users, setUsers] = useState([]);
   const [search, setSearch] = useState('');
   const [selectedUser, setSelectedUser] = useState(null);

   const [userForm, setUserForm] = useState({
      title: '',
      subtitle: '',
      active: false
   });

   useEffect(() => {
      fetchData();
      const interval = setInterval(fetchUsers, 20000);
      return () => clearInterval(interval);
   }, []);

   const fetchData = async () => {
      try {
         const gRes = await getGlobalStatus(token);
         if (gRes.success) setGlobalStatusState(gRes.data);
         await fetchUsers();
      } catch (err) {
         toast.error('Failed to load data');
      }
   };

   const fetchUsers = async () => {
      setUsersLoading(true);
      try {
         const uRes = await listUsersWithStatus(token);
         if (uRes.success) setUsers(uRes.users);
      } catch (err) {
         console.error(err);
      } finally {
         setUsersLoading(false);
      }
   };

   const handleGlobalSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
         const res = await setGlobalStatus(token, globalStatus);
         if (res.success) {
            toast.success('Global Broadcast Updated Successfully');
         }
      } catch (err) {
         toast.error(err.message || 'Failed to update');
      } finally {
         setLoading(false);
      }
   };

   const handleUserSubmit = async (e) => {
      e.preventDefault();
      if (!selectedUser) return;
      setLoading(true);
      try {
         const res = await setUserStatus(token, {
            userId: selectedUser._id,
            ...userForm
         });
         if (res.success) {
            toast.success(`Status pushed to ${selectedUser.name}`);
            fetchUsers();
            setSelectedUser(null);
            setUserForm({ title: '', subtitle: '', active: false });
         }
      } catch (err) {
         toast.error(err.message || 'Failed to send');
      } finally {
         setLoading(false);
      }
   };

   const handleAlarm = async () => {
      if (!selectedUser) return;
      if (!userForm.subtitle.trim()) {
         toast.error("Please enter a message for the alarm");
         return;
      }
      
      setLoading(true);
      try {
         await sendAlarm(token, {
            userId: selectedUser._id,
            message: userForm.subtitle
         });
         toast.success("Emergency Alarm triggered on all user devices!");
      } catch (err) {
         toast.error(err.message);
      } finally {
         setLoading(false);
      }
   };

   const filteredUsers = users.filter(u =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search)
   );

   const onlineCount = users.filter(u => u.isOnline).length;

   return (
      <div className="min-h-screen  pb-12">
         {/* Header - OpayBusiness Style */}
         <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent p-8 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden mb-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 blur-[80px]" />

            <div className="relative z-10 flex items-center gap-4">
               <div className="p-3 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl">
                  <Radio className="w-8 h-8 text-white animate-pulse" />
               </div>
               <div>
                  <h1 className="text-3xl font-black tracking-tight text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                     Status Center
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">Live Broadcast & Device Management</p>
               </div>
            </div>

            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 bg-white/5 px-5 py-3 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-sm font-medium text-emerald-400">{onlineCount} Devices Online</span>
               </div>

               <button
                  onClick={fetchData}
                  disabled={usersLoading}
                  className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-medium transition-all active:scale-95"
               >
                  <RefreshCw size={18} className={usersLoading ? "animate-spin" : ""} />
                  Refresh
               </button>
            </div>
         </div>

         {/* Compact Main Content */}
         <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 pb-10">

            {/* Expanded Global Broadcast Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
               <form onSubmit={handleGlobalSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-fuchsia-500/10 rounded-lg">
                           <Zap size={20} className="text-fuchsia-500" />
                        </div>
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Global Broadcast System</h2>
                     </div>
                     <div className="flex items-center gap-3">
                        <button
                           type="button"
                           onClick={() => setGlobalStatusState({ ...globalStatus, active: !globalStatus.active })}
                           className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${
                              globalStatus.active 
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                              : 'bg-white/5 border-white/5 text-slate-500'
                           }`}
                        >
                           {globalStatus.active ? 'BROADCAST: ON' : 'BROADCAST: OFF'}
                        </button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-xl">
                           {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Push to All Devices'}
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Announcement Title</label>
                        <input
                           type="text"
                           value={globalStatus.title}
                           onChange={(e) => setGlobalStatusState({ ...globalStatus, title: e.target.value })}
                           placeholder="Enter headline for all users..."
                           className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-fuchsia-500/50 outline-none transition-all shadow-inner"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Message Body (Supports Multi-line)</label>
                        <textarea
                           value={globalStatus.subtitle}
                           onChange={(e) => setGlobalStatusState({ ...globalStatus, subtitle: e.target.value })}
                           rows={3}
                           placeholder="Enter detailed message lines...&#10;Each line will appear in rotation on user devices."
                           className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-300 focus:border-fuchsia-500/50 outline-none transition-all resize-none shadow-inner leading-relaxed"
                        />
                     </div>
                  </div>
               </form>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">

               {/* Left: Device List (Compact) */}
               <div className={`lg:w-1/3 flex flex-col bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden ${selectedUser ? 'hidden lg:flex' : 'flex'}`}>
                  <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Users size={16} className="text-violet-400" />
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Devices</h3>
                     </div>
                     <div className="relative w-32">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                        <input
                           type="text"
                           placeholder="Search..."
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                           className="w-full bg-black/40 border border-white/5 pl-8 pr-3 py-1.5 rounded-lg text-[10px] focus:border-violet-500 outline-none"
                        />
                     </div>
                  </div>

                  <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
                     {filteredUsers.length === 0 ? (
                        <div className="py-10 text-center opacity-30">
                           <p className="text-[10px] font-bold">No active users</p>
                        </div>
                     ) : (
                        filteredUsers.map(user => (
                           <div
                              key={user._id}
                              onClick={() => {
                                 setSelectedUser(user);
                                 setUserForm({
                                    title: user.statusTitle || '',
                                    subtitle: user.statusSubtitle || '',
                                    active: user.showStatus || false
                                 });
                              }}
                              className={`group p-4 cursor-pointer transition-all ${selectedUser?._id === user._id ? 'bg-violet-600/10' : 'hover:bg-white/[0.02]'
                                 }`}
                           >
                              <div className="flex items-center gap-3">
                                 <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-black ${user.isOnline ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-slate-600'}`}>
                                    {user.name?.[0] || '?'}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                       <p className={`text-xs font-bold truncate ${selectedUser?._id === user._id ? 'text-violet-400' : 'text-slate-200'}`}>
                                          {user.name}
                                       </p>
                                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${user.role === 'agent' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                          {user.role}
                                       </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                       <div className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                                       <span className="text-[9px] font-bold text-slate-500 uppercase">{user.isOnline ? 'Live' : 'Offline'}</span>
                                       <span className="text-[9px] text-slate-600 ml-auto flex items-center gap-1">
                                          <Smartphone size={8} /> {user.deviceCount || 0}
                                       </span>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>

               {/* Right: Target Controls (Compact) */}
               <div className={`lg:w-2/3 flex flex-col ${selectedUser ? 'flex' : 'hidden lg:flex'}`}>
                  {!selectedUser ? (
                     <div className="h-full min-h-[400px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-8 opacity-20">
                        <Smartphone size={32} />
                        <p className="text-xs font-bold uppercase tracking-widest mt-4">Select User to Push Status</p>
                     </div>
                  ) : (
                     <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-xl font-black text-violet-400">
                                 {selectedUser.name[0]}
                              </div>
                              <div>
                                 <h3 className="text-sm font-black text-white uppercase tracking-tight">{selectedUser.name}</h3>
                                 <p className="text-[10px] text-slate-500 font-mono">{selectedUser.phone}</p>
                              </div>
                           </div>
                           <button
                              onClick={() => setSelectedUser(null)}
                              className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all lg:hidden"
                           >
                              <ChevronRight size={20} className="rotate-180" />
                           </button>
                        </div>

                        {/* Ecosystem Badges */}
                        <div className="px-5 py-3 border-b border-white/5 flex flex-wrap gap-2">
                           {selectedUser.devices?.map((dev, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-1 rounded-lg">
                                 <div className={`w-1 h-1 rounded-full ${dev.isOnline ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                 <span className="text-[9px] font-mono font-bold text-slate-400">{dev.code}</span>
                              </div>
                           ))}
                        </div>

                        <form onSubmit={handleUserSubmit} className="p-6 space-y-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Title</label>
                                 <input
                                    type="text"
                                    value={userForm.title}
                                    onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
                                    className="w-full bg-black/40 border border-white/5 focus:border-violet-500/50 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none transition-all"
                                    placeholder="Push Header..."
                                 />
                              </div>
                              <div className="flex items-end">
                                 <div 
                                    onClick={() => setUserForm({ ...userForm, active: !userForm.active })}
                                    className={`w-full flex items-center justify-between border rounded-xl p-3 cursor-pointer transition-all ${
                                       userForm.active ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-black/40 border-white/5'
                                    }`}
                                 >
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${userForm.active ? 'text-emerald-500' : 'text-slate-500'}`}>
                                       {userForm.active ? 'STATUS: ON' : 'STATUS: OFF'}
                                    </span>
                                    <div className={`w-8 h-4 rounded-full relative ${userForm.active ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                                       <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${userForm.active ? 'left-4.5' : 'left-0.5'}`} />
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-2">
                              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Message Body</label>
                              <textarea
                                 value={userForm.subtitle}
                                 onChange={(e) => setUserForm({ ...userForm, subtitle: e.target.value })}
                                 rows={6}
                                 className="w-full bg-black/40 border border-white/5 focus:border-violet-500/50 rounded-xl px-4 py-4 text-xs leading-relaxed text-slate-300 outline-none transition-all resize-none"
                                 placeholder="Line 1&#10;Line 2..."
                              />
                           </div>

                           <div className="flex flex-col gap-4">
                              <div className="flex gap-4">
                                 <button
                                    type="button"
                                    onClick={() => setSelectedUser(null)}
                                    className="flex-1 py-3 border border-white/5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/5 transition-all"
                                 >
                                    Back
                                 </button>
                                 <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-violet-600/20"
                                 >
                                    {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Update Status'}
                                 </button>
                              </div>
                              <button
                                 type="button"
                                 onClick={handleAlarm}
                                 disabled={loading}
                                 className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl text-[11px] font-black text-white uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-red-600/20 flex items-center justify-center gap-3"
                              >
                                 <Bell size={16} className={loading ? "" : "animate-bounce"} />
                                 Trigger Device Alarm
                              </button>
                           </div>
                        </form>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}