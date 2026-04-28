import React, { useEffect } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminAuthStore';
import { LogOut, LayoutDashboard, Globe } from 'lucide-react';

export default function AdminLayout() {
  const token = useAdminAuthStore((s) => s.token);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#030014] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
       {/* Background Effects */}
       <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
       </div>

       {/* Navbar */}
       <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Globe className="w-5 h-5 text-white" />
             </div>
             <h1 className="font-bold text-lg bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                Site Control Center
             </h1>
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={() => { logout(); navigate('/admin/login'); }}
               className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 transition-all text-sm font-medium"
             >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
             </button>
          </div>
       </header>

       {/* Content */}
       <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-12 relative z-10 max-w-7xl mx-auto">
          <Outlet />
       </main>
    </div>
  );
}
