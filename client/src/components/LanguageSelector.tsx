import React from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { languageFlags, languageNames } from '@/translations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showText?: boolean;
}

const LANGUAGES: { code: Language; flag: string; name: string; nativeName: string }[] = [
  { code: 'en', flag: '🇬🇧', name: 'English',    nativeName: 'English'    },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands', nativeName: 'Nederlands' },
  { code: 'ar', flag: '🇸🇾', name: 'Arabic',     nativeName: 'العربية'    },
];

export function LanguageSelector({ 
  variant = 'outline', 
  size = 'default',
  showText = true,
}: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  
  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="gap-2 min-w-0"
          data-testid="language-selector"
        >
          <Globe className="h-4 w-4 shrink-0" />
          {showText && (
            <span className="flex items-center gap-1.5">
              <span>{current.flag}</span>
              <span className="hidden sm:inline">{current.nativeName}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Site Language
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              language === lang.code && "bg-accent"
            )}
            data-testid={`language-option-${lang.code}`}
            dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
          >
            <span className="text-base w-6 text-center">{lang.flag}</span>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">{lang.nativeName}</span>
              {lang.nativeName !== lang.name && (
                <span className="text-[10px] text-muted-foreground">{lang.name}</span>
              )}
            </div>
            {language === lang.code && (
              <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Urban AI will automatically respond in your selected language
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
