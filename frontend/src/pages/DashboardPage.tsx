import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Scheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Processing
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Cancelled
          </span>
        );
      default:
        return <span className="text-xs text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-white min-h-full">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Sent', value: stats.sent, icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Failed', value: stats.failed, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Active Senders', value: stats.activeSenders, icon: Users, color: 'text-[#00A854]', bg: 'bg-[#E6F4EA]' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className="text-xl font-bold text-[#111827] tabular-nums">{stat.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="w-full pl-10 pr-4 py-2 bg-[#F4F5F7] border border-transparent rounded-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 transition-all"
          />
        </form>

        <div className="flex items-center gap-1.5 p-1 bg-[#F4F5F7] rounded-full shrink-0">
          {['ALL', 'SCHEDULED', 'SENT', 'FAILED'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-white text-[#111827] shadow-sm font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#00A854]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/compose')}
            className="flex items-center gap-1.5 py-2 px-4 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA]/40 text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Compose
          </button>
        </div>
      </div>

      {/* Email Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">Scheduled</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#00A854]" />
                    Loading emails...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-gray-600">No emails yet</p>
                    <p className="text-[11px] mt-1">Schedule your first email using the Compose button above</p>
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr
                    key={email.id}
                    onClick={() => navigate(`/email/${email.id}`)}
                    className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-[#111827] max-w-[140px] truncate">
                      {email.recipientEmail}
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate text-gray-700">{email.subject}</td>
                    <td className="py-3 px-4 text-gray-500 truncate">
                      {email.sender?.name || email.sender?.email || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {new Date(email.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(email.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {email.etherealPreviewUrl && (
                          <a
                            href={email.etherealPreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-gray-400 hover:text-[#00A854] rounded-lg hover:bg-[#E6F4EA] transition-colors"
                            title="Open Ethereal Preview"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {email.status === 'SCHEDULED' && (
                          <button
                            type="button"
                            onClick={() => handleCancelEmail(email.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Cancel"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
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
export default DashboardPage;
