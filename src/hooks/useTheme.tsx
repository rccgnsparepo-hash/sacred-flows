import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Theme = 'light' | 'dark' | 'glass' | 'blur';

const VALID: Theme[] = ['light', 'dark', 'glass', 'blur'];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const { user } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('nsp-theme') as Theme | null;
    const t = saved && VALID.includes(saved) ? saved : 'light';
    setThemeState(t);
    applyTheme(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('theme_preference').eq('user_id', user.id).single().then(({ data }) => {
      const raw = data?.theme_preference as Theme | undefined;
      const t = raw && VALID.includes(raw) ? raw : 'light';
      setThemeState(t);
      applyTheme(t);
      localStorage.setItem('nsp-theme', t);
    });
  }, [user]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem('nsp-theme', t);
    if (user) {
      supabase.from('profiles').update({ theme_preference: t }).eq('user_id', user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'glass', 'blur', 'cyberpunk', 'minimal');
  if (theme !== 'light') root.classList.add(theme);
}

export function useTheme() {
  return useContext(ThemeContext);
}
