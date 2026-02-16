'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

function AutoThemeSwitcher() {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    // Only apply auto-switching when theme is set to 'auto' or 'system'
    if (theme !== 'system') return;

    function applyTimeBasedTheme() {
      const hour = new Date().getHours();
      // 7:00 AM - 5:59 PM → light, 6:00 PM - 6:59 AM → dark
      const shouldBeDark = hour < 7 || hour >= 18;
      const currentResolved = document.documentElement.getAttribute('data-theme');
      const target = shouldBeDark ? 'dark' : 'light';
      if (currentResolved !== target) {
        document.documentElement.setAttribute('data-theme', target);
      }
    }

    applyTimeBasedTheme();
    // Check every minute for time-based switching
    const interval = setInterval(applyTimeBasedTheme, 60_000);
    return () => clearInterval(interval);
  }, [theme, setTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem={false}
      themes={['light', 'dark', 'system']}
      disableTransitionOnChange
    >
      <AutoThemeSwitcher />
      {children}
    </NextThemesProvider>
  );
}
