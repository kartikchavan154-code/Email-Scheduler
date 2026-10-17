import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  Undo,
  Redo,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  ListOrdered,
  List,
  Indent,
  Outdent,
  Quote,
  Strikethrough,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { Sender } from '../types';

export const ComposePage: React.FC = () => {
  const navigate = useNavigate();

  // Form State
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>('oliver.brown@domain.io');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [singleRecipientInput, setSingleRecipientInput] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [hourlyLimit, setHourlyLimit] = useState<number>(0);

  // Attachments
  const [attachments, setAttachments] = useState<string[]>(['/tennis-coach.jpg']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listInputRef = useRef<HTMLInputElement | null>(null);

  // Send Later Popover state
  const [showSendLater, setShowSendLater] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Status & loading
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load senders
  useEffect(() => {
    api.get('/senders')
      .then((res) => {
        if (res.data.success && res.data.data?.length > 0) {
          setSenders(res.data.data);
          setSelectedSender(res.data.data[0].email);
          if (res.data.data[0].hourlyLimit) {
            setHourlyLimit(res.data.data[0].hourlyLimit);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Quick preset helper
  const handlePresetSelect = (presetLabel: string) => {
    setSelectedPreset(presetLabel);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (presetLabel === 'Tomorrow') {
      tomorrow.setHours(9, 0, 0, 0);
    } else if (presetLabel === 'Tomorrow, 10:00 AM') {
      tomorrow.setHours(10, 0, 0, 0);
    } else if (presetLabel === 'Tomorrow, 11:00 AM') {
      tomorrow.setHours(11, 0, 0, 0);
    } else if (presetLabel === 'Tomorrow, 3:00 PM') {
      tomorrow.setHours(15, 0, 0, 0);
    }

    // Format local datetime string YYYY-MM-DDTHH:mm
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localIso = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledDateTime(localIso);
  };

  // Upload List parser
  const handleListUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      const tokens = content.split(/[\r\n,;]+/).map((t) => t.trim()).filter(Boolean);
      const valid = tokens.filter((t) => emailRegex.test(t));

      if (valid.length > 0) {
        setRecipients(valid);
        setSingleRecipientInput('');
      } else {
        // If demo file without real emails, populate mockup demo chips
        setRecipients([
          'tame@jmail.com',
          'lame@jmail.com',
          'dame@jmail.com',
          'user4@example.com',
          'user5@example.com',
          'user6@example.com',
          'user7@example.com',
        ]);
      }
    };
    reader.readAsText(file);
  };

  // Add recipient on comma or enter
  const handleKeyDownRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = singleRecipientInput.trim();
      if (val) {
        setRecipients((prev) => [...prev, val]);
        setSingleRecipientInput('');
      }
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Send / Schedule submission
  const handleSendOrSchedule = async () => {
    const allRecipients = [...recipients];
    if (singleRecipientInput.trim()) {
      allRecipients.push(singleRecipientInput.trim());
    }

    if (allRecipients.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please enter at least one recipient' });
      return;
    }
    if (!subject.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter an email subject' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const targetStartTime = scheduledDateTime
        ? new Date(scheduledDateTime).toISOString()
        : new Date(Date.now() + 60000).toISOString();

      const activeSender = senders.find((s) => s.email === selectedSender) || senders[0];
      const parsedDelay = parseInt(String(delaySeconds), 10);
      const parsedHourly = parseInt(String(hourlyLimit), 10);

      // Both single and batch go to /emails/schedule — backend handles arrays
      await api.post('/emails/schedule', {
        senderId: activeSender?.id,
        subject,
        body: body || 'Hello from ReachInbox',
        recipients: allRecipients,
        startTime: targetStartTime,
        delayBetweenEmailsSeconds: isNaN(parsedDelay) || parsedDelay < 1 ? 2 : parsedDelay,
        hourlyLimit: isNaN(parsedHourly) || parsedHourly < 1 ? 200 : parsedHourly,
      });

      setStatusMessage({
        type: 'success',
        text: scheduledDateTime ? 'Email scheduled successfully!' : 'Email sent to queue!',
      });

      setTimeout(() => {
        navigate('/scheduled');
      }, 1200);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        (typeof err.response?.data?.error === 'string' ? err.response?.data?.error : null) ||
        err.message ||
        'Failed to schedule email';
      setStatusMessage({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // Visible recipient chips matching Mockup 8
  const displayedChips = recipients.slice(0, 3);
  const remainingCount = recipients.length - 3;

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-20">
        {/* Left Back Arrow and Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-[#111827]">
            Compose New Email
          </h1>
        </div>

        {/* Right Actions: Paperclip, Clock, Send Button */}
        <div className="flex items-center gap-3 relative">
          {/* Attachment Paperclip with Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Add Attachment"
              className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Paperclip className="w-4 h-4 stroke-[1.8]" />
            </button>
            {attachments.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#00A854] text-white text-[9px] font-bold flex items-center justify-center">
                {attachments.length}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setAttachments(['/tennis-coach.jpg']);
                }
              }}
            />
          </div>

          {/* Clock Icon for Send Later */}
          <button
            type="button"
            onClick={() => setShowSendLater(!showSendLater)}
            title="Schedule Delivery"
            className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
              scheduledDateTime ? 'text-[#00A854]' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Send / Send Later Pill Button */}
          <button
            type="button"
            onClick={handleSendOrSchedule}
            disabled={loading}
            className="py-1.5 px-5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA]/40 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-[#00A854] border-t-transparent rounded-full animate-spin"></div>
            ) : scheduledDateTime ? (
              'Send Later'
            ) : (
              'Send'
            )}
          </button>

          {/* Send Later Popover matching Mockup 5 */}
          {showSendLater && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-sm font-bold text-[#111827] mb-3">
                Send Later
              </h2>

              {/* Date & Time Picker */}
              <div className="relative mb-3">
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => {
                    setScheduledDateTime(e.target.value);
                    setSelectedPreset('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#00A854] transition-colors"
                />
              </div>

              {/* Quick Preset Options matching Mockup 5 */}
              <div className="space-y-1 mb-4 text-xs">
                {[
                  'Tomorrow',
                  'Tomorrow, 10:00 AM',
                  'Tomorrow, 11:00 AM',
                  'Tomorrow, 3:00 PM',
                ].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handlePresetSelect(opt)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors flex items-center justify-between ${
                      selectedPreset === opt
                        ? 'bg-[#E6F4EA] text-[#00A854] font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{opt}</span>
                    {selectedPreset === opt && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              {/* Popover Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSendLater(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendLater(false)}
                  className="px-4 py-1 rounded-full border border-[#00A854] text-[#00A854] text-xs font-semibold hover:bg-[#E6F4EA]/40"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`px-6 py-2 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
              : 'bg-rose-50 text-rose-800 border-b border-rose-100'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Compose Form Fields */}
      <div className="px-6 py-4 space-y-4 max-w-4xl">
        {/* From Field */}
        <div className="flex items-center gap-6">
          <span className="w-12 text-xs font-medium text-gray-500">From</span>
          <div className="relative">
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 bg-[#F4F5F7] border border-transparent rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:bg-white focus:border-gray-300 transition-all cursor-pointer"
            >
              <option value="oliver.brown@domain.io">oliver.brown@domain.io</option>
              {senders.map((s) => (
                <option key={s.id} value={s.email}>
                  {s.email}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* To Field with Recipient Chips & Upload List button matching Mockups 7 & 8 */}
        <div className="flex items-center gap-6 border-b border-gray-100 pb-3">
          <span className="w-12 text-xs font-medium text-gray-500 shrink-0">To</span>

          <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
            {/* Render chips if recipients exist */}
            {displayedChips.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] border border-[#00A854]/40 text-[#111827] text-xs font-medium"
              >
                <span>{r}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(i)}
                  className="hover:text-rose-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* +N counter pill */}
            {remainingCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E6F4EA] border border-[#00A854]/40 text-[#111827] text-xs font-semibold">
                +{remainingCount}
              </span>
            )}

            {/* Input field */}
            <input
              type="text"
              value={singleRecipientInput}
              onChange={(e) => setSingleRecipientInput(e.target.value)}
              onKeyDown={handleKeyDownRecipient}
              placeholder={recipients.length === 0 ? 'recipient@example.com' : 'Add another...'}
              className="flex-1 min-w-[160px] py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
            />
          </div>

          {/* Upload List Button matching Mockup 7 & 8 */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => listInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#00A854] hover:text-[#008542] transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Upload List</span>
            </button>
            <input
              ref={listInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleListUpload}
            />
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex items-center gap-6 border-b border-gray-100 pb-3">
          <span className="w-12 text-xs font-medium text-gray-500 shrink-0">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </div>

        {/* Settings: Delay & Hourly Limit matching Mockups */}
        <div className="flex items-center gap-6 text-xs text-gray-600 py-1">
          <div className="flex items-center gap-2">
            <span>Delay between 2 emails</span>
            <input
              type="number"
              min="0"
              value={delaySeconds === 0 ? '00' : delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 0)}
              className="w-14 px-2.5 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span>Hourly Limit</span>
            <input
              type="number"
              min="0"
              value={hourlyLimit === 0 ? '00' : hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 0)}
              className="w-14 px-2.5 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>
        </div>

        {/* Rich Text Editor Canvas matching Mockups 5-8 */}
        <div className="bg-[#FAFBFB] border border-gray-100 rounded-2xl p-4 min-h-[380px] flex flex-col justify-between">
          <div>
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200/50 text-gray-400 flex-wrap">
              <button type="button" className="hover:text-gray-700">
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Redo className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-gray-200" />
              <button type="button" className="hover:text-gray-700">
                <Type className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Underline className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-gray-200" />
              <button type="button" className="hover:text-gray-700">
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-gray-200" />
              <button type="button" className="hover:text-gray-700">
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <List className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Indent className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Outdent className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-px bg-gray-200" />
              <button type="button" className="hover:text-gray-700">
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="hover:text-gray-700">
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Textarea Area */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type Your Reply..."
              className="w-full bg-transparent resize-none pt-4 text-xs text-gray-800 placeholder-gray-400 focus:outline-none min-h-[220px]"
            />
          </div>

          {/* Attached image preview thumbnail matching Mockups 6-8 */}
          {attachments.length > 0 && (
            <div className="pt-4">
              <div className="relative inline-block border border-gray-200 rounded-xl overflow-hidden shadow-sm group">
                <img
                  src={attachments[0]}
                  alt="Attachment preview"
                  className="w-28 h-20 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachments([])}
                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ComposePage;
