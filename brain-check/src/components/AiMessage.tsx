import { useState, useEffect, useRef } from 'react';
import type { AppData, DayLog } from '../types';
import { RULES } from '../constants';
import { saveData } from '../store';

interface AiMessageProps {
  data: AppData;
  todayLog: DayLog;
  streak: number;
  onMessageSaved: (msg: string) => void;
}

export default function AiMessage({ data, todayLog, streak, onMessageSaved }: AiMessageProps) {
  const [message, setMessage] = useState(todayLog.aiMessage || '');
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(data.apiKey);
  const hasFetched = useRef(false);

  const rulesHeld = RULES.filter((r) => todayLog.rules[r.key]);
  const rulesBroken = RULES.filter((r) => !todayLog.rules[r.key]);
  const anyChecked = rulesHeld.length > 0;

  // Auto-fetch when user has checked at least one rule and hasn't got a message yet
  useEffect(() => {
    if (anyChecked && !message && !loading && !hasFetched.current && data.apiKey) {
      hasFetched.current = true;
      fetchMessage();
    }
  }, [anyChecked, message]);

  useEffect(() => {
    if (todayLog.aiMessage) setMessage(todayLog.aiMessage);
  }, [todayLog.aiMessage]);

  const fetchMessage = async () => {
    const key = apiKey || data.apiKey;
    if (!key) {
      setShowKeyInput(true);
      return;
    }

    setLoading(true);
    try {
      const heldNames = rulesHeld.map((r) => r.label);
      const brokeNames = rulesBroken.map((r) => r.label);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `You are Brain Check, a direct, no-BS accountability coach for a dopamine detox. Give a 2-3 sentence message. Be real — tough love mixed with genuine encouragement. Sound human, not robotic.

IMPORTANT: ONLY reference the data below. Do NOT assume anything not listed.

Streak: ${streak} days (consecutive perfect days)
Score: ${todayLog.healthScore}/100
Checked off today: ${heldNames.length > 0 ? heldNames.join(', ') : 'NOTHING yet'}
Not done today: ${brokeNames.length > 0 ? brokeNames.join(', ') : 'All done!'}
Checked: ${heldNames.length}/${RULES.length}

${heldNames.length === 0 ? 'Nothing is checked. They might not have done their check-in. Push them.' : ''}
${heldNames.length === RULES.length ? 'Perfect day. Celebrate but keep them hungry.' : ''}
${heldNames.length > 0 && heldNames.length < RULES.length ? 'Call out specific rules they missed. Acknowledge what they did.' : ''}`,
          }],
        }),
      });

      const result = await response.json();
      const text = result.content?.[0]?.text || 'Your brain is rewiring. Keep going.';
      setMessage(text);
      onMessageSaved(text);
    } catch {
      setMessage('Couldn\'t reach AI. Your brain is still rewiring — keep going.');
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    const updated = { ...data, apiKey };
    saveData(updated);
    setShowKeyInput(false);
    fetchMessage();
  };

  if (showKeyInput) {
    return (
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[#e0dfe8] mb-2">Set Up AI Coach</h3>
        <p className="text-xs text-[#6b6b80] mb-3">Anthropic API key — stored on your device only.</p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500 mb-3"
        />
        <div className="flex gap-2">
          <button onClick={() => setShowKeyInput(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 font-bold text-sm text-[#6b6b80]">Cancel</button>
          <button onClick={saveKey} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-accent p-5 relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-[#1a1a24]/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-[20px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-extrabold text-white">AI</div>
          <div>
            <h3 className="font-bold text-sm text-[#e0dfe8] leading-tight">Daily Coach</h3>
            <span className="text-[10px] text-[#6b6b80] font-semibold">Auto-generates on check-in</span>
          </div>
        </div>
        {message && (
          <button
            onClick={() => { hasFetched.current = true; fetchMessage(); }}
            disabled={loading}
            className="text-[11px] font-bold text-violet-400 hover:text-violet-300 px-2.5 py-1 rounded-lg hover:bg-violet-500/10 transition-all"
          >
            Refresh
          </button>
        )}
      </div>
      {message ? (
        <p className="text-[14px] text-[#c8c7d4] leading-relaxed">{message}</p>
      ) : (
        <div className="text-center py-2">
          {data.apiKey ? (
            <p className="text-sm text-[#6b6b80]">
              {anyChecked ? 'Generating your daily message...' : 'Check in to get your AI coaching message.'}
            </p>
          ) : (
            <button
              onClick={() => setShowKeyInput(true)}
              className="text-sm font-bold text-violet-400 hover:text-violet-300"
            >
              Set up API key for daily coaching
            </button>
          )}
        </div>
      )}
    </div>
  );
}
