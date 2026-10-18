import React, { useState, useEffect } from 'react';
import { Slack, CheckCircle, AlertCircle, Send, Unlink, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { SlackStatus } from '../types';

export const SlackSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SlackStatus>({ connected: false });
  const [testSending, setTestSending] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSlackStatus = async () => {
    try {
      const res = await api.get('/slack/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSlackStatus();
  }, []);

  const handleConnectSlack = () => {
    const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://email-scheduler-f59i.onrender.com' : '');
    window.location.href = `${backendUrl}/api/slack/connect`;
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Disconnect Slack notifications?')) return;
    try {
      await api.post('/slack/disconnect');
      setNotificationMsg({ type: 'success', text: 'Slack disconnected successfully' });
      fetchSlackStatus();
    } catch {
      setNotificationMsg({ type: 'error', text: 'Failed to disconnect Slack' });
    }
  };

  const handleSendTestMessage = async () => {
    setTestSending(true);
    setNotificationMsg(null);
    try {
      const res = await api.post('/slack/test-message');
      if (res.data.success) {
        setNotificationMsg({ type: 'success', text: 'Live test rate-limit alert sent to Slack workspace!' });
      } else {
        setNotificationMsg({
          type: 'error',
          text: res.data.message || 'Could not send test message. Check Slack credentials.',
        });
      }
    } catch (e: any) {
      setNotificationMsg({
        type: 'error',
        text: e.response?.data?.error?.message || 'Could not dispatch Slack message. Ensure Slack bot token is configured.',
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-white min-h-full">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <button
          type="button"
          onClick={() => navigate('/scheduled')}
          className="p-1.5 -ml-1 text-gray-500 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#111827] flex items-center gap-2">
            <Slack className="w-5 h-5 text-[#00A854]" />
            Slack Rate-Limit Notifications
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time Block Kit interactive alert broadcasts when an email sender breaches Redis hourly limits
          </p>
        </div>
      </div>

      {notificationMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notificationMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Integration Card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] flex items-center justify-center">
              <Slack className="w-6 h-6 text-[#00A854]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111827]">
                Slack Workspace Connection
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {status.connected
                  ? `Connected to ${status.workspaceName || 'Slack Workspace'}`
                  : 'Receive team alerts whenever sender limits are exceeded'}
              </p>
            </div>
          </div>

          <div>
            {status.connected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Connected
                </span>
                <button
                  onClick={handleDisconnectSlack}
                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Disconnect Slack"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectSlack}
                className="py-2 px-5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA]/40 text-xs font-semibold transition-all cursor-pointer"
              >
                Connect Slack
              </button>
            )}
          </div>
        </div>

        {/* Test Alert Dispatch */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-xs font-semibold text-[#111827]">
              Dispatch Test Rate-Limit Alert
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Simulates a 429 quota exhaustion event and sends a formatted Block Kit notification
            </p>
          </div>
          <button
            onClick={handleSendTestMessage}
            disabled={testSending}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-semibold border border-gray-200 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-[#00A854]" />
            {testSending ? 'Sending Alert...' : 'Send Test Notification'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default SlackSettingsPage;
