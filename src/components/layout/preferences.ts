'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type DensityPreference = 'compact' | 'comfortable';
const preferenceEvent = 'porta:preferences';
const volatilePreferences = new Map<string, string>();

function readPreference(key: string): string | null {
  if (typeof window === 'undefined') return null;
  if (volatilePreferences.has(key)) return volatilePreferences.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return volatilePreferences.get(key) ?? null;
  }
}

function savePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    volatilePreferences.delete(key);
  } catch {
    // Preferences still work for this session when browser storage is unavailable.
    volatilePreferences.set(key, value);
  }
  window.dispatchEvent(new Event(preferenceEvent));
}

function subscribePreferences(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(preferenceEvent, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(preferenceEvent, listener);
  };
}

function getThemePreference(): ThemePreference {
  const value = readPreference('porta-theme');
  return value === 'light' || value === 'dark' ? value : 'system';
}

function getDensityPreference(): DensityPreference {
  return readPreference('porta-density') === 'comfortable' ? 'comfortable' : 'compact';
}

export function useThemePreference() {
  const theme = useSyncExternalStore(
    subscribePreferences,
    getThemePreference,
    () => 'system' as const,
  );
  return [theme, (value: ThemePreference) => savePreference('porta-theme', value)] as const;
}

export function useDensityPreference() {
  const density = useSyncExternalStore(
    subscribePreferences,
    getDensityPreference,
    () => 'compact' as const,
  );
  return [density, (value: DensityPreference) => savePreference('porta-density', value)] as const;
}

export function useSidebarPreference() {
  const collapsed = useSyncExternalStore(
    subscribePreferences,
    () => readPreference('porta-sidebar') === 'collapsed',
    () => false,
  );
  return [
    collapsed,
    (value: boolean) => savePreference('porta-sidebar', value ? 'collapsed' : 'expanded'),
  ] as const;
}

export function useApplyPreferences() {
  const [theme] = useThemePreference();
  const [density] = useDensityPreference();

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const preferredTheme = getThemePreference();
      const dark = preferredTheme === 'dark' || (preferredTheme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = getDensityPreference();
  }, [density]);
}
