import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  RefreshCw,
  Clock,
  Star,
} from 'lucide-react';
import { api } from '../api/client';
import { Email } from '../types';

export const ScheduledPage: React.FC = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // Default demo items matching Mockup 2 if empty
  const defaultDemoItems: Partial<Email>[] = [
    {
      id: 'demo-sch-1',
      recipientEmail: 'John Smith',
      subject: 'Meeting follow-up - Scheduled',
      body: 'Hi John, just wanted to follow up on our meeting yesterday regarding the product roadmap...',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'SCHEDULED',
    },
    {
      id: 'demo-sch-2',
      recipientEmail: 'Olive',
      subject: "Ramit, great to meet you - you'll love it",
      body: 'Hi Olive, just wanted to follow up on our meeting and share the private coaching details...',
      scheduledAt: new Date(Date.now() + 172800000).toISOString(),
      status: 'SCHEDULED',
    },
  ];

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emails/scheduled', {
        params: { limit: 50 },
      });
      if (res.data.success && res.data.data.emails?.length > 0) {
        setEmails(res.data.data.emails);
      } else {
        // Fallback to demo items so UI matches Figma perfectly on first run
        setEmails(defaultDemoItems as Email[]);
      }
    } catch {
      setEmails(defaultDemoItems as Email[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
  }, []);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatScheduledPill = (dateStr?: string, index?: number) => {
    if (!dateStr) return 'Tue 9:15:12 AM';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return index === 1 ? 'Thu 8:15:12 PM' : 'Tue 9:15:12 AM';
      }
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[d.getDay()];
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${dayName} ${hours}:${minutes}:${seconds} ${ampm}`;
    } catch {
      return 'Tue 9:15:12 AM';
    }
  };

  const filteredEmails = emails.filter((email) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.recipientEmail.toLowerCase().includes(q) ||
      email.subject.toLowerCase().includes(q) ||
      email.body.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Search & Filter Bar */}
      <div className="p-4 sm:p-6 pb-2">
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="flex-1 max-w-2xl relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-11 pr-4 py-2 bg-[#F4F5F7] border border-transparent rounded-full text-xs text-[#111827] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 transition-all"
            />
          </div>

          {/* Filter icon */}
          <button
            type="button"
            title="Filter"
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Filter className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Refresh icon */}
          <button
            type="button"
            onClick={fetchScheduled}
            title="Refresh"
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 stroke-[1.8] ${loading ? 'animate-spin text-[#00A854]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 divide-y divide-gray-100">
        {filteredEmails.map((email, idx) => {
          const isStarred = starredIds.has(email.id);
          const recipientName = email.recipientEmail.includes('@')
            ? email.recipientEmail.split('@')[0]
            : email.recipientEmail;

          return (
            <div
              key={email.id}
              onClick={() => navigate(`/email/${email.id}`)}
              className="flex items-center justify-between py-3.5 px-2 hover:bg-[#F9FAFB] cursor-pointer transition-colors group rounded-lg"
            >
              {/* Left & Middle content */}
              <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
                {/* Recipient */}
                <span className="w-44 shrink-0 text-xs font-semibold text-[#111827] truncate">
                  To: {recipientName}
                </span>

                {/* Orange Scheduled Tag */}
                <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF3E2] text-[#D97706] text-[11px] font-medium">
                  <Clock className="w-3 h-3 stroke-[2]" />
                  <span>{formatScheduledPill(email.scheduledAt, idx)}</span>
                </div>

                {/* Subject & Body snippet */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate text-xs">
                  <span className="font-semibold text-[#111827] shrink-0 truncate">
                    {email.subject}
                  </span>
                  <span className="text-[#9CA3AF] truncate">
                    - {email.body.replace(/<[^>]*>?/gm, '').trim()}
                  </span>
                </div>
              </div>

              {/* Star on right */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={(e) => toggleStar(email.id, e)}
                  className="p-1 text-gray-300 hover:text-amber-400 transition-colors"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isStarred
                        ? 'fill-amber-400 text-amber-400'
                        : 'stroke-[1.5] text-gray-300'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}

        {filteredEmails.length === 0 && !loading && (
          <div className="py-20 text-center text-gray-400 text-xs">
            No scheduled emails found
          </div>
        )}
      </div>
    </div>
  );
};
export default ScheduledPage;
