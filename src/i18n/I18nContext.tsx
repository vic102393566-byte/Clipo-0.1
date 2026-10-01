import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Translations } from './types';
import { ptBR } from './locales/ptBR';
import { enUS } from './locales/enUS';

interface I18nContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const STORAGE_KEY = 'clipo_language';

const dictionaries: Record<Language, Translations> = {
  'pt-BR': ptBR,
  'en-US': enUS,
};

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as Language;
        if (saved === 'pt-BR' || saved === 'en-US') {
          return saved;
        }
      } catch (err) {
        console.warn('Could not read language from localStorage:', err);
      }
    }
    return 'pt-BR';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : 'en';
      } catch (err) {
        console.warn('Could not save language to localStorage:', err);
      }
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'pt-BR' ? 'pt-BR' : 'en';
    }
  }, [language]);

  const value: I18nContextProps = {
    language,
    setLanguage,
    t: dictionaries[language] || ptBR,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextProps {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
