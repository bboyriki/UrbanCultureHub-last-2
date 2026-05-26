import { useLanguage } from "@/contexts/LanguageContext";

export interface LocalizableEvent {
  title: string;
  description?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  [key: string]: any;
}

export function localizeEvent(event: LocalizableEvent, language: string) {
  const title =
    language === "en" && event.titleEn ? event.titleEn : event.title;
  const description =
    language === "en" && event.descriptionEn
      ? event.descriptionEn
      : event.description;
  return { ...event, title, description };
}

export function useLocalizedEvent() {
  const { language } = useLanguage();
  return (event: LocalizableEvent) => localizeEvent(event, language);
}
