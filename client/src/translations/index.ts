import { loadTranslations, Language } from '../contexts/LanguageContext';
import enTranslations from './en';
import nlTranslations from './nl';
import arTranslations from './ar';

// Initialize translations
export function initializeTranslations() {
  // Load English translations
  loadTranslations('en', enTranslations);
  
  // Load Dutch translations
  loadTranslations('nl', nlTranslations);

  // Load Arabic translations
  loadTranslations('ar', arTranslations);
}

// Flag icons mapping for language selector
export const languageFlags: Record<Language, string> = {
  en: '🇬🇧', // UK flag
  nl: '🇳🇱', // Netherlands flag
  ar: '🇸🇾', // Syria flag
};

// Language names for display
export const languageNames: Record<Language, string> = {
  en: 'English',
  nl: 'Nederlands',
  ar: 'العربية',
};