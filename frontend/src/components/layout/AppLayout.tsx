import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Send,
  Users,
  Slack,
  Activity,
  Plus,
  LogOut,
  Mail,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ComposeModal } from '../emails/ComposeModal';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Scheduled Emails', path: '/scheduled', icon: Clock },
    { label: 'Sent Emails', path: '/sent', icon: Send },
    { label: 'Senders & Limits', path: '/senders', icon: Users },
    { label: 'Slack Integration', path: '/settings', icon: Slack },
  ];

  return (
    <div className="flex h-screen bg-[#0B0F17] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-[#0F172A]/70 backdrop-blur-xl shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-glow">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              ReachInbox
            </span>
            <span className="block text-[10px] text-indigo-400 font-medium uppercase tracking-wider">
              Scheduler Pro
            </span>
          </div>
        </div>

        {/* Compose Button */}
        <div className="p-4">
          <button
            onClick={() => setIsComposeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-glow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Compose New Email
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4 mt-4 border-t border-slate-800/60 px-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
              Infrastructure
            </span>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-between px-3.5 py-2 rounded-xl text-sm text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-emerald-400" />
                BullMQ Monitor
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  user?.avatarUrl ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user?.email || 'default')}`
                }
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Mobile/Desktop */}
        <header className="h-16 border-b border-slate-800 bg-[#0F172A]/50 backdrop-blur-md flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <span className="font-bold text-lg text-white">ReachInbox</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Distributed Scheduler Live
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsComposeOpen(true)}
              className="md:hidden flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Compose
            </button>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              <span>Timezone:</span>
              <span className="font-mono text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                UTC & Local Sync
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet context={{ openCompose: () => setIsComposeOpen(true) }} />
        </main>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </div>
  );
};
