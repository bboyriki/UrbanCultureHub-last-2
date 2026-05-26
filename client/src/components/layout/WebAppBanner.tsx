import { useState } from "react";
import { X } from "lucide-react";
import { SiAppstore } from "react-icons/si";
import logoImage from "@assets/u9932826292_A_modern_dynamic_logo_for_Urban_Culture_-_a_creat__1773277819543.png";

const DISMISS_KEY = "web_app_banner_dismissed";

const APP_STORE_URL = "https://apps.apple.com/nl/app/urban-culture-hub/id6743952291?l=en-GB";

export default function WebAppBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="hidden md:flex w-full items-center justify-between gap-4 bg-primary/5 border-b border-primary/15 px-6 py-2.5">
      <div className="flex items-center gap-3">
        <img
          src={logoImage}
          alt="Urban Culture"
          className="w-9 h-9 rounded-xl object-cover ring-1 ring-primary/20 shadow-sm shrink-0"
        />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm tracking-tight">
            <span className="text-foreground">Urban</span>
            <span className="text-primary ml-1">Culture</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Where movement meets community
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1 hidden lg:block">
          Get the app for the full experience
        </span>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-app-store"
          className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 transition-colors rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0"
        >
          <SiAppstore size={14} />
          <span>Download on App Store</span>
        </a>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        data-testid="button-web-banner-dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1"
      >
        <X size={15} />
      </button>
    </div>
  );
}
