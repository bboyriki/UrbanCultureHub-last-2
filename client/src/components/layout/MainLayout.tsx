import { ReactNode } from "react";
import { useLocation } from "wouter";
import AppHeader from "./AppHeader";
import LocationBanner from "./LocationBanner";
import BottomNav from "./BottomNav";
import WebAppBanner from "./WebAppBanner";
import AppFooter from "./AppFooter";

interface MainLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  className?: string;
  fullWidth?: boolean;
  noPadding?: boolean;
}

export default function MainLayout({
  children,
  showHeader = true,
  className = "",
  fullWidth = false,
  noPadding = false,
}: MainLayoutProps) {
  const [pathname] = useLocation();
  const isChat = pathname.startsWith("/chat");

  return (
    <div className={`flex flex-col min-h-screen w-full bg-background transition-colors duration-300 ${className}`}>
      {showHeader && <WebAppBanner />}
      {showHeader && <AppHeader />}
      {showHeader && <LocationBanner />}

      <main
        className={[
          "flex-grow w-full",
          !fullWidth
            ? "max-w-full mx-auto sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1320px]"
            : "",
          !noPadding ? "px-4 sm:px-6 lg:px-8" : "",
          !isChat ? "pb-[calc(60px+env(safe-area-inset-bottom,0px)+8px)] md:pb-4" : "pb-0",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </main>

      <AppFooter />
      {showHeader && <BottomNav />}
    </div>
  );
}
