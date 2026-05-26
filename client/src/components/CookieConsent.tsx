import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Cookie, Settings, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { forceStartTracking } from '@/lib/tracking';
import { isIOSNativeApp } from '@/lib/platformDetect';

const CONSENT_KEY = 'ucc_consent_v2';
const VISITOR_ID_KEY = 'ucc_visitor_id';

export interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

function generateVisitorId(): string {
  return 'v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
}

function getStoredConsent(): ConsentPreferences | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function storeConsent(consent: ConsentPreferences): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {}
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return generateVisitorId();
  }
}

async function saveConsentToServer(consent: ConsentPreferences): Promise<void> {
  const visitorId = getVisitorId();
  try {
    await fetch('/api/tracking/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        visitorId,
        essentialConsent: consent.essential,
        analyticsConsent: consent.analytics,
        marketingConsent: consent.marketing,
      }),
    });
  } catch (error) {
    console.error('Failed to save consent to server:', error);
  }
}

export function getConsentPreferences(): ConsentPreferences {
  const stored = getStoredConsent();
  return stored || { essential: true, analytics: false, marketing: false };
}

export function hasConsented(): boolean {
  return getStoredConsent() !== null;
}

export function getTrackingVisitorId(): string {
  return getVisitorId();
}

export default function CookieConsent() {
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // iOS native apps (Webtonative): NEVER show the cookie consent banner.
    // Apple App Store Review rejects apps that display cookie/tracking prompts
    // without using the ATT (App Tracking Transparency) framework, which is not
    // possible inside a WebView. Analytics collection on iOS is controlled silently
    // by the "iOS App Analytics" toggle in Admin → Feature Settings, and must be
    // disclosed in App Store Connect's App Privacy section — not via an in-app prompt.
    if (isIOSNativeApp()) return;

    const existing = getStoredConsent();
    if (!existing) {
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = async () => {
    const consent: ConsentPreferences = { essential: true, analytics: true, marketing: true };
    storeConsent(consent);
    setPreferences(consent);
    await saveConsentToServer(consent);
    setShowBanner(false);
    setTimeout(() => forceStartTracking(), 100);
  };

  const handleAcceptEssential = async () => {
    const consent: ConsentPreferences = { essential: true, analytics: false, marketing: false };
    storeConsent(consent);
    setPreferences(consent);
    await saveConsentToServer(consent);
    setShowBanner(false);
  };

  const handleSavePreferences = async () => {
    storeConsent(preferences);
    await saveConsentToServer(preferences);
    setShowPreferences(false);
    setShowBanner(false);
    if (preferences.analytics) {
      setTimeout(() => forceStartTracking(), 100);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <Card className="max-w-2xl mx-auto shadow-lg border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cookie className="h-5 w-5" />
              {t("cookie.settingsTitle")}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAcceptEssential}
              data-testid="button-close-cookie-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {t("cookie.body")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">
            {t("cookie.consent")}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 pt-2">
          <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-cookie-preferences">
                <Settings className="h-4 w-4 mr-2" />
                {t("cookie.preferences")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("cookie.prefTitle")}</DialogTitle>
                <DialogDescription>
                  {t("cookie.prefDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("cookie.essential")}</Label>
                    <p className="text-sm text-muted-foreground">{t("cookie.essentialDesc")}</p>
                  </div>
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="analytics-cookies">{t("cookie.analytics")}</Label>
                    <p className="text-sm text-muted-foreground">{t("cookie.analyticsDesc")}</p>
                  </div>
                  <Switch
                    id="analytics-cookies"
                    checked={preferences.analytics}
                    onCheckedChange={(checked) => setPreferences(p => ({ ...p, analytics: checked }))}
                    data-testid="switch-analytics-cookies"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketing-cookies">{t("cookie.marketing")}</Label>
                    <p className="text-sm text-muted-foreground">{t("cookie.marketingDesc")}</p>
                  </div>
                  <Switch
                    id="marketing-cookies"
                    checked={preferences.marketing}
                    onCheckedChange={(checked) => setPreferences(p => ({ ...p, marketing: checked }))}
                    data-testid="switch-marketing-cookies"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreferences(false)}>{t("cancel")}</Button>
                <Button onClick={handleSavePreferences} data-testid="button-save-cookie-preferences">{t("cookie.savePreferences")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleAcceptEssential} data-testid="button-accept-essential">
            {t("cookie.essentialOnly")}
          </Button>
          <Button size="sm" onClick={handleAcceptAll} data-testid="button-accept-all-cookies">
            {t("cookie.acceptAll")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
