import React, { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle, AlertCircle, RefreshCw, Sliders, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Sender, SenderLimitStatus } from '../types';

export const SendersPage: React.FC = () => {
  const navigate = useNavigate();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [limits, setLimits] = useState<Record<string, SenderLimitStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // New sender form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [isEthereal, setIsEthereal] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  const fetchSenders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/senders');
      if (res.data.success) {
        setSenders(res.data.data);

        // Fetch limits for each sender
        const limitMap: Record<string, SenderLimitStatus> = {};
        await Promise.all(
          res.data.data.map(async (s: Sender) => {
            try {
              const lRes = await api.get(`/senders/${s.id}/limits`);
              if (lRes.data.success) {
                limitMap[s.id] = lRes.data.data;
              }
            } catch (e) {
              console.error(e);
            }
          })
        );
        setLimits(limitMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  const handleVerifySmtp = async (senderId: string) => {
    setVerifyingId(senderId);
    setVerifyResult(null);
    try {
      const res = await api.post(`/senders/${senderId}/verify`);
      if (res.data.success) {
        setVerifyResult({ id: senderId, success: true, msg: 'SMTP connection verified successfully!' });
      } else {
        setVerifyResult({ id: senderId, success: false, msg: res.data.message || 'Verification failed' });
      }
    } catch (e: any) {
      setVerifyResult({
        id: senderId,
        success: false,
        msg: e.response?.data?.error?.message || 'SMTP Connection timeout or authentication error',
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/senders', {
        name,
        email,
        hourlyLimit,
        isEthereal,
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      fetchSenders();
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to create sender');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-white min-h-full">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/scheduled')}
            className="p-1.5 -ml-1 text-gray-500 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#111827] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00A854]" />
              Senders & Rate Limits
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Atomic Redis-coordinated hourly sending quotas and Ethereal Email test identities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSenders}
            className="p-2 text-gray-500 hover:text-gray-800 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#00A854]' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 py-2 px-4 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA]/40 font-semibold text-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Sender Identity
          </button>
        </div>
      </div>

      {/* Senders Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {senders.map((sender) => {
          const limitStatus = limits[sender.id];
          const current = limitStatus?.currentCount || 0;
          const max = limitStatus?.limit || sender.hourlyLimit || 200;
          const percent = Math.min(100, Math.round((current / max) * 100));

          return (
            <div
              key={sender.id}
              className="bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-[#111827] flex items-center gap-2">
                    {sender.name}
                    <span className="w-2 h-2 rounded-full bg-[#00A854]" title="Active"></span>
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{sender.email}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#E6F4EA] text-[#00A854]">
                  {sender.smtpHost || 'Ethereal SMTP'}
                </span>
              </div>

              {/* Progress Bar for Hourly Limit */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" /> Hourly Quota
                  </span>
                  <span className="font-medium text-gray-900 font-mono">
                    {current} / {max} sent ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-[#00A854]'
                    }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>

              {/* Actions & Verification */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => handleVerifySmtp(sender.id)}
                  disabled={verifyingId === sender.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00A854]" />
                  {verifyingId === sender.id ? 'Testing...' : 'Verify SMTP'}
                </button>

                <span className="text-[11px] text-gray-400">
                  {sender.enabled ? 'Enabled' : 'Paused'}
                </span>
              </div>

              {verifyResult && verifyResult.id === sender.id && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    verifyResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {verifyResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="truncate">{verifyResult.msg}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Sender Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Add Sender Account</h3>
            <form onSubmit={handleCreateSender} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-600 mb-1">Sender Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales Outreach"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#00A854]"
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. outreach@reachinbox.test"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#00A854]"
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Max Hourly Sending Rate</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-[#00A854]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ethereal"
                  checked={isEthereal}
                  onChange={(e) => setIsEthereal(e.target.checked)}
                  className="rounded text-[#00A854] focus:ring-[#00A854]"
                />
                <label htmlFor="ethereal" className="text-gray-700">
                  Auto-generate Ethereal Email test mailbox (Zero SMTP setup required)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00A854] hover:bg-[#00964B] text-white font-semibold rounded-xl"
                >
                  Save Sender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default SendersPage;
