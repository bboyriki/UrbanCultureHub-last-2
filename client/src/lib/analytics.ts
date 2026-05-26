let analyticsReady = false;

async function getAnalytics() {
  try {
    const { initializeApp, getApps, getApp } = await import("firebase/app");
    const { getAnalytics, isSupported } = await import("firebase/analytics");

    if (!(await isSupported())) return null;

    const firebaseConfig = {
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    };

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getAnalytics(app);
  } catch {
    return null;
  }
}

async function track(eventName: string, params?: Record<string, unknown>) {
  try {
    const { logEvent } = await import("firebase/analytics");
    const analytics = await getAnalytics();
    if (!analytics) return;
    logEvent(analytics, eventName, params as Record<string, string | number | boolean>);
    analyticsReady = true;
  } catch {
    // fail silently
  }
}

export const analytics = {
  pageView: (page: string) => track("page_view", { page_title: page, page_location: window.location.href }),
  reelView: (reelId: number) => track("reel_view", { reel_id: reelId }),
  spotView: (spotId: number | string, spotName?: string) => track("spot_view", { spot_id: String(spotId), spot_name: spotName }),
  eventView: (eventId: number, eventName?: string) => track("event_view", { event_id: eventId, event_name: eventName }),
  marketplaceView: () => track("marketplace_view"),
  searchPerformed: (query: string, section: string) => track("search", { search_term: query, section }),
  signUp: () => track("sign_up"),
  login: () => track("login"),
  shareContent: (contentType: string, contentId: string) => track("share", { content_type: contentType, item_id: contentId }),
  addToCart: (productId: number) => track("add_to_cart", { item_id: productId }),
  pushEnabled: () => track("push_notifications_enabled"),
};
