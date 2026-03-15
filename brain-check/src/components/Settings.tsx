import { useState } from 'react';
import { loadData, saveData } from '../store';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [data, setData] = useState(loadData);
  const [notifTime, setNotifTime] = useState(data.notificationTime);
  const [apiKey, setApiKey] = useState(data.apiKey);
  const [notifStatus, setNotifStatus] = useState<string>('');

  const handleSave = () => {
    const updated = { ...data, notificationTime: notifTime, apiKey };
    saveData(updated);
    setData(updated);
    onClose();
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotifStatus('Not supported in this browser');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const updated = { ...data, notificationTime: notifTime };
        saveData(updated);
        setData(updated);
        setNotifStatus('Enabled! Reminders at ' + notifTime);
        reg.showNotification('Brain Check', {
          body: 'Notifications set up! You\'ll be reminded daily.',
          icon: '/brain-icon-192.svg',
        });
      }
    } else {
      setNotifStatus('Permission denied. Check browser settings.');
    }
  };

  const resetData = () => {
    if (confirm('Delete ALL your data? This cannot be undone.')) {
      localStorage.removeItem('brain-check-data');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#faf8f5] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-[#1a1a1a]">Settings</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f0ece6] flex items-center justify-center text-sm font-bold text-[#9ca3af] hover:bg-[#e8e4de]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          <div className="card-solid p-4">
            <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Daily Reminder</label>
            <input
              type="time"
              value={notifTime}
              onChange={(e) => setNotifTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#f0ece6] bg-[#faf8f5] text-sm focus:outline-none focus:border-[#22c55e]"
            />
            <button
              onClick={enableNotifications}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#22c55e] text-white font-bold text-sm hover:bg-[#16a34a] transition-colors"
            >
              Enable Notifications
            </button>
            {notifStatus && <p className="mt-2 text-xs text-[#9ca3af]">{notifStatus}</p>}
          </div>

          <div className="card-solid p-4">
            <label className="text-sm font-bold text-[#1a1a1a] block mb-1">AI Coach API Key</label>
            <p className="text-[11px] text-[#9ca3af] mb-2">Anthropic API key. Stored on your device only.</p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 rounded-xl border border-[#f0ece6] bg-[#faf8f5] text-sm focus:outline-none focus:border-[#22c55e]"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl bg-[#1a1a1a] text-white font-bold text-sm hover:bg-[#2a2a2a] transition-all"
          >
            Save Settings
          </button>

          <button
            onClick={resetData}
            className="w-full py-3 rounded-2xl border-2 border-[#ef4444]/30 text-[#ef4444] font-bold text-sm hover:bg-[#ef4444]/5 transition-all"
          >
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}
