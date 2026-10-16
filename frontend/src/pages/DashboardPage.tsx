import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Clock,
  Send,
  AlertTriangle,
  Users,
  Search,
  RefreshCw,
  ExternalLink,
  Ban,
  Plus,
  Mail,
} from 'lucide-react';
import { api } from '../api/client';
import { Email, EmailStats } from '../types';

export const DashboardPage: React.FC = () => {
  const { openCompose } = useOutletContext<{ openCompose: () => void }>();

  const [stats, setStats] = useState<EmailStats>({
    scheduled: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    total: 0,
    activeSenders: 0,
  });

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, emailsRes] = await Promise.all([
        api.get('/emails/stats'),
        api.get('/emails/search', {
          params: {
            q: searchQuery || undefined,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            limit: 15,
          },
        }),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
      if (emailsRes.data.success) {
        setEmails(emailsRes.data.data.emails || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboardData();
  };

  const handleCancelEmail = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      await api.post(`/emails/${id}/cancel`);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel email');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Scheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Processing
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Cancelled
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Quick Compose */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            Dispatch Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of BullMQ delayed queue, distributed rate limits, and Ethereal deliveries
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            title="Refresh Live Data"
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={openCompose}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            Schedule New Campaign
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scheduled Card */}
        <div className="p-4 rounded-2xl bg-[#111827]/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Scheduled In Queue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{stats.scheduled}</span>
            <Link
              to="/scheduled"
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
            >
              View queue &rarr;
            </Link>
          </div>
        </div>

        {/* Sent Card */}
        <div className="p-4 rounded-2xl bg-[#111827]/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Sent Successfully</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{stats.sent}</span>
            <Link
              to="/sent"
              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
            >
              View delivery links &rarr;
            </Link>
          </div>
        </div>

        {/* Failed Card */}
        <div className="p-4 rounded-2xl bg-[#111827]/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Failed / Retrying</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{stats.failed}</span>
            <span className="text-[11px] text-slate-500">Auto-exponential backoff</span>
          </div>
        </div>

        {/* Active Senders Card */}
        <div className="p-4 rounded-2xl bg-[#111827]/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Senders</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{stats.activeSenders}</span>
            <Link
              to="/senders"
              className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
            >
              Rate limits &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search recipient, subject, or content (Elasticsearch)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'SCHEDULED', 'SENT', 'FAILED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-glow'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {st === 'ALL' ? 'All Activity' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">Scheduled / Sent</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading live email queue...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-300">No emails found</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Click Compose New Email to schedule your first batch
                    </p>
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {email.recipientEmail}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {email.sender ? email.sender.name : 'Primary Sender'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {email.status === 'SENT' && email.sentAt
                        ? new Date(email.sentAt).toLocaleString()
                        : new Date(email.scheduledAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(email.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {email.etherealPreviewUrl && (
                          <a
                            href={email.etherealPreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Preview
                          </a>
                        )}
                        {email.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleCancelEmail(email.id)}
                            title="Cancel scheduled send"
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {email.errorMessage && (
                          <span
                            title={email.errorMessage}
                            className="text-[11px] text-rose-400 truncate max-w-[120px] cursor-help"
                          >
                            Error details
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
