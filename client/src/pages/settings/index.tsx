import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Eye, 
  Lock, 
  Globe, 
  Monitor, 
  Smartphone, 
  Trash2, 
  LogOut,
  ChevronLeft,
  AlertTriangle,
  Users,
  MapPin,
  Phone,
  Radio,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { Link } from 'wouter';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { APPLE_REVIEW_TOUR_KEY, APPLE_REVIEW_ACCOUNT } from '@/components/AppleReviewTour';

type UserSettings = {
  id: number;
  userId: number;
  language: string;
  timezone: string;
  profileVisibility: string;
  showActivityStatus: boolean;
  showLocation: boolean;
  followPermission: string;
  messagePermission: string;
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionTimeout: number;
  theme: string;
  themeMode: string;
  updatedAt: string;
};

type NotificationPreferences = {
  id: number;
  userId: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
  newFollowers: boolean;
  followRequests: boolean;
  mentions: boolean;
  comments: boolean;
  likes: boolean;
  eventReminders: boolean;
  eventUpdates: boolean;
  newMessages: boolean;
  systemNotifications: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
  updatedAt: string;
};

type LoginSession = {
  id: number;
  userId: number;
  deviceType: string;
  deviceName: string | null;
  browser: string | null;
  ipAddress: string | null;
  location: string | null;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  revokedAt: string | null;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme, colorPalette, setColorPalette, availablePalettes } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('account');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const { data: settings, isLoading: isLoadingSettings } = useQuery<UserSettings>({
    queryKey: ['/api/settings'],
    enabled: !!user,
  });

  useEffect(() => {
    if (settings?.theme && settings.theme !== colorPalette) {
      setColorPalette(settings.theme as any);
    }
    if (settings?.themeMode && settings.themeMode !== theme) {
      setTheme(settings.themeMode as 'light' | 'dark' | 'system');
    }
    if (settings?.language && (settings.language === 'en' || settings.language === 'nl') && settings.language !== language) {
      setLanguage(settings.language);
    }
  }, [settings?.theme, settings?.themeMode, settings?.language]);

  const { data: notificationPrefs, isLoading: isLoadingNotifs } = useQuery<NotificationPreferences>({
    queryKey: ['/api/settings/notifications'],
    enabled: !!user,
  });

  const { data: sessions, isLoading: isLoadingSessions } = useQuery<LoginSession[]>({
    queryKey: ['/api/sessions'],
    enabled: !!user,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const res = await apiRequest('/api/settings', 'PUT', updates);
      return res;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['/api/settings'] });
      const previousSettings = queryClient.getQueryData<UserSettings>(['/api/settings']);
      if (previousSettings) {
        queryClient.setQueryData(['/api/settings'], { ...previousSettings, ...updates });
      }
      return { previousSettings };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: 'Settings updated',
        description: 'Your settings have been saved successfully.',
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['/api/settings'], context.previousSettings);
      }
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await apiRequest('/api/settings/notifications', 'PUT', updates);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update notification preferences.',
        variant: 'destructive',
      });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const res = await apiRequest(`/api/sessions/${sessionId}`, 'DELETE');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({
        title: 'Session revoked',
        description: 'The session has been logged out.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke session.',
        variant: 'destructive',
      });
    },
  });

  const [pushPermissionStatus, setPushPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');

  function detectWTN(): boolean {
    try { return typeof window !== 'undefined' && !!(window as any).WTN?.Firebase?.Messaging; }
    catch { return false; }
  }

  const [isWTN, setIsWTN] = useState<boolean>(detectWTN);

  useEffect(() => {
    // Re-check after 1 500 ms so the WTN bridge has time to be injected
    const t = setTimeout(() => {
      const wtn = detectWTN();
      setIsWTN(wtn);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const isInIframe = (() => {
    try { return !isWTN && typeof window !== 'undefined' && window.self !== window.top; }
    catch { return true; }
  })();

  const isPushSupported = isWTN || (typeof window !== 'undefined' && 'Notification' in window && !isInIframe);

  useEffect(() => {
    if (isWTN) {
      setPushPermissionStatus('granted');
    } else if (isInIframe) {
      setPushPermissionStatus('unsupported');
    } else if (isPushSupported) {
      setPushPermissionStatus(Notification.permission);
    } else {
      setPushPermissionStatus('unsupported');
    }
  }, [isWTN]);

  const registerFCMTokenFromSettings = async (): Promise<void> => {
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'web';

    if (isWTN) {
      return new Promise((resolve) => {
        (window as any).WTN.Firebase.Messaging.getFCMToken({
          callback: async (data: { token: string }) => {
            if (!data?.token) { resolve(); return; }
            try {
              await apiRequest('/api/push/register', 'POST', { token: data.token, platform });
              console.log('[Settings][WTN] FCM token registered');
            } catch (err) {
              console.warn('[Settings][WTN] Token save failed:', err);
            }
            resolve();
          },
        });
      });
    }

    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) throw new Error('No token received from FCM');
    await apiRequest('/api/push/register', 'POST', { token, platform });
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      if (!isPushSupported) {
        toast({
          title: 'Not Supported',
          description: 'Push notifications are not supported in this browser.',
          variant: 'destructive',
        });
        return;
      }

      if (isWTN) {
        try {
          await registerFCMTokenFromSettings();
          updateNotificationsMutation.mutate({ pushEnabled: true });
          toast({ title: 'Notifications Enabled', description: 'You will now receive push notifications.' });
        } catch (err) {
          toast({ title: 'Error', description: 'Could not register for push notifications.', variant: 'destructive' });
        }
        return;
      }

      if (Notification.permission === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'Open your browser settings, find this site under Notifications, and set it to Allow.',
          variant: 'destructive',
        });
        return;
      }

      if (Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          setPushPermissionStatus(permission);
          if (permission === 'granted') {
            await registerFCMTokenFromSettings();
            updateNotificationsMutation.mutate({ pushEnabled: true });
            toast({
              title: 'Notifications Enabled',
              description: 'You will now receive push notifications.',
            });
          } else {
            toast({
              title: 'Permission Denied',
              description: 'You denied notification permissions. Enable them in browser settings.',
              variant: 'destructive',
            });
          }
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to request notification permission.',
            variant: 'destructive',
          });
        }
        return;
      }

      if (Notification.permission === 'granted') {
        await registerFCMTokenFromSettings();
        updateNotificationsMutation.mutate({ pushEnabled: true });
      }
    } else {
      updateNotificationsMutation.mutate({ pushEnabled: false });
    }
  };

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/sessions/revoke-all', 'POST', {});
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({
        title: 'All sessions revoked',
        description: 'All other sessions have been logged out.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke sessions.',
        variant: 'destructive',
      });
    },
  });

  if (!user) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="container max-w-4xl py-6 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/profile/${user.id}`)}
          data-testid="button-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account preferences and privacy</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="account" className="gap-2" data-testid="tab-account">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2" data-testid="tab-privacy">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2" data-testid="tab-appearance">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="nearby-safety" className="gap-2" data-testid="tab-nearby-safety">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Nearby & Safety</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
              <CardDescription>Update your personal information and profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <ProfileEditor user={user} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preferences</CardTitle>
              <CardDescription>Customize your account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Language</Label>
                    <p className="text-sm text-muted-foreground">Choose your preferred language</p>
                  </div>
                </div>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    if (value === 'en' || value === 'nl' || value === 'ar') {
                      setLanguage(value);
                    }
                    updateSettingsMutation.mutate({ language: value });
                  }}
                  disabled={isLoadingSettings}
                >
                  <SelectTrigger className="w-[150px]" data-testid="select-language">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                    <SelectItem value="ar">🇸🇾 العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Timezone</Label>
                  <p className="text-sm text-muted-foreground">Set your local timezone</p>
                </div>
                <Select
                  value={settings?.timezone || 'Europe/Amsterdam'}
                  onValueChange={(value) => updateSettingsMutation.mutate({ timezone: value })}
                  disabled={isLoadingSettings}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-timezone">
                    <SelectValue placeholder="Timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Amsterdam">Amsterdam (CET)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="America/New_York">New York (EST)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Los Angeles (PST)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Visibility</CardTitle>
              <CardDescription>Control who can see your profile and activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Profile Visibility</Label>
                  <p className="text-sm text-muted-foreground">Choose who can view your profile</p>
                </div>
                <Select
                  value={settings?.profileVisibility || 'public'}
                  onValueChange={(value) => updateSettingsMutation.mutate({ profileVisibility: value })}
                  disabled={isLoadingSettings}
                >
                  <SelectTrigger className="w-[150px]" data-testid="select-visibility">
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="followers">Followers Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Show Activity Status</Label>
                  <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                </div>
                <Switch
                  checked={settings?.showActivityStatus ?? true}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ showActivityStatus: checked })}
                  disabled={isLoadingSettings}
                  data-testid="switch-activity-status"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Show Location</Label>
                  <p className="text-sm text-muted-foreground">Display your location on your profile</p>
                </div>
                <Switch
                  checked={settings?.showLocation ?? true}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ showLocation: checked })}
                  disabled={isLoadingSettings}
                  data-testid="switch-show-location"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Interactions</CardTitle>
              <CardDescription>Control who can interact with you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Who can follow you</Label>
                  <p className="text-sm text-muted-foreground">Control follow requests</p>
                </div>
                <Select
                  value={settings?.followPermission || 'everyone'}
                  onValueChange={(value) => updateSettingsMutation.mutate({ followPermission: value })}
                  disabled={isLoadingSettings}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-follow-permission">
                    <SelectValue placeholder="Permission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="approved_only">Approval Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Who can message you</Label>
                  <p className="text-sm text-muted-foreground">Control who can send you messages</p>
                </div>
                <Select
                  value={settings?.messagePermission || 'everyone'}
                  onValueChange={(value) => updateSettingsMutation.mutate({ messagePermission: value })}
                  disabled={isLoadingSettings}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-message-permission">
                    <SelectValue placeholder="Permission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="followers">Followers Only</SelectItem>
                    <SelectItem value="nobody">Nobody</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Channels</CardTitle>
              <CardDescription>Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {isInIframe ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
                    <Bell className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Open the app to enable notifications</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Push notifications cannot be set up in a preview or embedded window. Open the app directly in your browser to manage this setting.
                      </p>
                      <a
                        href="https://urbanculturehub.nl/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2"
                      >
                        Open urbanculturehub.nl/settings →
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label>Push Notifications</Label>
                          {pushPermissionStatus === 'granted' && (
                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Allowed</Badge>
                          )}
                          {pushPermissionStatus === 'denied' && (
                            <Badge variant="destructive" className="text-xs">Blocked</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pushPermissionStatus === 'denied'
                            ? 'Notifications are blocked — see instructions below'
                            : 'Receive push notifications for messages and events'}
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs?.pushEnabled ?? false}
                        onCheckedChange={handlePushToggle}
                        disabled={isLoadingNotifs}
                        data-testid="switch-push-notifications"
                      />
                    </div>
                    {pushPermissionStatus === 'denied' && (
                      <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-xs text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-red-600 dark:text-red-400 mb-1">How to unblock notifications:</p>
                        {/iPhone|iPad|iPod/.test(navigator.userAgent)
                          ? <p>Open the <strong>Settings</strong> app → scroll to <strong>Safari</strong> (or Chrome) → tap <strong>Notifications</strong> → find this site → set to <strong>Allow</strong>.</p>
                          : /Android/.test(navigator.userAgent)
                            ? <p>Tap the <strong>lock icon 🔒</strong> in your browser address bar → tap <strong>Notifications</strong> → select <strong>Allow</strong> → refresh.</p>
                            : <p>Click the <strong>lock icon 🔒</strong> in your browser address bar → <strong>Notifications</strong> → set to <strong>Allow</strong> → refresh the page.</p>
                        }
                      </div>
                    )}
                  </>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch
                  checked={notificationPrefs?.emailEnabled ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ emailEnabled: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-email-notifications"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Notifications</CardTitle>
              <CardDescription>Get notified about social activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>New Followers</Label>
                  <p className="text-sm text-muted-foreground">When someone follows you</p>
                </div>
                <Switch
                  checked={notificationPrefs?.newFollowers ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ newFollowers: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-new-followers"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Follow Requests</Label>
                  <p className="text-sm text-muted-foreground">When someone requests to follow you</p>
                </div>
                <Switch
                  checked={notificationPrefs?.followRequests ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ followRequests: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-follow-requests"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Mentions</Label>
                  <p className="text-sm text-muted-foreground">When someone mentions you</p>
                </div>
                <Switch
                  checked={notificationPrefs?.mentions ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ mentions: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-mentions"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Comments</Label>
                  <p className="text-sm text-muted-foreground">When someone comments on your posts</p>
                </div>
                <Switch
                  checked={notificationPrefs?.comments ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ comments: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-comments"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Likes</Label>
                  <p className="text-sm text-muted-foreground">When someone likes your content</p>
                </div>
                <Switch
                  checked={notificationPrefs?.likes ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ likes: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-likes"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Notifications</CardTitle>
              <CardDescription>Stay updated on events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Event Reminders</Label>
                  <p className="text-sm text-muted-foreground">Reminders for upcoming events</p>
                </div>
                <Switch
                  checked={notificationPrefs?.eventReminders ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ eventReminders: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-event-reminders"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Event Updates</Label>
                  <p className="text-sm text-muted-foreground">Changes to events you're attending</p>
                </div>
                <Switch
                  checked={notificationPrefs?.eventUpdates ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ eventUpdates: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-event-updates"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other Notifications</CardTitle>
              <CardDescription>Additional notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>New Messages</Label>
                  <p className="text-sm text-muted-foreground">Chat message notifications</p>
                </div>
                <Switch
                  checked={notificationPrefs?.newMessages ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ newMessages: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-new-messages"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>System Notifications</Label>
                  <p className="text-sm text-muted-foreground">Important system updates</p>
                </div>
                <Switch
                  checked={notificationPrefs?.systemNotifications ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ systemNotifications: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-system-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">Promotional content and offers</p>
                </div>
                <Switch
                  checked={notificationPrefs?.marketingEmails ?? false}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ marketingEmails: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-marketing-emails"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">Weekly summary of activity</p>
                </div>
                <Switch
                  checked={notificationPrefs?.weeklyDigest ?? false}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ weeklyDigest: checked })}
                  disabled={isLoadingNotifs}
                  data-testid="switch-weekly-digest"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Theme</CardTitle>
              <CardDescription>Customize the look and feel of the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Color Mode</Label>
                  <p className="text-sm text-muted-foreground">Choose light, dark, or system theme</p>
                </div>
                <Select 
                  value={theme} 
                  onValueChange={(value) => {
                    setTheme(value as 'light' | 'dark' | 'system');
                    updateSettingsMutation.mutate({ themeMode: value });
                  }}
                >
                  <SelectTrigger className="w-[150px]" data-testid="select-theme-mode">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label className="mb-3 block">Urban Theme</Label>
                <p className="text-sm text-muted-foreground mb-4">Choose a color palette inspired by urban culture</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(availablePalettes).map(([key, paletteConfig]) => {
                    const primaryColor = paletteConfig.light.primary;
                    const displayName = key.charAt(0).toUpperCase() + key.slice(1);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setColorPalette(key as any);
                          updateSettingsMutation.mutate({ theme: key });
                        }}
                        className={`relative p-3 rounded-md border-2 transition-all ${
                          colorPalette === key 
                            ? 'border-primary ring-2 ring-primary/20' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        data-testid={`button-theme-${key}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: primaryColor }}
                          />
                          <span className="font-medium text-sm">{displayName}</span>
                        </div>
                        <div className="flex gap-1">
                          <div 
                            className="w-6 h-6 rounded" 
                            style={{ backgroundColor: primaryColor }}
                          />
                          <div 
                            className="w-6 h-6 rounded opacity-70" 
                            style={{ backgroundColor: primaryColor }}
                          />
                          <div 
                            className="w-6 h-6 rounded opacity-40" 
                            style={{ backgroundColor: primaryColor }}
                          />
                        </div>
                        {colorPalette === key && (
                          <Badge variant="secondary" className="absolute top-1 right-1 text-xs">
                            Active
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Settings</CardTitle>
              <CardDescription>Manage your account security options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                </div>
                <Switch
                  checked={settings?.twoFactorEnabled ?? false}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ twoFactorEnabled: checked })}
                  disabled={isLoadingSettings}
                  data-testid="switch-2fa"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Login Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified of new login activity</p>
                </div>
                <Switch
                  checked={settings?.loginAlerts ?? true}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ loginAlerts: checked })}
                  disabled={isLoadingSettings}
                  data-testid="switch-login-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                </div>
                <Select
                  value={String(settings?.sessionTimeout || 30)}
                  onValueChange={(value) => updateSettingsMutation.mutate({ sessionTimeout: parseInt(value) })}
                  disabled={isLoadingSettings}
                >
                  <SelectTrigger className="w-[150px]" data-testid="select-session-timeout">
                    <SelectValue placeholder="Timeout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Sessions</CardTitle>
              <CardDescription>Manage devices where you're currently logged in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingSessions ? (
                <div className="text-center py-4">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              ) : sessions && sessions.length > 0 ? (
                <>
                  {sessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                      data-testid={`session-${session.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(session.deviceType)}
                        <div>
                          <p className="font-medium text-sm">
                            {session.deviceName || session.browser || 'Unknown Device'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.location || session.ipAddress || 'Unknown location'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last seen: {formatDate(session.lastSeenAt)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeSessionMutation.mutate(session.id)}
                        disabled={revokeSessionMutation.isPending}
                        data-testid={`button-revoke-session-${session.id}`}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {sessions.length > 1 && (
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => revokeAllSessionsMutation.mutate()}
                      disabled={revokeAllSessionsMutation.isPending}
                      data-testid="button-revoke-all-sessions"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Log out all other sessions
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-center text-muted-foreground py-4">No active sessions found</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-destructive">Delete Account</Label>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => navigate('/data-deletion')}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nearby-safety" className="space-y-4">
          <Card data-testid="card-nearby-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Nearby Discovery
              </CardTitle>
              <CardDescription>
                Discover other urban culture members near you with privacy-first controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Coarse proximity only</p>
                    <p className="text-sm text-muted-foreground">Only your approximate area (~1–3 km) is ever shared. No exact GPS coordinates are stored or revealed.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <EyeOff className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Ghost mode available</p>
                    <p className="text-sm text-muted-foreground">Browse nearby members while staying invisible to others.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Radio className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Auto-expiring presence</p>
                    <p className="text-sm text-muted-foreground">Your presence data expires automatically after 2 hours. No location history is stored.</p>
                  </div>
                </div>
              </div>
              <Link href="/nearby">
                <Button className="w-full" data-testid="button-go-to-nearby">
                  <Users className="h-4 w-4 mr-2" />
                  Open Nearby & Privacy Controls
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900" data-testid="card-safety-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-red-500" />
                Safety Features
              </CardTitle>
              <CardDescription>
                Manage trusted contacts and safety broadcasts for when you need assistance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 p-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-red-700 dark:text-red-400">Emergency: Always call 112</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                      If you are in immediate danger, call 112. The safety broadcast feature is not an emergency service — it notifies your trusted contacts only.
                    </p>
                    <a
                      href="tel:112"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md"
                      data-testid="link-settings-call-112"
                    >
                      <Phone className="h-3 w-3" />
                      Call 112
                    </a>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>From the Nearby page you can also:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Add trusted contacts who can receive safety broadcasts</li>
                  <li>Send a broadcast to notify contacts you need help</li>
                  <li>Revoke any active broadcasts</li>
                </ul>
              </div>
              <Link href="/nearby">
                <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" data-testid="button-go-to-safety">
                  <Shield className="h-4 w-4 mr-2" />
                  Open Safety Panel
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card data-testid="card-ios-app">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-orange-500" />
                Urban Culture Hub iOS App
              </CardTitle>
              <CardDescription>Download the app for the best experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Get the full Urban Culture Hub experience on your iPhone — events, community, real-time chat, and your urban culture map, all in one place.
              </p>
              <a
                href="https://apps.apple.com/nl/app/urban-culture-hub/id6743952291?l=en-GB"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-ios-app-store"
                className="flex items-center gap-3 p-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors"
              >
                <Smartphone className="h-6 w-6 text-white shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-gray-400 leading-none">Download on the</p>
                  <p className="text-sm font-semibold leading-tight mt-0.5">App Store</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              </a>
            </CardContent>
          </Card>

          {(user as any)?.email === APPLE_REVIEW_ACCOUNT && (
            <Card data-testid="card-apple-review-guide" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
                  <Shield className="h-4 w-4" />
                  Apple App Review Guide
                </CardTitle>
                <CardDescription>Restart the guided walkthrough for Apple reviewers.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-restart-apple-tour"
                  className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  onClick={() => {
                    localStorage.removeItem(APPLE_REVIEW_TOUR_KEY);
                    window.location.reload();
                  }}
                >
                  Restart App Review Guide
                </Button>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-privacy-gdpr">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" />
                Privacy & GDPR
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Proximity discovery is processed under <strong>GDPR Art. 6(1)(a) — your explicit consent</strong>. You can withdraw consent at any time by disabling discovery in the Nearby page.</p>
              <p>Location data is stored in coarse form only (rounded to ~1 km precision) and expires automatically. No location history or trails are stored.</p>
              <p>If you are under 16 years old, proximity discovery requires parental/guardian consent under Dutch law (GDPR implementation).</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
