import React, { Suspense, lazy, useEffect, useState, Component, ErrorInfo } from "react";
import { applyTheme as _applyThemeUtil, type FullThemeConfig } from "@/lib/themeUtils";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ShoppingCartProvider } from "@/contexts/ShoppingCartContext";
import { WebSocketProvider } from "@/contexts/WebSocketSingletonContext";
import { CallProvider } from "@/contexts/CallContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { queryClient } from "./lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import LocationSetupModal, { shouldShowLocationModal } from "@/components/modals/LocationSetupModal";
import MainLayout from "@/components/layout/MainLayout";
import AuthWrapper from "@/components/layout/AuthWrapper";
import ServicesGate from "@/components/services/ServicesGate";
import SafeBookingsBoundary from "@/components/services/SafeBookingsBoundary";
import CookieConsent from "@/components/CookieConsent";
import { initTracking, setIOSTrackingEnabled } from "@/lib/tracking";
import { initializeTranslations } from "@/translations";
import TermsPromptHandler from "@/components/terms/TermsPromptHandler";
import LegalAcceptanceDialog from "@/components/legal/LegalAcceptanceDialog";
import WebSocketSubscriber from "@/components/notifications/WebSocketSubscriber";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import PermissionsOnboarding from "@/components/PermissionsOnboarding";
import WelcomeSlides, { shouldShowWelcome } from "@/components/WelcomeSlides";
import VirtualTour, { VIRTUAL_TOUR_KEY } from "@/components/VirtualTour";
import AppleReviewTour, { APPLE_REVIEW_TOUR_KEY, APPLE_REVIEW_ACCOUNT } from "@/components/AppleReviewTour";
import { AdminLayout } from "@/components/admin/AdminLayout";

// Detects transient network / chunk-load failures that should trigger an
// automatic reload rather than showing an error screen to the user.
// Covers: Vite dynamic import failures, MIME type errors, fetch errors,
// and the various error shapes WKWebView/Safari emit on iOS.
function isChunkLoadError(error: Error): boolean {
  const msg = (error?.message || "").toLowerCase();
  const name = (error?.name || "").toLowerCase();
  return (
    msg.includes("text/html") ||
    msg.includes("mime type") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    msg.includes("chunkloaderror") ||
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("the network connection was lost") ||
    msg.includes("dynamically imported module") ||
    name === "chunkloaderror"
  );
}

// Retries a failing dynamic import a few times before giving up — the most
// common cause of "Something went wrong" on iOS is a single dropped chunk
// fetch. Two extra attempts with backoff fixes the vast majority of cases.
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastErr = err;
        if (!(err instanceof Error) || !isChunkLoadError(err)) break;
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastErr;
  });
}

class AdminErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null; reloading: boolean }
> {
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, reloading: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AdminErrorBoundary] Caught error:", error, info);
    // Auto-recover from transient network errors. We also try one silent reload
    // for unknown errors that look chunk-load-shaped (no message, generic Error)
    // since admin chunks fail to load most often on flaky mobile connections.
    const sessionKey = "__adminAutoReloadOnce";
    const looksTransient = isChunkLoadError(error) || !error?.message;
    if (looksTransient && !sessionStorage.getItem(sessionKey)) {
      try { sessionStorage.setItem(sessionKey, "1"); } catch {}
      this.setState({ reloading: true });
      this.reloadTimer = setTimeout(() => window.location.reload(), 1500);
    }
  }
  componentWillUnmount() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }
  render() {
    if (!this.state.error) return this.props.children;

    if (this.state.reloading || isChunkLoadError(this.state.error)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Refreshing…</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <p className="text-muted-foreground text-center max-w-md text-sm">
          Something went wrong in the admin panel. Please try again.
        </p>
        <button
          onClick={() => this.setState({ error: null, reloading: false })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }
}

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null; reloading: boolean }
> {
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, reloading: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error, info);
    // Chunk-load / MIME errors are transient — reload silently after a short pause.
    // Use a sessionStorage one-shot guard so a persistent failure does NOT
    // produce an infinite reload loop (which DDOSes the dev server and triggers
    // 429 rate limits).
    const sessionKey = "__appAutoReloadOnce";
    if (isChunkLoadError(error) && !sessionStorage.getItem(sessionKey)) {
      try { sessionStorage.setItem(sessionKey, "1"); } catch {}
      this.setState({ reloading: true });
      this.reloadTimer = setTimeout(() => window.location.reload(), 2500);
    }
  }
  componentWillUnmount() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }
  render() {
    if (!this.state.error) return this.props.children;

    // Transient network error → show a gentle "refreshing" spinner, then reload
    if (this.state.reloading || isChunkLoadError(this.state.error)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Just a moment…</p>
        </div>
      );
    }

    // Real application error → friendly message without exposing raw details
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5 p-8 bg-background">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            An unexpected error occurred. Try refreshing the page — your data is safe.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium"
        >
          Refresh
        </button>
      </div>
    );
  }
}

// Per-route safe boundary for the Back to the Street page. If the heavy page
// crashes (e.g. transient "Invalid hook call" caused by HMR/Vite chunk state),
// show a minimal fallback landing so the menu still opens instead of crashing
// the whole shell or triggering a reload loop.
class SafeBttsBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null; reloading: boolean }
> {
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, reloading: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SafeBttsBoundary] BTTS page crashed, showing fallback:", error, info);
    // Auto-reload on stale chunk / network errors (same pattern as AdminErrorBoundary)
    const sessionKey = "__bttsAutoReloadOnce";
    if (isChunkLoadError(error) && !sessionStorage.getItem(sessionKey)) {
      try { sessionStorage.setItem(sessionKey, "1"); } catch {}
      this.setState({ reloading: true });
      this.reloadTimer = setTimeout(() => window.location.reload(), 1500);
    }
  }
  componentWillUnmount() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.reloading) {
      return (
        <div style={{ minHeight: "100vh", background: "#0d1117", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(249,115,22,0.3)", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ opacity: 0.7, fontSize: 14 }}>Reloading…</p>
        </div>
      );
    }
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", color: "white", padding: "48px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>
            Back to the Street
          </h1>
          <p style={{ opacity: 0.7, fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
            The festival page is temporarily unavailable while we resolve a loading issue.
            Tickets, lineup and program info will be back shortly.
          </p>
          <button
            onClick={() => { try { sessionStorage.removeItem("__bttsAutoReloadOnce"); } catch {} window.location.reload(); }}
            style={{ padding: "10px 20px", background: "#f97316", color: "white", border: 0, borderRadius: 999, fontWeight: 600, cursor: "pointer", marginRight: 12 }}
            data-testid="button-btts-retry"
          >
            Try again
          </button>
          <a
            href="/"
            style={{ padding: "10px 20px", background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
            data-testid="link-btts-home"
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }
}

// ─── Lazy-loaded page components ─────────────────────────────────────────────
// Only the shell (contexts + layout) loads eagerly; every page is split out.

const Home                      = lazyWithRetry(() => import("@/pages/home"));
const Auth                      = lazyWithRetry(() => import("@/pages/auth"));
const ForgotPassword            = lazyWithRetry(() => import("@/pages/ForgotPassword"));
const NotFound                  = lazyWithRetry(() => import("@/pages/not-found"));
const ExplorePage               = lazyWithRetry(() => import("@/pages/explore"));
const ReelsPage                 = lazyWithRetry(() => import("@/pages/reels"));
const NearbyPage                = lazyWithRetry(() => import("@/pages/nearby"));

// Map / location
const MapView                   = lazyWithRetry(() => import("@/components/map/MapView"));
const MapLandingPage            = lazyWithRetry(() => import("@/pages/map-landing"));
const EventsMapPage             = lazyWithRetry(() => import("@/pages/map/events"));
const JourneyMapPage            = lazyWithRetry(() => import("@/pages/map/journey"));
const SpotManagement            = lazyWithRetry(() => import("@/pages/map/SpotManagement"));
const SpotEditPage              = lazyWithRetry(() => import("@/pages/map/edit/[id]"));
const LocationDetails           = lazyWithRetry(() => import("@/pages/locations/LocationDetails"));

// Events
const EventsView                = lazyWithRetry(() => import("@/components/events/EventsView"));
const EventDetails              = lazyWithRetry(() => import("@/pages/events/EventDetails").then(m => ({ default: m.EventDetails })));
const EventSales                = lazyWithRetry(() => import("@/pages/events/EventSales"));
const EventOrganizerDashboard   = lazyWithRetry(() => import("@/pages/events/organizer"));

// Community / social
const CommunityView             = lazyWithRetry(() => import("@/components/community/CommunityView"));
const GroupsPage                = lazyWithRetry(() => import("@/pages/community/GroupsPage"));
const GroupDetailPage           = lazyWithRetry(() => import("@/pages/community/GroupDetailPage"));
const ReelsCreatorStudio        = lazyWithRetry(() => import("@/pages/reels"));

// Profile / user
const ProfileView               = lazyWithRetry(() => import("@/components/profile/ProfileView"));
const UserProfilePage           = lazyWithRetry(() => import("@/pages/profile/[id]"));
const SettingsPage              = lazyWithRetry(() => import("@/pages/settings"));
const NotificationsPage         = lazyWithRetry(() => import("@/pages/notifications"));

// Marketplace
const MarketplacePage           = lazyWithRetry(() => import("@/pages/marketplace"));
const ProductDetailPage         = lazyWithRetry(() => import("@/pages/marketplace/[id]"));
const EditProductPage           = lazyWithRetry(() => import("@/pages/marketplace/edit/[id]"));
const CheckoutSuccessPage       = lazyWithRetry(() => import("@/pages/marketplace/checkout/success"));
const TestPaymentPage           = lazyWithRetry(() => import("@/pages/marketplace/test-payment"));
const ProductSales              = lazyWithRetry(() => import("@/pages/marketplace/ProductSales"));
const MarketplaceSeller         = lazyWithRetry(() => import("@/pages/marketplace/seller"));

// Services
const ServicesPage              = lazyWithRetry(() => import("@/pages/services"));
const ServiceDetailPage         = lazyWithRetry(() => import("@/pages/services/[id]"));
const CreateServicePage         = lazyWithRetry(() => import("@/pages/services/create"));
const EditServicePage           = lazyWithRetry(() => import("@/pages/services/edit/[id]"));
const MyServicesPage            = lazyWithRetry(() => import("@/pages/services/my-services"));
const ManageServiceBookingsPage = lazyWithRetry(() => import("@/pages/services/manage/[id]"));
const ServiceSales              = lazyWithRetry(() => import("@/pages/services/ServiceSales"));
const ServiceProviderDashboard  = lazyWithRetry(() => import("@/pages/services/provider"));

// Bookings / orders / tickets
const BookingsPage              = lazyWithRetry(() => import("@/pages/bookings"));
const OrdersPage                = lazyWithRetry(() => import("@/pages/orders"));
const OrderDetailsPage          = lazyWithRetry(() => import("@/pages/orders/[id]"));
const TicketSuccess             = lazyWithRetry(() => import("@/pages/tickets/TicketSuccess"));
const TicketDetailPage          = lazyWithRetry(() => import("@/pages/tickets/[id]"));

// Spots
const SpotOwnerDashboard        = lazyWithRetry(() => import("@/pages/spots/owner"));
const SpotlightDetail           = lazyWithRetry(() => import("@/pages/spots/SpotlightDetail"));
const CitySpotDetail            = lazyWithRetry(() => import("@/pages/spots/CitySpotDetail"));

// Chat
const ChatPage                  = lazyWithRetry(() => import("@/pages/chat"));

// Native diagnostics
const NativeCheckPage           = lazyWithRetry(() => import("@/pages/native-check"));

// AI / tools
const AiAgentPage               = lazyWithRetry(() => import("@/pages/ai-agent"));
const AIToolsPage               = lazyWithRetry(() => import("@/pages/ai"));

// Judge / Live
const JudgePanel                = lazyWithRetry(() => import("@/pages/judge-panel"));
const LiveResults               = lazyWithRetry(() => import("@/pages/live-results"));

// Competitions
const CompetitionsPage          = lazyWithRetry(() => import("@/pages/competitions"));
const AdminCompetitionsPage     = lazyWithRetry(() => import("@/pages/admin/competitions"));
const AdminMarketplaceAnalyticsPage = lazyWithRetry(() => import("@/pages/admin/marketplace-analytics"));

// Payment
const PaymentRedirectPage       = lazyWithRetry(() => import("@/pages/PaymentRedirectPage"));

// New Features
const CredPage                  = lazyWithRetry(() => import("@/pages/cred"));
const CrewsPage                 = lazyWithRetry(() => import("@/pages/crews"));
const CrewDetailPage            = lazyWithRetry(() => import("@/pages/crews/[id]"));
const ChallengesPage            = lazyWithRetry(() => import("@/pages/challenges"));
const CyphersPage               = lazyWithRetry(() => import("@/pages/cyphers"));
const GraffitiWallPage          = lazyWithRetry(() => import("@/pages/graffiti"));
const BeatLabPage               = lazyWithRetry(() => import("@/pages/beat-lab"));
const HallOfFamePage            = lazyWithRetry(() => import("@/pages/hall-of-fame"));
const CultureToolsPage          = lazyWithRetry(() => import("@/pages/culture-tools"));

// Legal / info
const TermsOfServicePage        = lazyWithRetry(() => import("@/pages/terms-of-service"));
const PrivacyPolicyPage         = lazyWithRetry(() => import("@/pages/privacy-policy"));
const DataDeletionPage          = lazyWithRetry(() => import("@/pages/data-deletion"));
const AppPermissionsPage        = lazyWithRetry(() => import("@/pages/app-permissions"));
const LegalHubPage              = lazyWithRetry(() => import("@/pages/legal-hub"));
const ContactPage               = lazyWithRetry(() => import("@/pages/contact"));

// Admin
const AdminView                 = lazyWithRetry(() => import("@/components/admin/AdminView"));
const AdminLogin                = lazyWithRetry(() => import("@/components/admin/AdminLogin"));
const CreateAdminUser           = lazyWithRetry(() => import("@/components/admin/CreateAdminUser"));
const CreateAdminWithEmail      = lazyWithRetry(() => import("@/components/admin/CreateAdminWithEmail"));
const TestEventPage             = lazyWithRetry(() => import("@/pages/admin/test-event"));
const AdminMarketingPage        = lazyWithRetry(() => import("@/pages/admin/marketing"));
const AdminAdsHubPage           = lazyWithRetry(() => import("@/pages/admin/ads-hub"));
const AdminCareerPage           = lazyWithRetry(() => import("@/pages/admin/career"));
const PortfolioPublicPage       = lazyWithRetry(() => import("@/pages/portfolio-public"));
const AdminAnalyticsPage        = lazyWithRetry(() => import("@/pages/admin/analytics"));
const AdminTestProductPage      = lazyWithRetry(() => import("@/pages/admin/test-product"));
const TestOrderPage             = lazyWithRetry(() => import("@/pages/admin/test-order"));
const TestWebSocketPage         = lazyWithRetry(() => import("@/pages/admin/test-websocket"));
const TestOrderNotificationPage = lazyWithRetry(() => import("@/pages/admin/test-order-notification"));
const AdminServiceBookingsPage  = lazyWithRetry(() => import("@/pages/admin/service-bookings"));
const DataDeletionRequestsPage  = lazyWithRetry(() => import("@/pages/admin/data-deletion-requests"));
const LegalManagementPage       = lazyWithRetry(() => import("@/pages/admin/legal-management"));
const ExploreImagesPage         = lazyWithRetry(() => import("@/pages/admin/explore-images"));
const AIStudioPage              = lazyWithRetry(() => import("@/pages/admin/ai-studio"));
const AdminCreatorStudioPage    = lazyWithRetry(() => import("@/pages/admin/creator-studio"));
const AdminAIAccessPage         = lazyWithRetry(() => import("@/pages/admin/ai-access"));
const MyProfilePage             = lazyWithRetry(() => import("@/pages/admin/my-profile"));
const AdminSpotCreatorsPage     = lazyWithRetry(() => import("@/pages/admin/spot-creators"));
const AdminSpotsOverviewPage    = lazyWithRetry(() => import("@/pages/admin/spots-overview"));
const AdminSpotAssignmentsPage  = lazyWithRetry(() => import("@/pages/admin/spot-assignments"));
const AIPremiumSuccessPage      = lazyWithRetry(() => import("@/pages/AIPremiumSuccess"));
const AIAssistantPage           = lazyWithRetry(() => import("@/pages/ai-assistant"));
const AdminReelsPage            = lazyWithRetry(() => import("@/pages/admin/reels"));
const ElevenLabsAdminPage       = lazyWithRetry(() => import("@/pages/admin/elevenlabs"));
const LiveViewersPage           = lazyWithRetry(() => import("@/pages/admin/live-viewers"));
const FeatureSettingsPage       = lazyWithRetry(() => import("@/pages/admin/feature-settings"));
const ThemeControlPage          = lazyWithRetry(() => import("@/pages/admin/theme-control"));
const HomepageBuilderPage       = lazyWithRetry(() => import("@/pages/admin/homepage-builder"));
// Proper component for /admin redirect — avoids Rules of Hooks violation
function AdminRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/admin/overview", { replace: true }); }, []);
  return null;
}

const SecurityCenterPage        = lazyWithRetry(() => import("@/pages/admin/security-center"));
const ControlCenterPage         = lazyWithRetry(() => import("@/pages/admin/control-center"));
const AdminOverviewPage         = lazyWithRetry(() => import("@/pages/admin/overview"));
const AdminMemoryCalendarPage   = lazyWithRetry(() => import("@/pages/admin/memory-calendar"));
const AdminLegalAssistantPage   = lazyWithRetry(() => import("@/pages/admin/legal-assistant"));
const AdminEmailWriterPage      = lazyWithRetry(() => import("@/pages/admin/email-writer"));
const AdminBroadcastPage        = lazyWithRetry(() => import("@/pages/admin/broadcast"));
const AdminModerationPage       = lazyWithRetry(() => import("@/pages/admin/moderation"));
const TrendingPage              = lazyWithRetry(() => import("@/pages/trending"));
const ProgrammePage             = lazyWithRetry(() => import("@/pages/programme"));
const ProgrammeEventsPage       = lazyWithRetry(() => import("@/pages/programme/events"));
const MyReservationsPage        = lazyWithRetry(() => import("@/pages/programme/my-reservations"));
const AdminProgrammePage        = lazyWithRetry(() => import("@/pages/admin/programme"));
const AdminPollsPage            = lazyWithRetry(() => import("@/pages/admin/polls"));
const AdminSharePermissionsPage = lazyWithRetry(() => import("@/pages/admin/share-permissions"));
const AdminAiControlPage        = lazyWithRetry(() => import("@/pages/admin/ai-control"));
const AdminAiAppContentPage     = lazyWithRetry(() => import("@/pages/admin/ai-app-content"));
const AdminTikTokPage           = lazyWithRetry(() => import("@/pages/admin/tiktok"));
const AdminInstagramPage        = lazyWithRetry(() => import("@/pages/admin/instagram"));
const AdminSnapchatPage         = lazyWithRetry(() => import("@/pages/admin/snapchat"));
const AdminLinkedInPage         = lazyWithRetry(() => import("@/pages/admin/linkedin"));
const AdminLeadExportPage       = lazyWithRetry(() => import("@/pages/admin/lead-export"));
const AdminPushPage             = lazyWithRetry(() => import("@/components/admin/AdminPushNotifications"));
const AdminApiKeysPage          = lazyWithRetry(() => import("@/pages/admin/api-keys"));
const AdminChatControlPage      = lazyWithRetry(() => import("@/pages/admin/chat-control"));
const BackToTheStreetPage       = lazyWithRetry(() => import("@/pages/back-to-the-street"));
const OwnerDashboardPage        = lazyWithRetry(() => import("@/pages/owner-dashboard"));

// Dev / test / misc
const TestSubscription          = lazyWithRetry(() => import("@/pages/test-subscription"));
const TestNotificationPage      = lazyWithRetry(() => import("@/pages/test-notification"));
const NotificationTestPage      = lazyWithRetry(() => import("@/pages/notification-test"));
const WebSocketDemoPage         = lazyWithRetry(() => import("@/pages/websocket-demo"));
const IdealTestPage             = lazyWithRetry(() => import("@/pages/IdealTestPage"));
const TestProductPage           = lazyWithRetry(() => import("@/pages/TestProductPage"));
const ShareTestPage             = lazyWithRetry(() => import("@/pages/share-test"));

// ─────────────────────────────────────────────────────────────────────────────

const fullWidthRoutes = ['/map', '/map/events'];
const noPaddingRoutes  = ['/map', '/map/events'];

initializeTranslations();

const PageLoader = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-0.5 bg-primary animate-pulse w-full" />
    </div>
  );
};

function LocationSetupHandler() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: presence, isLoading } = useQuery<any>({
    queryKey: ["/api/proximity/my-presence"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!user || isLoading) return;
    if (shouldShowLocationModal(user, presence)) {
      const timer = setTimeout(() => setModalOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, presence, isLoading]);

  return (
    <LocationSetupModal open={modalOpen} onClose={() => setModalOpen(false)} />
  );
}

function PushSetup() {
  usePushNotifications();
  return null;
}

const PUBLIC_LEGAL_PATHS = ["/privacy-policy", "/terms-of-service", "/data-deletion", "/legal-hub"];

function WelcomeGate({ children }: { children: React.ReactNode }) {
  const [showWelcome, setShowWelcome] = useState(() => shouldShowWelcome());
  const [location] = useLocation();
  if (showWelcome && !PUBLIC_LEGAL_PATHS.includes(location)) {
    return <WelcomeSlides onDone={() => setShowWelcome(false)} />;
  }
  return <>{children}</>;
}


const BUILTIN_THEMES: Record<string, FullThemeConfig> = {
  original:    { id:"original",   light:{primary:"221 83% 53%",background:"0 0% 99%",     card:"0 0% 100%",   accent:"220 14% 94%",muted:"220 14% 95%",border:"220 13% 91%"}, dark:{primary:"221 83% 60%",background:"222 17% 7%",  card:"222 17% 10%",accent:"222 17% 16%",muted:"222 17% 14%",border:"222 17% 20%"} },
  neon_city:   { id:"neon_city",  light:{primary:"268 90% 55%",background:"268 30% 99%",  card:"268 20% 100%",accent:"268 25% 95%",muted:"268 20% 96%",border:"268 20% 90%"}, dark:{primary:"268 90% 68%",background:"268 25% 6%",  card:"268 22% 10%",accent:"268 22% 16%",muted:"268 22% 13%",border:"268 22% 20%"} },
  graffiti:    { id:"graffiti",   light:{primary:"20 95% 52%", background:"20 30% 99%",   card:"20 15% 100%", accent:"20 20% 95%", muted:"20 15% 96%", border:"20 15% 90%"}, dark:{primary:"20 95% 62%", background:"20 20% 7%",   card:"20 18% 10%", accent:"20 18% 16%",muted:"20 18% 13%",border:"20 18% 20%"} },
  golden_era:  { id:"golden_era", light:{primary:"38 92% 48%", background:"38 40% 99%",   card:"38 25% 100%", accent:"38 30% 95%", muted:"38 25% 96%", border:"38 20% 90%"}, dark:{primary:"38 92% 58%", background:"30 20% 7%",   card:"30 18% 10%", accent:"30 18% 16%",muted:"30 18% 13%",border:"30 18% 20%"} },
  teal_wave:   { id:"teal_wave",  light:{primary:"172 85% 38%",background:"172 30% 99%",  card:"172 15% 100%",accent:"172 20% 95%",muted:"172 15% 96%",border:"172 15% 90%"}, dark:{primary:"172 85% 50%",background:"172 20% 7%",  card:"172 18% 10%",accent:"172 18% 16%",muted:"172 18% 13%",border:"172 18% 20%"} },
  red_flame:   { id:"red_flame",  light:{primary:"0 85% 52%",  background:"0 30% 99%",    card:"0 15% 100%",  accent:"0 20% 95%",  muted:"0 15% 96%",  border:"0 15% 91%"},  dark:{primary:"0 85% 62%",  background:"0 20% 7%",    card:"0 18% 10%",  accent:"0 18% 16%", muted:"0 18% 13%", border:"0 18% 20%"} },
  pink_future: { id:"pink_future",light:{primary:"330 85% 52%",background:"330 30% 99%",  card:"330 15% 100%",accent:"330 20% 95%",muted:"330 15% 96%",border:"330 15% 91%"}, dark:{primary:"330 85% 65%",background:"330 20% 7%",  card:"330 18% 10%",accent:"330 18% 16%",muted:"330 18% 13%",border:"330 18% 20%"} },
  cyber_green: { id:"cyber_green",light:{primary:"142 71% 40%",background:"142 30% 99%",  card:"142 15% 100%",accent:"142 20% 95%",muted:"142 15% 96%",border:"142 15% 91%"}, dark:{primary:"142 71% 52%",background:"142 20% 7%",  card:"142 18% 10%",accent:"142 18% 16%",muted:"142 18% 13%",border:"142 18% 20%"} },
  midnight:    { id:"midnight",   light:{primary:"226 71% 40%",background:"226 30% 99%",  card:"226 15% 100%",accent:"226 20% 95%",muted:"226 15% 96%",border:"226 15% 91%"}, dark:{primary:"226 80% 65%",background:"226 35% 5%",  card:"226 30% 8%", accent:"226 25% 14%",muted:"226 25% 11%",border:"226 25% 18%"} },
  copper:      { id:"copper",     light:{primary:"29 60% 45%", background:"29 25% 99%",   card:"29 15% 100%", accent:"29 20% 95%", muted:"29 15% 96%", border:"29 15% 91%"}, dark:{primary:"29 65% 58%", background:"29 20% 7%",   card:"29 18% 10%", accent:"29 18% 16%",muted:"29 18% 13%",border:"29 18% 20%"} },
};

/**
 * Fetches platform settings (iOS tracking toggle, active theme) once on app start
 * and applies them globally. Admin theme overrides all user preferences.
 */
function PlatformSettingsSync() {
  useEffect(() => {
    fetch("/api/app-settings", { credentials: "include" })
      .then((r) => r.json())
      .then((settings: Record<string, string>) => {
        // /api/app-settings returns a flat object { key: value }
        const get = (k: string) => settings[k] as string | undefined;

        // iOS tracking toggle
        const enabled = get("ios_tracking_enabled") === "true";
        setIOSTrackingEnabled(enabled);
        if (enabled) initTracking();

        // Theme injection — admin override wins
        const scheduleEnabled = get("theme_schedule_enabled") === "true";
        let activeId = get("active_theme_id") || "original";

        if (scheduleEnabled) {
          try {
            const sched = JSON.parse(get("theme_schedule") || "{}") as Record<string, string>;
            const todayKey = new Date().getDay().toString();
            if (sched[todayKey]) activeId = sched[todayKey];
          } catch {}
        }

        if (activeId === "original") return; // Let user theme apply naturally

        // Check builtin themes first
        const builtin = BUILTIN_THEMES[activeId];
        if (builtin) { _applyThemeUtil(builtin); return; }

        // Fall back to stored full config (for AI-generated themes)
        try {
          const cfg = JSON.parse(get("active_theme_config") || "null") as FullThemeConfig | null;
          if (cfg?.light && cfg?.dark) _applyThemeUtil(cfg);
        } catch {}
      })
      .catch(() => {});
  }, []);
  return null;
}

function VirtualTourOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    // Skip regular tour for the Apple review demo account
    if ((user as any).email === APPLE_REVIEW_ACCOUNT) return;
    const key = VIRTUAL_TOUR_KEY(user.id);
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  const dismiss = () => {
    if (user?.id) localStorage.setItem(VIRTUAL_TOUR_KEY(user.id), "1");
    setShow(false);
  };

  if (!show) return null;
  return <VirtualTour onDone={dismiss} />;
}

function AppleReviewTourOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if ((user as any).email !== APPLE_REVIEW_ACCOUNT) return;
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, [user?.id]);

  const dismiss = () => {
    setShow(false);
  };

  if (!show) return null;
  return <AppleReviewTour onDone={dismiss} />;
}

function App() {
  useEffect(() => { initTracking(); }, []);
  useEffect(() => {
    import("@/lib/adsTracking").then(m => m.captureLanding()).catch(() => {});
  }, []);

  // Prefetch the 4 main nav pages in the background after initial render.
  // This ensures clicking Home / Events / Community / Nearby never stalls
  // on a chunk download — the JS is already in the browser cache.
  useEffect(() => {
    const prefetchChunks = () => {
      import("@/components/events/EventsView");
      import("@/components/community/CommunityView");
      import("@/components/map/MapView");
      import("@/pages/nearby");
      import("@/components/profile/ProfileView");
      import("@/pages/notifications");
      import("@/pages/chat");
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(prefetchChunks, { timeout: 3000 });
    } else {
      setTimeout(prefetchChunks, 1000);
    }
  }, []);

  // Also prefetch the API data for main pages so navigation is instant.
  // Data lands in TanStack Query cache (staleTime: Infinity) — no re-fetch on nav.
  useEffect(() => {
    const prefetchData = () => {
      queryClient.prefetchQuery({ queryKey: ["/api/events"] });
      queryClient.prefetchQuery({ queryKey: ["/api/city-spots/spotlights"] });
      queryClient.prefetchQuery({ queryKey: ["/api/locations"] });
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(prefetchData, { timeout: 5000 });
    } else {
      setTimeout(prefetchData, 2000);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="urban-culture-theme">
        <LanguageProvider defaultLanguage="en">
          <AuthProvider>
            <WebSocketProvider>
              <CallProvider>
              <NotificationsProvider>
                <ShoppingCartProvider>
                  <PlatformSettingsSync />
                  <WebSocketSubscriber />
                  <PushSetup />
                  <LocationSetupHandler />
                  <WelcomeGate>
                  <VirtualTourOverlay />
                  <AppleReviewTourOverlay />
                  <PermissionsOnboarding />
                  <AppErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Switch>

                      <Route path="/">
                        {() => (
                          <MainLayout fullWidth noPadding>
                            <Home />
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/auth" component={Auth} />
                      <Route path="/forgot-password" component={ForgotPassword} />

                      <Route path="/explore">
                        {() => <MainLayout><ExplorePage /></MainLayout>}
                      </Route>

                      <Route path="/map/journey">
                        {() => <JourneyMapPage />}
                      </Route>

                      <Route path="/map">
                        {() => (
                          <MainLayout fullWidth noPadding>
                            <AuthWrapper requireAuth={false}><MapView /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/map/spots/:id/manage">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><SpotManagement /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/map/spots/:id/edit">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><SpotEditPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/spots/owner">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><SpotOwnerDashboard /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/my-spots">
                        {() => (
                          <MainLayout noPadding>
                            <AuthWrapper requireAuth={true}><OwnerDashboardPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/spots/spotlight/:id">
                        {() => (
                          <MainLayout>
                            <SpotlightDetail />
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/spots/city/:id">
                        {() => (
                          <MainLayout>
                            <CitySpotDetail />
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/events">
                        {() => <MainLayout><EventsView /></MainLayout>}
                      </Route>

                      <Route path="/battles">
                        {() => <MainLayout><EventsView /></MainLayout>}
                      </Route>

                      <Route path="/community">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={false}><CommunityView /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/community/groups">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={false}><GroupsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/community/groups/:id">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={false}><GroupDetailPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/reels">
                        {() => <ReelsPage />}
                      </Route>

                      <Route path="/profile">
                        {() => {
                          const { user } = useAuth();
                          const [, navigate] = useLocation();
                          useEffect(() => { if (user) navigate(`/profile/${user.id}`); }, [user]);
                          return (
                            <MainLayout>
                              <AuthWrapper requireAuth={true}><div>Redirecting to profile…</div></AuthWrapper>
                            </MainLayout>
                          );
                        }}
                      </Route>

                      <Route path="/profile/tickets">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><ProfileView /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/admin" component={AdminRedirect} />

                      {/* /admin/tools — full AdminView SPA with all classic admin features
                          (Ticket Scanner, Spotlight, Business Verification, Email Inbox,
                           LinkedIn, Funding, Safety Monitor, etc.) */}
                      <Route path="/admin/tools">
                        {() => (
                          <MainLayout fullWidth noPadding>
                            <AdminErrorBoundary>
                              <AdminView />
                            </AdminErrorBoundary>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/create-admin-user" component={CreateAdminUser} />
                      <Route path="/admin-login" component={AdminLogin} />
                      <Route path="/create-admin-with-email" component={CreateAdminWithEmail} />

                      <Route path="/marketplace">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={false}><MarketplacePage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/marketplace/test-payment">
                        {() => <MainLayout><TestPaymentPage /></MainLayout>}
                      </Route>

                      <Route path="/marketplace/checkout/success">
                        {() => <MainLayout><CheckoutSuccessPage /></MainLayout>}
                      </Route>

                      <Route path="/marketplace/seller">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><MarketplaceSeller /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/marketplace/edit/:id">
                        {() => <MainLayout><EditProductPage /></MainLayout>}
                      </Route>

                      <Route path="/marketplace/sales">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><ProductSales /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/marketplace/:id/sales">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><ProductSales /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/marketplace/:id">
                        {() => <MainLayout><ProductDetailPage /></MainLayout>}
                      </Route>

                      {/* Services — every surface is gated behind the
                          talent_marketplace_locked feature flag. Admins always
                          pass through; everyone else gets a calm "Coming Soon"
                          screen. SafeBookingsBoundary catches any runtime
                          error so the booking flow can never white-screen. */}
                      <Route path="/services/create">
                        {() => (
                          <MainLayout>
                            <ServicesGate>
                              <SafeBookingsBoundary><CreateServicePage /></SafeBookingsBoundary>
                            </ServicesGate>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services/my-services">
                        {() => (
                          <MainLayout>
                            <ServicesGate title="My Services">
                              <SafeBookingsBoundary label="Couldn't load your services right now"><MyServicesPage /></SafeBookingsBoundary>
                            </ServicesGate>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services/provider">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}>
                              <ServicesGate title="Provider Dashboard">
                                <SafeBookingsBoundary><ServiceProviderDashboard /></SafeBookingsBoundary>
                              </ServicesGate>
                            </AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services/edit/:id">
                        {() => (
                          <MainLayout>
                            <ServicesGate>
                              <SafeBookingsBoundary><EditServicePage /></SafeBookingsBoundary>
                            </ServicesGate>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services/:id/manage">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}>
                              <ServicesGate title="Manage Bookings">
                                <SafeBookingsBoundary label="Couldn't load this booking workspace"><ManageServiceBookingsPage /></SafeBookingsBoundary>
                              </ServicesGate>
                            </AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services/:id/sales">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}>
                              <ServicesGate title="Sales">
                                <SafeBookingsBoundary><ServiceSales /></SafeBookingsBoundary>
                              </ServicesGate>
                            </AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services/:id">
                        {() => (
                          <MainLayout>
                            <ServicesGate>
                              <SafeBookingsBoundary><ServiceDetailPage /></SafeBookingsBoundary>
                            </ServicesGate>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/services">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={false}>
                              <ServicesGate>
                                <SafeBookingsBoundary><ServicesPage /></SafeBookingsBoundary>
                              </ServicesGate>
                            </AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/bookings">
                        {() => (
                          <MainLayout>
                            <ServicesGate title="My Bookings">
                              <SafeBookingsBoundary label="Couldn't load your bookings right now"><BookingsPage /></SafeBookingsBoundary>
                            </ServicesGate>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/settings">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><SettingsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/nearby">
                        {() => <NearbyPage />}
                      </Route>

                      <Route path="/ai-agent">
                        {() => (
                          <MainLayout fullWidth noPadding>
                            <AuthWrapper requireAdmin={true}><AiAgentPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/ai">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={false}><AIToolsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/test-subscription">
                        {() => <MainLayout><TestSubscription /></MainLayout>}
                      </Route>

                      <Route path="/events/organizer">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><EventOrganizerDashboard /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/events/:id/sales">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><EventSales /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/events/:id/tickets">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><EventSales /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/events/:id">
                        {() => <MainLayout><EventDetails /></MainLayout>}
                      </Route>

                      <Route path="/tickets/success">
                        {() => <MainLayout><TicketSuccess /></MainLayout>}
                      </Route>

                      <Route path="/tickets/:id">
                        {() => <MainLayout><TicketDetailPage /></MainLayout>}
                      </Route>

                      <Route path="/orders">
                        {() => <MainLayout><OrdersPage /></MainLayout>}
                      </Route>

                      <Route path="/orders/:id">
                        {() => <MainLayout><OrderDetailsPage /></MainLayout>}
                      </Route>

                      {/* Admin pages */}
                      <Route path="/admin/test-event">
                        {() => <MainLayout><TestEventPage /></MainLayout>}
                      </Route>

                      <Route path="/admin/marketing">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><AdminMarketingPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/admin/career">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><AdminCareerPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>
                      <Route path="/p/:slug">
                        {() => <PortfolioPublicPage />}
                      </Route>
                      <Route path="/admin/ads-hub">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><AdminAdsHubPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/admin/analytics">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><AdminAnalyticsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/admin/marketplace-analytics">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><AdminMarketplaceAnalyticsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/admin/test-product">
                        {() => <MainLayout><AdminTestProductPage /></MainLayout>}
                      </Route>

                      <Route path="/admin/test-order">
                        {() => <MainLayout><TestOrderPage /></MainLayout>}
                      </Route>

                      <Route path="/admin/test-websocket">
                        {() => <MainLayout><TestWebSocketPage /></MainLayout>}
                      </Route>

                      <Route path="/admin/test-order-notification">
                        {() => <MainLayout><TestOrderNotificationPage /></MainLayout>}
                      </Route>

                      <Route path="/admin/service-bookings">
                        {() => <MainLayout><AdminServiceBookingsPage /></MainLayout>}
                      </Route>

                      <Route path="/admin/test-notification">
                        {() => <AdminLayout><TestNotificationPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/data-deletion-requests">
                        {() => <AdminLayout><DataDeletionRequestsPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/legal">
                        {() => <AdminLayout><LegalManagementPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/users">
                        {() => <AdminLayout><AdminView /></AdminLayout>}
                      </Route>

                      <Route path="/admin/content">
                        {() => <AdminLayout><AdminView /></AdminLayout>}
                      </Route>

                      <Route path="/admin/products">
                        {() => <AdminLayout><AdminView /></AdminLayout>}
                      </Route>

                      <Route path="/admin/events">
                        {() => <AdminLayout><AdminView /></AdminLayout>}
                      </Route>

                      <Route path="/admin/explore-images">
                        {() => <AdminLayout><ExploreImagesPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/ai-studio">
                        {() => <AIStudioPage />}
                      </Route>

                      <Route path="/admin/my-profile">
                        {() => <MyProfilePage />}
                      </Route>

                      <Route path="/admin/ai-access">
                        {() => <AdminAIAccessPage />}
                      </Route>

                      <Route path="/admin/spot-creators">
                        {() => <AdminSpotCreatorsPage />}
                      </Route>

                      <Route path="/admin/spots-overview">
                        {() => <AdminSpotsOverviewPage />}
                      </Route>

                      <Route path="/admin/spot-assignments">
                        {() => <AdminSpotAssignmentsPage />}
                      </Route>

                      <Route path="/admin/reels">
                        {() => <AdminLayout><AdminReelsPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/creator-studio">
                        {() => <AdminLayout><AdminCreatorStudioPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/elevenlabs">
                        {() => <AdminLayout><ElevenLabsAdminPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/live-viewers">
                        {() => <AdminLayout><LiveViewersPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/feature-settings">
                        {() => <FeatureSettingsPage />}
                      </Route>

                      <Route path="/admin/theme-control">
                        {() => <AdminLayout><ThemeControlPage /></AdminLayout>}
                      </Route>
                      <Route path="/admin/homepage-builder">
                        {() => <AdminLayout><HomepageBuilderPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/security-center">
                        {() => <AdminLayout><SecurityCenterPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/control-center">
                        {() => <ControlCenterPage />}
                      </Route>

                      <Route path="/admin/overview">
                        {() => <AdminLayout><AdminOverviewPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/broadcast">
                        {() => <AdminLayout><AdminBroadcastPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/moderation">
                        {() => <AdminLayout><AdminModerationPage /></AdminLayout>}
                      </Route>

                      <Route path="/trending">
                        {() => <MainLayout><TrendingPage /></MainLayout>}
                      </Route>
                      <Route path="/back-to-the-street">
                        {() => (
                          <MainLayout fullWidth noPadding>
                            <SafeBttsBoundary>
                              <BackToTheStreetPage />
                            </SafeBttsBoundary>
                          </MainLayout>
                        )}
                      </Route>
                      <Route path="/programme/events">
                        {() => <ProgrammeEventsPage />}
                      </Route>
                      <Route path="/programme/my-reservations">
                        {() => <MyReservationsPage />}
                      </Route>
                      <Route path="/my-programme">
                        {() => <ProgrammePage />}
                      </Route>
                      <Route path="/admin/programme">
                        {() => <AdminLayout><AdminProgrammePage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/polls">
                        {() => <AdminLayout><AdminPollsPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/share-permissions">
                        {() => <AdminLayout><AdminSharePermissionsPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/ai-control">
                        {() => <AdminLayout><AdminAiControlPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/ai-app-content">
                        {() => <AdminLayout><AdminAiAppContentPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/linkedin">
                        {() => <AdminLayout><AdminLinkedInPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/tiktok">
                        {() => <AdminLayout><AdminTikTokPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/instagram">
                        {() => <AdminLayout><AdminInstagramPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/snapchat">
                        {() => <AdminLayout><AdminSnapchatPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/api-keys">
                        {() => <AdminLayout><AdminApiKeysPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/chat-control">
                        {() => <AdminChatControlPage />}
                      </Route>

                      <Route path="/admin/push">
                        {() => <AdminLayout><AdminPushPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/lead-export">
                        {() => <AdminLayout><AdminLeadExportPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/memory-calendar">
                        {() => <AdminLayout><AdminMemoryCalendarPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/legal-assistant">
                        {() => <AdminLayout><AdminLegalAssistantPage /></AdminLayout>}
                      </Route>

                      <Route path="/admin/email-writer">
                        {() => <AdminLayout><AdminEmailWriterPage /></AdminLayout>}
                      </Route>

                      <Route path="/ai-premium/success">
                        {() => <AIPremiumSuccessPage />}
                      </Route>

                      <Route path="/ai-assistant">
                        {() => <MainLayout><AIAssistantPage /></MainLayout>}
                      </Route>

                      <Route path="/payment-redirect">
                        {() => <MainLayout fullWidth><PaymentRedirectPage /></MainLayout>}
                      </Route>

                      <Route path="/payments/redirect">
                        {() => <MainLayout fullWidth><PaymentRedirectPage /></MainLayout>}
                      </Route>

                      <Route path="/share-test">
                        {() => <MainLayout><ShareTestPage /></MainLayout>}
                      </Route>

                      <Route path="/chat">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><ChatPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/judge-panel">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><JudgePanel /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/competitions">
                        {() => (
                          <MainLayout>
                            <CompetitionsPage />
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/admin/competitions">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><AdminCompetitionsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/live-results/:eventId/:categoryId?">
                        {() => <LiveResults />}
                      </Route>

                      <Route path="/urban-chat">
                        {() => {
                          useEffect(() => { window.location.href = '/chat'; }, []);
                          return (
                            <div className="flex items-center justify-center h-[50vh]">
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                                <p className="text-sm text-muted-foreground">Redirecting to chat…</p>
                              </div>
                            </div>
                          );
                        }}
                      </Route>

                      <Route path="/notification-test">
                        {() => <MainLayout><NotificationTestPage /></MainLayout>}
                      </Route>

                      <Route path="/native-check">
                        {() => <NativeCheckPage />}
                      </Route>

                      <Route path="/websocket-demo">
                        {() => <MainLayout><WebSocketDemoPage /></MainLayout>}
                      </Route>

                      <Route path="/notifications">
                        {() => (
                          <MainLayout>
                            <AuthWrapper requireAuth={true}><NotificationsPage /></AuthWrapper>
                          </MainLayout>
                        )}
                      </Route>

                      <Route path="/ideal-test">
                        {() => <MainLayout><IdealTestPage /></MainLayout>}
                      </Route>

                      <Route path="/test-product">
                        {() => <MainLayout><TestProductPage /></MainLayout>}
                      </Route>

                      <Route path="/terms-of-service">
                        {() => <MainLayout><TermsOfServicePage /></MainLayout>}
                      </Route>

                      <Route path="/privacy-policy">
                        {() => <MainLayout><PrivacyPolicyPage /></MainLayout>}
                      </Route>

                      <Route path="/data-deletion">
                        {() => <MainLayout><DataDeletionPage /></MainLayout>}
                      </Route>

                      <Route path="/app-permissions">
                        {() => <MainLayout><AppPermissionsPage /></MainLayout>}
                      </Route>

                      <Route path="/contact">
                        {() => <MainLayout><ContactPage /></MainLayout>}
                      </Route>

                      <Route path="/legal-hub">
                        {() => <MainLayout><LegalHubPage /></MainLayout>}
                      </Route>

                      <Route path="/profile/:id">
                        {() => <MainLayout><UserProfilePage /></MainLayout>}
                      </Route>

                      <Route path="/locations/:id">
                        {() => <MainLayout><LocationDetails /></MainLayout>}
                      </Route>

                      {/* Redirect routes for notification deep-links */}
                      <Route path="/community/post/:id">
                        {(params) => {
                          const [, navigate] = useLocation();
                          useEffect(() => { navigate(`/community?post=${params.id}`, { replace: true }); }, [params.id]);
                          return <MainLayout><div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Redirecting to post…</p></div></MainLayout>;
                        }}
                      </Route>

                      <Route path="/posts/:id">
                        {(params) => {
                          const [, navigate] = useLocation();
                          useEffect(() => { navigate(`/community?post=${params.id}`, { replace: true }); }, [params.id]);
                          return <MainLayout><div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Redirecting to post…</p></div></MainLayout>;
                        }}
                      </Route>

                      <Route path="/explore/spots/:id">
                        {(params) => {
                          const [, navigate] = useLocation();
                          useEffect(() => { navigate(`/locations/${params.id}`, { replace: true }); }, [params.id]);
                          return <MainLayout><div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Redirecting to spot…</p></div></MainLayout>;
                        }}
                      </Route>

                      {/* New Feature Routes */}
                      <Route path="/cred">
                        {() => <MainLayout><CredPage /></MainLayout>}
                      </Route>
                      <Route path="/crews">
                        {() => <MainLayout><CrewsPage /></MainLayout>}
                      </Route>
                      <Route path="/crews/:id">
                        {() => <MainLayout><CrewDetailPage /></MainLayout>}
                      </Route>
                      <Route path="/challenges">
                        {() => <MainLayout><ChallengesPage /></MainLayout>}
                      </Route>
                      <Route path="/cyphers">
                        {() => <MainLayout><CyphersPage /></MainLayout>}
                      </Route>
                      <Route path="/graffiti">
                        {() => <MainLayout><GraffitiWallPage /></MainLayout>}
                      </Route>
                      <Route path="/beat-lab">
                        {() => <MainLayout><BeatLabPage /></MainLayout>}
                      </Route>
                      <Route path="/hall-of-fame">
                        {() => <MainLayout><HallOfFamePage /></MainLayout>}
                      </Route>
                      <Route path="/culture-tools">
                        {() => <MainLayout><CultureToolsPage /></MainLayout>}
                      </Route>

                      <Route>
                        {() => <MainLayout><NotFound /></MainLayout>}
                      </Route>

                    </Switch>
                  </Suspense>
                  </AppErrorBoundary>
                  </WelcomeGate>
                  <Toaster />
                  <TermsPromptHandler />
                  <LegalAcceptanceDialog />
                  <CookieConsent />
                </ShoppingCartProv