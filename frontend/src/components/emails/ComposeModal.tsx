import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Calendar,
  Clock,
  Send,
  AlertCircle,
  CheckCircle,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import { Sender } from '../../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess?: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onScheduledSuccess,
}) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [startTime, setStartTime] = useState<string>(() => {
    // Default to 1 minute from now
    const d = new Date(Date.now() + 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // Recipient input & parsing state
  const [file, setFile] = useState<File | null>(null);
  const [rawTextRecipients, setRawTextRecipients] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{
    valid: string[];
    invalid: string[];
    duplicates: string[];
  }>({ valid: [], invalid: [], duplicates: [] });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch senders on open
  useEffect(() => {
    if (isOpen) {
      api.get('/senders').then((res) => {
        if (res.data.success && res.data.data) {
          setSenders(res.data.data);
          if (res.data.data.length > 0 && !selectedSenderId) {
            setSelectedSenderId(res.data.data[0].id);
            setHourlyLimit(res.data.data[0].hourlyLimit || 200);
          }
        }
      });
    }
  }, [isOpen]);

  // Client-side quick parsing whenever text or file changes
  const parseLeads = (text: string) => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    const tokens = text.split(/[\r\n,;]+/).map((t) => t.trim()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const t of tokens) {
      const email = t.toLowerCase();
      if (email === 'email' || email === 'lead' || email === 'recipient') continue;
      if (!emailRegex.test(email)) {
        invalid.push(t);
      } else if (seen.has(email)) {
        duplicates.push(email);
      } else {
        seen.add(email);
        valid.push(email);
      }
    }
    setParsedPreview({ valid, invalid, duplicates });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseLeads(content);
    };
    reader.readAsText(uploadedFile);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawTextRecipients(val);
    setFile(null);
    parseLeads(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedSenderId) {
      setError('Please select a sender');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!body.trim()) {
      setError('Email body is required');
      return;
    }

    if (parsedPreview.valid.length === 0) {
      setError('At least one valid recipient email is required');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('senderId', selectedSenderId);
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('startTime', new Date(startTime).toISOString());
      formData.append('delayBetweenEmailsSeconds', String(delaySeconds));
      formData.append('hourlyLimit', String(hourlyLimit));

      if (file) {
        formData.append('file', file);
      } else {
        formData.append('recipients', JSON.stringify(parsedPreview.valid));
      }

      const res = await api.post('/emails/schedule', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setSuccessMsg(`Successfully scheduled ${res.data.data.scheduledCount} emails!`);
        setTimeout(() => {
          onClose();
          if (onScheduledSuccess) onScheduledSuccess();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to schedule batch');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-[#E2D5C5] rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2D5C5] bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8C6239]/10 text-[#8C6239] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#2D231B]">Schedule Email Campaign</h2>
              <p className="text-xs text-[#7A695C]">Configure delays, rate limits, and recipients</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#7A695C] hover:text-[#2D231B] rounded-lg hover:bg-[#F3ECE1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Sender Selector */}
          <div>
            <label className="block text-xs font-medium text-[#4D3E33] mb-1.5">From Sender</label>
            <select
              value={selectedSenderId}
              onChange={(e) => {
                setSelectedSenderId(e.target.value);
                const s = senders.find((snd) => snd.id === e.target.value);
                if (s) setHourlyLimit(s.hourlyLimit || 200);
              }}
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E2D5C5] rounded-xl text-sm text-[#2D231B] focus:outline-none focus:border-[#8C6239]"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email}) — Limit: {s.hourlyLimit}/hr
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-[#4D3E33] mb-1.5">Email Subject</label>
            <input
              type="text"
              placeholder="e.g., Exclusive Invitation: Exploring our automated engine"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E2D5C5] rounded-xl text-sm text-[#2D231B] placeholder-[#9C8A7C] focus:outline-none focus:border-[#8C6239]"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-[#4D3E33] mb-1.5">Email Body</label>
            <textarea
              rows={4}
              placeholder="Hi there,&#10;&#10;We are pleased to introduce our production-grade email scheduler..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E2D5C5] rounded-xl text-sm text-[#2D231B] placeholder-[#9C8A7C] focus:outline-none focus:border-[#8C6239] font-mono text-xs"
            />
          </div>

          {/* Recipients Upload & Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#4D3E33]">
                Lead Recipients (CSV file or Paste)
              </label>
              {parsedPreview.valid.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    {parsedPreview.valid.length} Valid
                  </span>
                  {parsedPreview.duplicates.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      {parsedPreview.duplicates.length} Duplicates
                    </span>
                  )}
                  {parsedPreview.invalid.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium">
                      {parsedPreview.invalid.length} Invalid
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Dropzone & Text Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#D9C8B5] hover:border-[#8C6239] rounded-xl cursor-pointer bg-[#FAF7F2] transition-colors">
                <Upload className="w-6 h-6 text-[#8C6239] mb-1.5" />
                <span className="text-xs font-medium text-[#2D231B]">
                  {file ? file.name : 'Upload CSV / TXT Leads'}
                </span>
                <span className="text-[11px] text-[#7A695C]">Columns with 'email' recognized</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <textarea
                rows={3}
                placeholder="Or paste emails here:&#10;alice@example.com&#10;bob@example.com"
                value={rawTextRecipients}
                onChange={handleTextChange}
                className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D5C5] rounded-xl text-xs text-[#2D231B] placeholder-[#9C8A7C] focus:outline-none focus:border-[#8C6239] font-mono"
              />
            </div>
          </div>

          {/* Scheduling Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2D5C5]">
            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-medium text-[#7A695C] mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#8C6239]" />
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E2D5C5] rounded-lg text-xs text-[#2D231B] focus:outline-none focus:border-[#8C6239]"
              />
            </div>

            {/* Delay between sends */}
            <div>
              <label className="block text-[11px] font-medium text-[#7A695C] mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#8C6239]" />
                Delay per Email (s)
              </label>
              <input
                type="number"
                min={1}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 2)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E2D5C5] rounded-lg text-xs text-[#2D231B] focus:outline-none focus:border-[#8C6239]"
              />
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-[11px] font-medium text-[#7A695C] mb-1 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-[#8C6239]" />
                Hourly Limit
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E2D5C5] rounded-lg text-xs text-[#2D231B] focus:outline-none focus:border-[#8C6239]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2D5C5]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#7A695C] hover:text-[#2D231B] hover:bg-[#FAF7F2] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || parsedPreview.valid.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8C6239] hover:bg-[#78532F] disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-[#8C6239]/20 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Enqueuing Jobs...' : `Schedule ${parsedPreview.valid.length || ''} Emails`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
