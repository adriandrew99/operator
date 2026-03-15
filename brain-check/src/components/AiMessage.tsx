import { useState, useEffect } from 'react';
import type { AppData, DayLog } from '../types';
import { RULES } from '../constants';

interface AiMessageProps {
  data: AppData;
  todayLog: DayLog;
  streak: number;
}

export default function AiMessage({ data, todayLog, streak }: AiMessageProps) {
  const [message, setMessage] = useState(todayLog.aiMessage || '');
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(data.apiKey);

  useEffect(() => {
    if (todayLog.aiMessage) {
      setMessage(todayLog.aiMessage);
    }
  }, [todayLog.aiMessage]);

  const fetchMessage = async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    setLoading(true);
    try {
      const heldRules = RULES.filter((r) => todayLog.rules[r.key]).map((r) => r.label);
      const brokeRules = RULES.filter((r) => !todayLog.rules[r.key]).map((r) => r.label);

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
              content: `You are the Brain Check AI coach. Give a 2-3 sentence personalised message based on this dopamine detox data. Mix accountability with encouragement. No fluff, be direct.

Current streak: ${streak} days
Health score: ${todayLog.healthScore}/100
Rules held today: ${heldRules.join(', ') || 'None yet'}
Rules broken today: ${brokeRules.join(', ') || 'None — all held!'}

Keep it real but supportive. Reference specific rules they held or broke.`,
            },
          ],
        }),
      });

      const result = await response.json();
      const aiText = result.content?.[0]?.text || 'Keep pushing. Your brain is rewiring.';
      setMessage(aiText);

      // Save to log — caller should persist via onMessage callback if needed
      todayLog.aiMessage = aiText;
    } catch {
      setMessage('Could not connect to AI. Keep pushing — your brain is rewiring regardless.');
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    data.apiKey = apiKey;
    localStorage.setItem('brain-check-data', JSON.stringify(data));
    setShowKeyInput(false);
    fetchMessage();
  };

  if (showKeyInput) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm">
        <h3 className="font-bold text-sm mb-3">🔑 Anthropic API Key</h3>
        <p className="text-xs text-[#8a8680] mb-3">
          Enter your API key to get personalised AI coaching messages. Your key is stored locally only.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-4 py-2.5 rounded-xl border border-[#e8e4de] text-sm mb-3 focus:outline-none focus:border-[#5ecc8b]"
        />
        <button
          onClick={saveKey}
          className="w-full py-2.5 rounded-xl bg-[#2d2a26] text-white font-bold text-sm"
        >
          Save & Get Message
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-bold text-sm text-[#2d2a26]">AI Coach</h3>
        </div>
        <button
          onClick={fetchMessage}
          disabled={loading}
          className="text-xs font-semibold text-[#5ecc8b] hover:text-[#4ab87a] disabled:opacity-50"
        >
          {loading ? 'Thinking...' : message ? 'Refresh' : 'Get Message'}
        </button>
      </div>
      {message ? (
        <p className="text-sm text-[#2d2a26] leading-relaxed">{message}</p>
      ) : (
        <p className="text-sm text-[#8a8680] italic">
          Tap "Get Message" for personalised AI coaching based on your progress today.
        </p>
      )}
    </div>
  );
}
