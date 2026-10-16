import React, { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle, AlertCircle, RefreshCw, Sliders, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { Sender, SenderLimitStatus } from '../types';

export const SendersPage: React.FC = () => {
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
        setVerifyResult({ id: senderId, success: false, msg: res.data.data?.error || 'Verification failed' });
      }
    } catch (e: any) {
      setVerifyResult({ id: senderId, success: false, msg: e.message || 'SMTP check failed' });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/senders', {
        name,
        email: email || 'ethereal@test.com',
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-400" />
            Senders & Distributed Rate Limits
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Atomic Redis-coordinated hourly sending quotas and Ethereal Email test identities
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSenders}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 border border-slate-700/60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
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
              className="bg-[#111827]/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl space-y-4 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                    {sender.name}
                    <span className="w-2 h-2 rounded-full bg-emerald-400" title="Active"></span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{sender.email}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {sender.smtpHost || 'Ethereal SMTP'}
                </span>
              </div>

              {/* Rate Limit Gauge */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Hourly Window Usage
                  </span>
                  <span className="font-mono font-semibold text-slate-200">
                    {current} / {max}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      percent >= 90
                        ? 'bg-rose-500'
                        : percent >= 70
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Window: {limitStatus?.windowKey || 'UTC Hour'}</span>
                  <span>{max - current} slots remaining</span>
                </div>
              </div>

              {/* SMTP Verification */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleVerifySmtp(sender.id)}
                  disabled={verifyingId === sender.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {verifyingId === sender.id ? 'Checking Connection...' : 'Verify SMTP Connection'}
                </button>
              </div>

              {verifyResult && verifyResult.id === sender.id && (
                <div
                  className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                    verifyResult.success
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {verifyResult.success ? (
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{verifyResult.msg}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Sender Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Create Sender Identity</h2>
            <form onSubmit={handleCreateSender} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Team"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Sender Email</label>
                <input
                  type="email"
                  placeholder="Leave empty for auto-generated Ethereal account"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Hourly Rate Limit (emails/hr)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="etherealCheck"
                  checked={isEthereal}
                  onChange={(e) => setIsEthereal(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                />
                <label htmlFor="etherealCheck" className="text-xs text-slate-300">
                  Provision dedicated Ethereal Email test mailbox automatically
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
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
