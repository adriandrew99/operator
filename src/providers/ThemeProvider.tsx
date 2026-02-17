'use client';

import { useEffect, useRef, useCallback } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

/**
 * Time-based theme switcher — only active when user preference is 'system' (auto).
 *
 * When the user explicitly selects 'light' or 'dark', the scheduled switcher
 * is completely disabled and their preference is respected.
 *
 * Schedule: 7:00 AM – 5:59 PM = light, 6:00 PM – 6:59 AM = dark
 */
function AutoThemeSwitcher() {
  const { theme } = useTheme();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyTimeBasedTheme = useCallback(() => {
    const hour = new Date().getHours();
    const target = (hour < 7 || hour >= 18) ? 'dark' : 'light';
    const current = document.documentElement.getAttribute('data-theme');
    if (current !== target) {
      document.documentElement.setAttribute('data-theme', target);
    }
  }, []);

  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only run scheduled switching when user is on 'system' (auto) mode
    if (theme !== 'system') return;

    applyTimeBasedTheme();
    intervalRef.current = setInterval(applyTimeBasedTheme, 60_000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [theme, applyTimeBasedTheme]);

  // When user switches AWAY from system → ensure next-themes takes over cleanly
  // by NOT touching data-theme (the cleanup above stops the interval)
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
      value={{
        light: 'light',
        dark: 'dark',
        system: 'dark', // fallback resolved value for 'system' (AutoThemeSwitcher overrides immediately)
      }}
    >
      <AutoThemeSwitcher />
      {children}
    </NextThemesProvider>
  );
}
