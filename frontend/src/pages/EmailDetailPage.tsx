import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  ChevronDown,
  Download,
} from 'lucide-react';
import { api } from '../api/client';
import { Email } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const EmailDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [showRecipientDetails, setShowRecipientDetails] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmail = async () => {
      setLoading(true);
      try {
        if (id && !id.startsWith('demo-')) {
          const res = await api.get(`/emails/${id}`);
          if (res.data.success && res.data.data) {
            setEmail(res.data.data);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to default demo email matching Mockup 4
      }

      // Default demo email matching Screenshot 4
      setEmail({
        id: id || 'demo-email-detail',
        userId: 'usr_1',
        senderId: 'snd_1',
        recipientEmail: 'oliver.brown@domain.io',
        subject: 'Oliver, hello there! | MJWYT44 BM#52W01',
        body: `Hey Oliver,\n\nYou've just RECEIVED something`,
        scheduledAt: new Date().toISOString(),
        status: 'SENT',
        retryCount: 0,
        createdAt: 'Nov 3, 10:23 AM',
        sender: {
          id: 'snd_1',
          name: 'Amanda Clark',
          email: 'sender@example.com',
        },
      });
      setLoading(false);
    };

    fetchEmail();
  }, [id]);

  const handleDelete = async () => {
    if (confirm('Delete this email?')) {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-[#00A854] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Subject title */}
          <h1 className="text-base sm:text-lg font-bold text-[#111827] truncate">
            {email?.subject || 'Oliver, hello there! | MJWYT44 BM#52W01'}
          </h1>
        </div>

        {/* Action icons right */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            title="Star"
            className="p-2 text-gray-400 hover:text-amber-400 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Star
              className={`w-4 h-4 ${
                isStarred
                  ? 'fill-amber-400 text-amber-400'
                  : 'stroke-[1.8] text-gray-400'
              }`}
            />
          </button>

          <button
            type="button"
            title="Archive"
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Archive className="w-4 h-4 stroke-[1.8]" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            title="Delete"
            className="p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Trash2 className="w-4 h-4 stroke-[1.8]" />
          </button>

          <div className="ml-2 pl-2 border-l border-gray-200">
            <img
              src={user?.avatarUrl || '/oliver-brown.jpg'}
              alt="User"
              className="w-7 h-7 rounded-full object-cover border border-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Main Email Thread Content */}
      <div className="max-w-4xl px-6 py-6 space-y-6">
        {/* Sender details header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* Green circular avatar with letter A */}
            <div className="w-10 h-10 rounded-full bg-[#00A854] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              A
            </div>

            {/* Sender and recipient names */}
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-sm text-[#111827]">
                  {email?.sender?.name || 'Amanda Clark'}
                </span>
                <span className="text-xs text-gray-400 font-normal">
                  &lt;{email?.sender?.email || 'sender@example.com'}&gt;
                </span>
              </div>

              {/* to me dropdown */}
              <div className="relative mt-0.5">
                <button
                  type="button"
                  onClick={() => setShowRecipientDetails(!showRecipientDetails)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  <span>to me</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showRecipientDetails && (
                  <div className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-100 rounded-xl shadow-lg z-20 text-[11px] text-gray-600 space-y-1 w-64">
                    <div>
                      <span className="font-semibold text-gray-800">From:</span>{' '}
                      {email?.sender?.email || 'sender@example.com'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">To:</span>{' '}
                      {email?.recipientEmail || 'oliver.brown@domain.io'}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Date:</span> Nov 3,
                      10:23 AM
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date stamp right */}
          <div className="text-xs text-gray-400 shrink-0 font-normal">
            Nov 3, 10:23 AM
          </div>
        </div>

        {/* Email Body */}
        <div className="pt-2 text-sm text-[#202124] leading-relaxed space-y-4">
          <p>Hey Oliver,</p>
          <p>You've just RECEIVED something</p>

          {/* Golden Callout Box matching Mockup 4 */}
          <div className="p-4 bg-[#FEFCE8] border border-amber-200/60 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-[#111827] flex items-center gap-2">
              <span>⚡</span>
              <span>
                Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment
              </span>
              <span>⚡</span>
            </div>
            <div className="text-gray-800 flex items-center gap-2">
              <span>⚡</span>
              <span>
                To explore securing your private transformation, simply reply right now with
                <span className="font-bold"> "FLY OUT FIX"</span> .
              </span>
            </div>
          </div>

          <p>Your coach for world-class performance,</p>
          <p className="font-semibold">Grant</p>
          <p className="italic text-gray-700">
            P.S. Always remember that you can develop world class technique! 🚀
          </p>
        </div>

        {/* Attachments Section matching Mockup 4 */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Attachment 1 */}
            <div
              onClick={() => setActiveImageModal('/tennis-coach.jpg')}
              className="w-48 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-all group bg-white"
            >
              <div className="h-28 overflow-hidden bg-gray-100 relative">
                <img
                  src="/tennis-coach.jpg"
                  alt="Tennis Coach Profile"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  Tennis_Coach_Profile.png
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">1.2 MB</p>
              </div>
            </div>

            {/* Attachment 2 */}
            <div
              onClick={() => setActiveImageModal('/tennis-coach.jpg')}
              className="w-48 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-all group bg-white"
            >
              <div className="h-28 overflow-hidden bg-gray-100 relative">
                <img
                  src="/tennis-coach.jpg"
                  alt="Tennis Coach Profile 2"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  Tennis_Coach_Profile2.png
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">1.2 MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {activeImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveImageModal(null)}
        >
          <div
            className="max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeImageModal}
              alt="Attachment Preview"
              className="w-full max-h-[80vh] object-contain"
            />
            <div className="p-4 flex items-center justify-between bg-white border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-800">
                Tennis_Coach_Profile.png (1.2 MB)
              </span>
              <a
                href={activeImageModal}
                download="Tennis_Coach_Profile.jpg"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00A854] text-white text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default EmailDetailPage;
