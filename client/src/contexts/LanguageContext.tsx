import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define supported languages
export type Language = 'en' | 'nl' | 'ar';

// Interface for the language context
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Create the context with a default value
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Create translations storage
const translations: Record<Language, Record<string, string>> = {
  en: {},
  nl: {},
  ar: {},
};

// Load translations
export const loadTranslations = (lang: Language, data: Record<string, string>) => {
  translations[lang] = { ...translations[lang], ...data };
};

// Provider component that wraps the app
interface LanguageProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ 
  children,
  defaultLanguage = 'en'
}) => {
  // Get initial language from local storage or use default
  const getInitialLanguage = (): Language => {
    const savedLanguage = localStorage.getItem('language');
    return (savedLanguage === 'en' || savedLanguage === 'nl' || savedLanguage === 'ar')
      ? savedLanguage
      : defaultLanguage;
  };

  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  // Save language choice to local storage and update document direction
  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    if (!translations[language][key]) {
      // Fallback to English if translation doesn't exist
      return translations.en[key] || key;
    }
    return translations[language][key];
  };

  const value = {
    language,
    setLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use the language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};