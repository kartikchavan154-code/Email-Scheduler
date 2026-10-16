import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Ban, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { api } from '../api/client';
import { Email } from '../types';

export const ScheduledPage: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emails/scheduled', {
        params: { page, limit },
      });
      if (res.data.success) {
        setEmails(res.data.data.emails);
        setTotal(res.data.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
  }, [page]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this scheduled email?')) return;
    try {
      await api.post(`/emails/${id}/cancel`);
      fetchScheduled();
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to cancel');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            Scheduled Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Persistent BullMQ delayed jobs awaiting eligible delivery slots
          </p>
        </div>
        <button
          onClick={fetchScheduled}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 border border-slate-700/60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">Scheduled Due Time</th>
                <th className="py-3.5 px-4">Job ID</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Fetching scheduled emails...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-300">No scheduled emails in queue</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Schedule a campaign from the compose button
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
                      {email.sender?.name || 'Primary Sender'}
                    </td>
                    <td className="py-3.5 px-4 text-amber-400/90 font-mono text-[11px]">
                      {new Date(email.scheduledAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                      {email.bullmqJobId || 'Pending queue'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleCancel(email.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20"
                      >
                        <Ban className="w-3 h-3" />
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/40 text-xs text-slate-400">
          <span>
            Total scheduled: <strong className="text-slate-200">{total}</strong>
          </span>
          <div className="flex items-center gap-2">
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
