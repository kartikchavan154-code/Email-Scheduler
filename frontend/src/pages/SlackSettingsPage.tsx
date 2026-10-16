import React, { useState, useEffect } from 'react';
import { Slack, CheckCircle, AlertCircle, Send, Unlink, Key } from 'lucide-react';
import { api } from '../api/client';
import { SlackStatus } from '../types';

export const SlackSettingsPage: React.FC = () => {
  const [status, setStatus] = useState<SlackStatus>({ connected: false });
  const [loading, setLoading] = useState<boolean>(false);
  const [testSending, setTestSending] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSlackStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/slack/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlackStatus();
  }, []);

  const handleConnectSlack = () => {
    window.location.href = '/api/slack/connect';
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Disconnect Slack notifications?')) return;
    try {
      await api.post('/slack/disconnect');
      setNotificationMsg({ type: 'success', text: 'Slack disconnected successfully' });
      fetchSlackStatus();
    } catch (e: any) {
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
        text: e.response?.data?.error?.message || e.message || 'Error triggering Slack alert',
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <Slack className="w-5 h-5 text-indigo-400" />
            Slack Rate-Limit Notifications
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated real-time Block Kit notifications dispatched when any sender identity hits its hourly quota
          </p>
        </div>
        <button
          onClick={fetchSlackStatus}
          disabled={loading}
          title="Refresh Slack Status"
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 border border-slate-700/60"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {notificationMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {notificationMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Main Connection Card */}
      <div className="bg-[#111827]/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Slack className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Slack Workspace Integration</h3>
              <p className="text-xs text-slate-400">
                {status.connected
                  ? `Connected to ${status.workspaceName || 'Slack Team'}`
                  : 'No Slack workspace connected'}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium self-start sm:self-auto ${
              status.connected
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            ></span>
            {status.connected ? 'Live & Connected' : 'Disconnected'}
          </span>
        </div>

        {status.connected ? (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Workspace ID</span>
                <span className="font-mono text-slate-200">{status.workspaceId}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Destination Channel</span>
                <span className="font-mono text-slate-200">
                  {status.channelId || 'Default (#general)'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleSendTestMessage}
                disabled={testSending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-glow transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                {testSending ? 'Sending Live Alert...' : 'Send Test Rate-Limit Alert'}
              </button>
              <button
                onClick={handleDisconnectSlack}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-300 leading-relaxed">
              When a sender identity reaches its hourly dispatch ceiling (e.g. 200 emails/hour), our
              distributed Redis coordination engine flags the state transition and automatically
              posts an instant Slack Block Kit summary to your designated team channel.
            </p>

            <button
              onClick={handleConnectSlack}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-[#4A154B] hover:bg-[#611f69] text-white rounded-xl text-xs font-semibold shadow-lg transition-all"
            >
              <Slack className="w-4 h-4" />
              Connect with Slack
            </button>
          </div>
        )}
      </div>

      {/* Instructions & Credentials Documentation */}
      <div className="bg-[#111827]/50 border border-slate-800 rounded-2xl p-6 space-y-3 text-xs text-slate-400">
        <h4 className="font-semibold text-slate-200 flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-400" />
          Slack App Configuration Instructions
        </h4>
        <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
          <li>Create a Slack App at <code className="text-indigo-300">api.slack.com/apps</code>.</li>
          <li>Under <strong>OAuth & Permissions</strong>, add redirect URL: <code className="text-indigo-300">http://localhost:5000/api/slack/callback</code>.</li>
          <li>Add Bot Token Scopes: <code className="text-indigo-300">chat:write</code>, <code className="text-indigo-300">chat:write.public</code>, <code className="text-indigo-300">incoming-webhook</code>.</li>
          <li>Set <code className="text-indigo-300">SLACK_CLIENT_ID</code> and <code className="text-indigo-300">SLACK_CLIENT_SECRET</code> in <code className="text-indigo-300">backend/.env</code>.</li>
        </ol>
      </div>
    </div>
  );
};
