import React, { useEffect, useState } from 'react'
import { Wrench, Sliders, Shield, Database, Cloud } from 'lucide-react'

export default function Settings(){
  const [active, setActive] = useState('general')

  const tabs = [
     { id: 'general', label: 'General', icon: Sliders },
     { id: 'security', label: 'Security', icon: Shield },
     { id: 'database', label: 'Database', icon: Database },
     { id: 'cloud', label: 'Cloud Resources', icon: Cloud },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-slate-800/50 via-gray-800/50 to-transparent p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Wrench className="w-8 h-8 text-slate-400" />
             <span className="bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">
               System Settings
             </span>
          </h2>
          <p className="text-base text-slate-400 mt-2 max-w-xl">
             Configure global platform parameters, security policies, and resource connections.
          </p>
        </div>
      </div>

       {/* Tabs */}
       <div className="flex flex-wrap items-center gap-2 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-6 py-2.5 rounded-xl flex items-center gap-2.5 font-bold text-sm transition-all duration-300 ${
              active === tab.id 
              ? 'bg-slate-700 text-white shadow-lg shadow-black/40' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
         <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse">
            <Wrench className="w-10 h-10 text-slate-600" />
         </div>
         <h3 className="text-xl font-bold text-white mb-2">Settings Module Coming Soon</h3>
         <p className="text-slate-500 max-w-md mx-auto">
            We are currently building advanced configuration tools for system administrators. Check back later for updates.
         </p>
      </div>
    </div>
  )
}
