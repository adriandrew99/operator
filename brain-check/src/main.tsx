import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    const checkAndNotify = () => {
      try {
        const raw = localStorage.getItem('brain-check-data');
        if (!raw) return;
        const data = JSON.parse(raw);
        const now = new Date();
        const [h, m] = (data.notificationTime || '20:00').split(':').map(Number);
        const notifKey = `notif-shown-${now.toISOString().split('T')[0]}`;

        if (
          now.getHours() === h &&
          now.getMinutes() >= m &&
          now.getMinutes() <= m + 5 &&
          !localStorage.getItem(notifKey)
        ) {
          localStorage.setItem(notifKey, 'true');
          registration.showNotification('Brain Check 🧠', {
            body: "Time for your daily check-in! How did you do today?",
            icon: '/brain-icon-192.png',
            badge: '/brain-icon-192.png',
            tag: 'daily-reminder',
          });
        }
      } catch {
        // Silent fail
      }
    };

    setInterval(checkAndNotify, 60000);
    checkAndNotify();
  });
}
