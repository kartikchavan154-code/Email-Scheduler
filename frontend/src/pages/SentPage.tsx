import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { api } from '../api/client';
import { Email } from '../types';

export const SentPage: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'SENT' | 'FAILED'>('SENT');

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'SENT' ? '/emails/sent' : '/emails/failed';
      const res = await api.get(endpoint, {
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
    fetchEmails();
  }, [page, activeTab]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <Send className="w-5 h-5 text-emerald-400" />
            Email Dispatch Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed deliveries with Ethereal Email SMTP preview links & failure diagnostics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('SENT');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'SENT'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Delivered Successfully
            </button>
            <button
              onClick={() => {
                setActiveTab('FAILED');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'FAILED'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Failed / Retried
            </button>
          </div>
          <button
            onClick={fetchEmails}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 border border-slate-700/60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">{activeTab === 'SENT' ? 'Sent Time' : 'Failed Time'}</th>
                <th className="py-3.5 px-4 text-right">
                  {activeTab === 'SENT' ? 'Ethereal Preview' : 'Diagnostics'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading dispatch logs...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-300">
                      No {activeTab.toLowerCase()} emails recorded
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
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {email.sentAt
                        ? new Date(email.sentAt).toLocaleString()
                        : new Date(email.updatedAt || email.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Ethereal Preview
                        </a>
                      ) : email.errorMessage ? (
                        <span
                          title={email.errorMessage}
                          className="inline-flex items-center gap-1 text-[11px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 max-w-xs truncate"
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {email.errorMessage}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Delivered</span>
                      )}
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
            Total: <strong className="text-slate-200">{total}</strong>
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
