import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (todayLog.aiMessage) {
      setMessage(todayLog.aiMessage);
    }
  }, [todayLog.aiMessage]);

  const rulesHeld = RULES.filter((r) => todayLog.rules[r.key]);
  const rulesBroken = RULES.filter((r) => !todayLog.rules[r.key]);
  const anyChecked = rulesHeld.length > 0;

  const fetchMessage = async () => {
    if (!apiKey) {
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
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `You are Brain Check, an AI accountability coach for a dopamine detox app. Give a 2-3 sentence personalised message. Be direct, no fluff. Mix tough love with encouragement.

IMPORTANT: Base your message ONLY on the data below. Do NOT assume or invent anything.

Current streak: ${streak} days (consecutive days with ALL 6 rules held)
Health score: ${todayLog.healthScore}/100
Rules HELD today (checked off): ${heldNames.length > 0 ? heldNames.join(', ') : 'NONE — nothing checked off yet'}
Rules NOT held today (unchecked): ${brokeNames.length > 0 ? brokeNames.join(', ') : 'None — all held!'}
Total checked: ${heldNames.length}/${RULES.length}

${heldNames.length === 0 ? 'The user has not checked anything off yet today. Acknowledge this — they may not have done their check-in yet, or they may be struggling. Push them to take action.' : ''}
${heldNames.length === RULES.length ? 'Perfect day! All rules held. Celebrate this but keep them humble.' : ''}
${heldNames.length > 0 && heldNames.length < RULES.length ? `They held ${heldNames.length} out of ${RULES.length}. Acknowledge what they did well, but call out the specific rules they broke.` : ''}

Keep it real. Reference specific rules by name.`,
            },
          ],
        }),
      });

      const result = await response.json();
      const aiText = result.content?.[0]?.text || 'Keep pushing. Your brain is rewiring.';
      setMessage(aiText);
      onMessageSaved(aiText);
    } catch {
      setMessage('Could not connect to AI. Keep pushing — your brain is rewiring regardless.');
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
      <div className="card-solid p-5">
        <h3 className="font-bold text-sm mb-2">Set Up AI Coach</h3>
        <p className="text-xs text-[#9ca3af] mb-3">
          Enter your Anthropic API key for personalised daily coaching. Stored on your device only.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-4 py-3 rounded-xl border border-[#e8e4de] text-sm mb-3 focus:outline-none focus:border-[#22c55e] bg-[#faf8f5]"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowKeyInput(false)}
            className="flex-1 py-2.5 rounded-xl border border-[#e8e4de] font-bold text-sm text-[#9ca3af]"
          >
            Cancel
          </button>
          <button
            onClick={saveKey}
            className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] text-white font-bold text-sm"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-solid p-5 overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[20px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-sm">AI</span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#1a1a1a] leading-tight">Daily Coach</h3>
            <span className="text-[10px] text-[#9ca3af] font-semibold">Powered by Claude</span>
          </div>
        </div>
        <button
          onClick={fetchMessage}
          disabled={loading}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
            message
              ? 'text-[#9ca3af] hover:text-[#1a1a1a] hover:bg-[#f0ece6]'
              : 'bg-[#1a1a1a] text-white'
          }`}
        >
          {message ? 'Refresh' : 'Get Message'}
        </button>
      </div>
      {message ? (
        <p className="text-[14px] text-[#1a1a1a] leading-relaxed">{message}</p>
      ) : (
        <div className="text-center py-3">
          <p className="text-sm text-[#9ca3af]">
            {anyChecked ? 'Tap "Get Message" for your daily coaching.' : 'Check in first, then get your AI coaching message.'}
          </p>
        </div>
      )}
    </div>
  );
}
