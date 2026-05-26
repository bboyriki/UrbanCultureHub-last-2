import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initializeTranslations, languageFlags, languageNames } from '@/translations/index';
import enTranslations from '@/translations/en';
import nlTranslations from '@/translations/nl';

export type Language = 'en' | 'nl';

export type Translations = typeof enTranslations;

interface TranslationContextType {
  t: (key: string, params?: Record<string, any>) => string;
  language: Language;
  setLanguage: (language: Language) => void;
  isLoaded: boolean;
  languageFlag: string;
  languageName: string;
}

const allTranslations = {
  en: enTranslations,
  nl: nlTranslations
};

const TranslationContext = createContext<TranslationContextType>({
  t: (key: string) => key,
  language: 'en',
  setLanguage: () => {},
  isLoaded: false,
  languageFlag: languageFlags.en,
  languageName: languageNames.en
});

export function useTranslation() {
  return useContext(TranslationContext);
}

interface TranslationProviderProps {
  children: ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'nl')) {
      setLanguage(savedLanguage);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string, params?: Record<string, any>) => {
    if (!allTranslations[language]) {
      return key;
    }

    const keys = key.split('.');
    let value = allTranslations[language];
    
    for (const k of keys) {
      if (!value || typeof value !== 'object') {
        return key;
      }
      value = value[k];
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
        return acc.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, value);
    }

    return value;
  };

  return (
    <TranslationContext.Provider value={{ 
      t, 
      language, 
      setLanguage, 
      isLoaded,
      languageFlag: languageFlags[language],
      languageName: languageNames[language]
    }}>
      {children}
    </TranslationContext.Provider>
  );
}