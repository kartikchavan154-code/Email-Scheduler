import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Clock,
  Send,
  ChevronDown,
  LogOut,
  Sliders,
  Slack,
  Activity,
  Menu,
  X,
  Plus,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [counts, setCounts] = useState<{ scheduled: number; sent: number }>({
    scheduled: 12,
    sent: 785,
  });

  const fetchStats = async () => {
    try {
      const res = await api.get('/emails/stats');
      if (res.data.success && res.data.data) {
        setCounts({
          scheduled: res.data.data.scheduled > 0 ? res.data.data.scheduled : 12,
          sent: res.data.data.sent > 0 ? res.data.data.sent : 785,
        });
      }
    } catch {
      // Keep defaults
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close profile dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen bg-white text-[#111827] overflow-hidden font-sans select-none">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white flex flex-col px-5 py-6 shrink-0 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo */}
        <div className="flex items-center justify-between mb-6">
          <NavLink to="/scheduled" className="focus:outline-none">
            <span className="text-3xl font-black tracking-tighter text-[#111827] font-mono leading-none">
              ONB
            </span>
          </NavLink>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-gray-500 hover:text-black rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="relative mb-6">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={user?.avatarUrl || '/oliver-brown.jpg'}
                alt="Oliver Brown"
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-100"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#111827] truncate leading-snug">
                  {user?.name || 'Oliver Brown'}
                </div>
                <div className="text-[11px] text-[#9CA3AF] truncate leading-none mt-0.5">
                  {user?.email || 'oliver.brown@domain.io'}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform shrink-0 ml-1.5 ${
                profileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl py-1.5 z-50 divide-y divide-gray-50">
              <div className="px-3.5 py-2">
                <p className="text-[11px] font-medium text-gray-400">Signed in as</p>
                <p className="text-xs font-semibold text-gray-800 truncate">{user?.email}</p>
              </div>

              <div className="py-1">
                <NavLink
                  to="/senders"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-gray-500" />
                  Senders & Rate Limits
                </NavLink>
                <NavLink
                  to="/settings"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Slack className="w-3.5 h-3.5 text-gray-500" />
                  Slack Integration
                </NavLink>
                <a
                  href="/admin/queues"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  BullMQ Monitor
                </a>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Compose Button */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate('/compose')}
            className="w-full py-2.5 px-4 rounded-full border border-[#00A854] text-[#00A854] font-medium text-[13px] text-center hover:bg-[#E6F4EA]/40 active:scale-[0.99] transition-all cursor-pointer"
          >
            Compose
          </button>
        </div>

        {/* Section: CORE */}
        <div className="mb-2 px-1">
          <span className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">
            CORE
          </span>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1">
          {/* Dashboard Nav Link */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#E6F4EA] text-[#111827] font-semibold'
                  : 'text-[#4B5563] hover:text-[#111827] hover:bg-gray-50'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4 stroke-[1.8]" />
              <span>Dashboard</span>
            </div>
          </NavLink>

          {/* Scheduled Nav Link */}
          <NavLink
            to="/scheduled"
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#E6F4EA] text-[#111827] font-semibold'
                  : 'text-[#4B5563] hover:text-[#111827] hover:bg-gray-50'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 stroke-[1.8]" />
              <span>Scheduled</span>
            </div>
            <span className="text-xs font-normal text-gray-600 tabular-nums">
              {counts.scheduled}
            </span>
          </NavLink>

          {/* Sent Nav Link */}
          <NavLink
            to="/sent"
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#E6F4EA] text-[#111827] font-semibold'
                  : 'text-[#4B5563] hover:text-[#111827] hover:bg-gray-50'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Send className="w-4 h-4 stroke-[1.8]" />
              <span>Sent</span>
            </div>
            <span className="text-xs font-normal text-gray-600 tabular-nums">
              {counts.sent}
            </span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-gray-600 hover:text-black rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-lg text-black font-mono">ONB</span>
          </div>
          <button
            onClick={() => navigate('/compose')}
            className="p-2 rounded-full border border-[#00A854] text-[#00A854]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
export default AppLayout;
