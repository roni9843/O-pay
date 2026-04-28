import React from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../lib/api";
import logo from "../assets/appstore.png";
import {
  LayoutDashboard,
  User,
  AppWindow,
  CreditCard,
  Zap,
  Wallet,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Plus,
  Key,
  Wifi,
  Clock,
  ClipboardList,
  Headphones,
  PhoneCall,
  ChevronDown,
} from "lucide-react";

const navGroups = [
  {
    id: "overview",
    title: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }
    ]
  },
  {
    id: "finance",
    title: "Finance",
    items: [
      { to: "/dashboard/add-balance", label: "Add Balance", icon: Wallet },
      { to: "/dashboard/pending-balance", label: "Pending Balance", icon: Clock },
      { to: "/dashboard/payment", label: "Payment History", icon: CreditCard },
    ]
  },
  {
    id: "credit",
    title: "Credit Manage",
    items: [
      { to: "/dashboard/credit-topup", label: "Credit Topup", icon: CreditCard, roles: ["wallet_agent"] },
      { to: "/dashboard/credit-history", label: "Credit History", icon: ClipboardList, roles: ["wallet_agent"] },
    ]
  },
  {
    id: "services",
    title: "Services & Plans",
    items: [
      { to: "/dashboard/subscription", label: "Subscription", icon: Zap },
      { to: "/dashboard/your-plan", label: "Your Plan", icon: ClipboardList },
    ]
  },
  {
    id: "devices",
    title: "Device Management",
    items: [
      { to: "/dashboard/device", label: "My Devices", icon: Smartphone, rightIcon: Plus },
      { to: "/dashboard/devices-presence", label: "Devices Presence", icon: Wifi },
      { to: "/dashboard/number-status", label: "Number Status", icon: PhoneCall, roles: ["wallet_agent"] },
    ]
  },
  {
    id: "integration",
    title: "Integration",
    items: [
      { to: "/dashboard/add-payment-method", label: "Payment Methods", icon: CreditCard, rightIcon: Plus },
      { to: "/dashboard/add-payment-page", label: "Payment Pages", icon: AppWindow, hiddenRoles: ["wallet_agent"] },
      { to: "/dashboard/api-key", label: "API Key", icon: Key, hiddenRoles: ["wallet_agent"] },
    ]
  },
  {
    id: "support",
    title: "Account & Support",
    items: [
      { to: "/dashboard/profile", label: "My Profile", icon: User },
      { to: "/dashboard/add-support", label: "Support Ticket", icon: Headphones, hiddenRoles: ["wallet_agent"] },
    ]
  }
];

export default function DashboardLayout() {
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  
  // State for collapsible groups
  const [expandedGroups, setExpandedGroups] = React.useState({
    finance: true,
    overview: true,
    credit: true,
    devices: true,
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Helper: Filter groups and items based on role
  const filteredGroups = React.useMemo(() => {
    return navGroups.map(group => {
      const visibleItems = group.items.filter(item => {
        // Show if roles not defined OR user role matches
        const roleMatch = !item.roles || item.roles.includes(user?.role);
        // Hide if hiddenRoles defined AND user role matches
        const hiddenMatch = item.hiddenRoles && item.hiddenRoles.includes(user?.role);
        
        return roleMatch && !hiddenMatch;
      });
      return { ...group, items: visibleItems };
    }).filter(group => group.items.length > 0);
  }, [user?.role]);


  // Always fetch fresh user profile when token is available (handles partial user after login)
  React.useEffect(() => {
    if (!token) return;
    api.me(token).then(setUser).catch(console.warn);
  }, [token, setUser]);

  const refreshUser = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const data = await api.me(token);
      setUser(data);
    } catch (err) {
      console.warn("Failed to refresh", err);
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };


  // Remove incorrect effect that only ran when token was missing



  const bgClass = darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900";
  const sidebarBg = darkMode ? "bg-gray-800/90" : "bg-white/95";
  const borderClass = darkMode ? "border-gray-700" : "border-gray-200";
  const scrollClass = darkMode ? "nice-scroll-dark" : "nice-scroll";
  const textClass = darkMode ? "text-gray-400" : "text-gray-500";
  const hoverClass = darkMode ? "hover:bg-gray-700/50 text-gray-300" : "hover:bg-gray-100 text-gray-700";
  const activeClass = "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg";

  // Shared Navigation Renderer
  const renderNav = (isMobile = false) => (
    <nav className={`flex-1 p-4 space-y-4 overflow-y-auto pr-2 ${scrollClass}`}>
      {filteredGroups.map((group) => {
        // Special case: If group is "Overview", maybe render items directly without accordion? 
        // User requested separation, so let's stick to accordion or titled sections. 
        // Let's do simple Titled Sections that are collapsible.
        
        const isExpanded = expandedGroups[group.id];
        const isOverview = group.id === 'overview';

        return (
          <div key={group.id} className="space-y-1">
            {/* Group Header (Skip for Overview if preferred, but for consistency lets keep it or make it look like a section label) */}
            {!collapsed && !isOverview && (
              <button 
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider ${textClass} hover:text-indigo-500 transition-colors`}
              >
                 <span>{group.title}</span>
                 <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Collapsible Content */}
            <div className={`space-y-1 transition-all duration-300 overflow-hidden ${(!isExpanded && !isOverview && !collapsed) ? 'max-h-0 opacity-50' : 'max-h-[500px] opacity-100'}`}>
               {group.items.map(item => {
                 const Icon = item.icon;
                 return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                        isActive ? activeClass : hoverClass
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="font-medium text-sm">{item.label}</span>
                        {item.rightIcon && <item.rightIcon className="w-3.5 h-3.5 opacity-70" />}
                      </div>
                    )}
                    {collapsed && (
                      <div
                        className={`absolute left-full ml-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${
                          darkMode ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                        } shadow-lg`}
                      >
                        {item.label}
                      </div>
                    )}
                  </NavLink>
                 )
               })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={`flex h-screen ${bgClass} transition-colors duration-300 overflow-hidden`}>
      {/* Desktop Sidebar - Fixed Height, No Scroll */}
      <aside
        className={`hidden md:flex flex-col h-full transition-all duration-300 ease-in-out backdrop-blur-xl ${sidebarBg} border-r ${borderClass} ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        {/* Logo & Collapse */}
        <div className={`flex items-center justify-between p-5 border-b ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-lg">
              <img src={logo} alt="Oracle Payment" className="w-8 h-8 object-contain" />
            </div>
            {!collapsed && (
              <div>
                <Link to="/dashboard">
                  <h1 className="text-xl font-bold hover:opacity-80 transition-opacity" style={{ color: "#0B8D7D" }}>
                    Opay Wallet
                  </h1>
                </Link>
                <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {user?.role === "wallet_agent"
                    ? "Merchant Panel"
                    : user?.role === "user"
                    ? "Personal Opay Panel"
                    : "Admin Panel"}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-lg transition-all hover:bg-gray-200/50 dark:hover:bg-gray-700 ${
              collapsed ? "mx-auto" : ""
            }`}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation - Scrollable with nice scrollbar */}
        {renderNav(false)}

       

        {/* User & Actions - Fixed */}
        <div className={`p-4 border-t ${borderClass}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user?.name || "User"}</p>
                <p className={`text-xs truncate ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {user?.email}
                </p>
              </div>
            )}
          </div>

          {/* Balance */}
          {!collapsed && (
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  <span className="text-sm font-semibold">Balance</span>
                </div>
                <button
                  onClick={refreshUser}
                  disabled={refreshing}
                  className={`p-1.5 rounded-full transition-all ${
                    refreshing ? "animate-spin" : "hover:bg-white/20"
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold">৳{user?.balance?.toFixed(2) || "0.00"}</span>
              </div>
            </div>
          )}

          {/* Wallet Agent Credit */}
          {!collapsed && user?.role === "wallet_agent" && (
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-sm font-semibold">Wallet Credit</span>
                </div>
                <button
                  onClick={refreshUser}
                  disabled={refreshing}
                  className={`p-1.5 rounded-full transition-all ${
                    refreshing ? "animate-spin" : "hover:bg-white/20"
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold">৳{(user?.credit ?? 0).toFixed(2)}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/80">
                This is your merchant credit balance.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={logout}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium hover:shadow-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && "Logout"}
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-xl transition-all ${
                darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </aside>

  {/* Main Area - Only This Scrolls */
  }
      <div className="flex-1 flex flex-col h-screen">
        {/* Mobile Header */}
        <header
          className={`md:hidden flex items-center justify-between p-4 border-b ${borderClass} ${darkMode ? "bg-gray-800" : "bg-white"} backdrop-blur-xl z-10`}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/dashboard">
            <h1 className="text-lg font-bold hover:opacity-80 transition-opacity" style={{ color: "#0B8D7D" }}>
              Opay Wallet
            </h1>
          </Link>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Scrollable Content Area */}
        <main className={`flex-1 ${bgClass} overflow-y-auto ${scrollClass}`}>
          <div className="">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className={`w-72 h-full p-5 ${sidebarBg} backdrop-blur-xl border-r ${borderClass} flex flex-col overflow-hidden`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-lg">
                  <img src={logo} alt="Opay degital" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>
                    <h1 className="text-xl font-bold hover:opacity-80 transition-opacity" style={{ color: "#0B8D7D" }}>
                      Opay Wallet
                    </h1>
                  </Link>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNav(true)}

             

            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  <span className="font-semibold">Balance</span>
                </div>
                <button
                  onClick={refreshUser}
                  disabled={refreshing}
                  className={`p-1 rounded-full ${refreshing ? "animate-spin" : "hover:bg-white/20"}`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="text-2xl font-bold">
                ৳{user?.balance?.toFixed(2) || "0.00"}
              </div>
            </div>

            {user?.role === "wallet_agent" && (
              <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    <span className="font-semibold text-sm">Wallet Credit</span>
                  </div>
                  <button
                    onClick={refreshUser}
                    disabled={refreshing}
                    className={`p-1 rounded-full ${refreshing ? "animate-spin" : "hover:bg-white/20"}`}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xl font-bold">
                  ৳{(user?.credit ?? 0).toFixed(2)}
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium hover:shadow-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}
    </div>
  );
}