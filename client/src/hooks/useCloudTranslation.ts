import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

export function useCloudTranslation() {
  const { language } = useLanguage();

  const translate = async (text: string, context?: string): Promise<string> => {
    if (language === "en" || !text?.trim()) return text;
    try {
      const res = await apiRequest("POST", "/api/translate", {
        text,
        targetLang: language,
        context,
      });
      if (!res.ok) return text;
      const data = await res.json();
      return data.translated || text;
    } catch {
      return text;
    }
  };

  const needsTranslation = language !== "en";

  return { translate, needsTranslation, language };
}
