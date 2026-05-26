import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AIMapAnalytics from '@/components/admin/AIMapAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, Eye, MousePointerClick, Clock, TrendingUp, Globe, 
  Smartphone, Monitor, Tablet, ChevronLeft, ChevronRight, 
  BarChart3, PieChart, Activity, Target, RefreshCw, Cookie, ShieldCheck,
  MapPin, Calendar, Bookmark, Euro, CheckCircle,
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Pie, 
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface AnalyticsOverview {
  uniqueVisitors: number;
  totalSessions: number;
  totalPageViews: number;
  avgSessionDuration: number;
  totalConversions: number;
}

interface TopPage {
  path: string;
  views: number;
}

interface TrafficSource {
  source: string;
  sessions: number;
}

interface DeviceData {
  device: string;
  sessions: number;
}

interface DailyTraffic {
  date: string;
  sessions: number;
  pageViews: number;
}

interface ConversionData {
  type: string;
  count: number;
  value: number;
}

interface CampaignAttribution {
  campaignId: number;
  name: string;
  sessions: number;
  conversions: number;
}

interface WebSession {
  id: number;
  visitorId: string;
  sessionId: string;
  startedAt: string;
  deviceType: string;
  browser: string;
  os: string;
  utmSource: string | null;
  pageCount: number;
  duration: number | null;
}

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function getDeviceIcon(device: string) {
  switch (device?.toLowerCase()) {
    case 'mobile':
      return <Smartphone className="h-4 w-4" />;
    case 'tablet':
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('platform');
  const [dateRange, setDateRange] = useState('30');
  
  const startDate = startOfDay(subDays(new Date(), parseInt(dateRange))).toISOString();
  const endDate = endOfDay(new Date()).toISOString();

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/admin/analytics/overview', startDate, endDate],
  });

  const { data: topPages, isLoading: topPagesLoading } = useQuery<TopPage[]>({
    queryKey: ['/api/admin/analytics/top-pages', startDate, endDate],
  });

  const { data: trafficSources, isLoading: sourcesLoading } = useQuery<TrafficSource[]>({
    queryKey: ['/api/admin/analytics/traffic-sources', startDate, endDate],
  });

  const { data: devices, isLoading: devicesLoading } = useQuery<DeviceData[]>({
    queryKey: ['/api/admin/analytics/devices', startDate, endDate],
  });

  const { data: dailyTraffic, isLoading: trafficLoading } = useQuery<DailyTraffic[]>({
    queryKey: ['/api/admin/analytics/daily-traffic', startDate, endDate],
  });

  const { data: conversions, isLoading: conversionsLoading } = useQuery<ConversionData[]>({
    queryKey: ['/api/admin/analytics/conversions', startDate, endDate],
  });

  const { data: campaignAttributions, isLoading: attributionsLoading } = useQuery<CampaignAttribution[]>({
    queryKey: ['/api/admin/analytics/campaign-attributions', startDate, endDate],
  });

  const { data: recentSessions, isLoading: sessionsLoading } = useQuery<WebSession[]>({
    queryKey: ['/api/admin/analytics/recent-sessions'],
  });

  const { data: platformStats, isLoading: platformLoading } = useQuery<any>({
    queryKey: ['/api/admin/platform-analytics'],
  });

  const { data: consentStats } = useQuery<{
    total: number; analyticsAccepted: number; marketingAccepted: number;
    essentialOnly: number; registeredUsers: number;
  }>({
    queryKey: ['/api/admin/analytics/consent-stats'],
  });

  const totalDeviceSessions = devices?.reduce((sum, d) => sum + d.sessions, 0) || 0;
  const totalSourceSessions = trafficSources?.reduce((sum, s) => sum + s.sessions, 0) || 0;

  const handleRefresh = () => {
    refetchOverview();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Platform stats and visitor behavior
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="button-refresh-analytics">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="platform" className="flex items-center gap-1.5" data-testid="tab-platform">
            <MapPin className="h-3.5 w-3.5" /> Platform
          </TabsTrigger>
          <TabsTrigger value="traffic" className="flex items-center gap-1.5" data-testid="tab-traffic">
            <Activity className="h-3.5 w-3.5" /> Traffic
          </TabsTrigger>
          <TabsTrigger value="ai-map" className="flex items-center gap-1.5" data-testid="tab-ai-map">
            ✨ AI Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-4">
          {platformLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" /> Loading platform stats…
            </div>
          ) : platformStats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Users', value: platformStats.totalUsers, icon: Users, color: 'text-blue-500' },
                  { label: 'Spots', value: platformStats.totalSpots, icon: MapPin, color: 'text-green-500' },
                  { label: 'Pending', value: platformStats.pendingSpots, icon: Clock, color: 'text-amber-500' },
                  { label: 'Sessions', value: platformStats.totalSessions, icon: Calendar, color: 'text-purple-500' },
                  { label: 'Bookings', value: platformStats.totalBookings, icon: CheckCircle, color: 'text-cyan-500' },
                  { label: 'Saves', value: platformStats.totalSaves, icon: Bookmark, color: 'text-rose-500' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label}>
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardDescription className="flex items-center gap-1.5 text-xs">
                        <Icon className={`h-3.5 w-3.5 ${color}`} /> {label}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-2xl font-bold" data-testid={`stat-platform-${label.toLowerCase()}`}>{value ?? '—'}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {platformStats.weeklyGrowth?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> Weekly Registrations & Bookings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={platformStats.weeklyGrowth.map((w: any) => ({ week: w.week?.slice(5), users: w.newUsers, bookings: w.bookings }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="users" name="New Users" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                          <Bar dataKey="bookings" name="Bookings" fill="#10b981" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {platformStats.topSpots?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Top Spots by Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {platformStats.topSpots.map((spot: any, i: number) => (
                        <div key={spot.id} className="flex items-center gap-3 px-4 py-3" data-testid={`platform-spot-${spot.id}`}>
                          <span className="text-muted-foreground text-sm font-medium w-5">{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{spot.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{spot.type?.replace(/_/g, ' ')} · {spot.city || spot.address?.split(',')[1]?.trim() || 'NL'}</p>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground flex-shrink-0">
                            <span title="Saves">🔖 {spot.saves}</span>
                            <span title="Sessions">📅 {spot.sessions}</span>
                            <span title="Bookings">👥 {spot.bookings}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {platformStats.spotTypeBreakdown?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Spots by Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={platformStats.spotTypeBreakdown.map((t: any) => ({ type: t.type?.replace(/_/g, ' '), count: t.count }))} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={80} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">No platform data yet.</Card>
          )}
        </TabsContent>

        <TabsContent value="traffic" className="mt-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Unique Visitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unique-visitors">
              {overviewLoading ? '-' : overview?.uniqueVisitors?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sessions">
              {overviewLoading ? '-' : overview?.totalSessions?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Page Views
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-page-views">
              {overviewLoading ? '-' : overview?.totalPageViews?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg. Duration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-duration">
              {overviewLoading ? '-' : formatDuration(overview?.avgSessionDuration || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-conversions">
              {overviewLoading ? '-' : overview?.totalConversions?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Traffic Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trafficLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : dailyTraffic && dailyTraffic.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyTraffic}>
                  <defs>
                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="sessions" 
                    stroke="#f59e0b" 
                    fillOpacity={1} 
                    fill="url(#colorSessions)" 
                    name="Sessions"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pageViews" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorPageViews)" 
                    name="Page Views"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No traffic data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Device Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : devices && devices.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPieChart>
                    <Pie
                      data={devices}
                      dataKey="sessions"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {devices.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {devices.map((device, index) => (
                    <div key={device.device} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(device.device)}
                        <span className="text-sm capitalize">{device.device}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{device.sessions}</span>
                        <Badge variant="secondary" className="text-xs">
                          {totalDeviceSessions > 0 
                            ? Math.round((device.sessions / totalDeviceSessions) * 100) 
                            : 0}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No device data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : trafficSources && trafficSources.length > 0 ? (
              <div className="space-y-3">
                {trafficSources.map((source) => (
                  <div key={source.source} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{source.source}</span>
                      <span className="text-muted-foreground">
                        {source.sessions} ({totalSourceSessions > 0 
                          ? Math.round((source.sessions / totalSourceSessions) * 100) 
                          : 0}%)
                      </span>
                    </div>
                    <Progress 
                      value={totalSourceSessions > 0 
                        ? (source.sessions / totalSourceSessions) * 100 
                        : 0
                      } 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No traffic source data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPagesLoading ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : topPages && topPages.length > 0 ? (
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {topPages.map((page, index) => (
                    <div 
                      key={page.path} 
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm w-6">{index + 1}</span>
                        <span className="text-sm font-mono truncate max-w-[200px]">{page.path}</span>
                      </div>
                      <Badge variant="outline">{page.views} views</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No page view data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Conversions by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversionsLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : conversions && conversions.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={conversions} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="type" type="category" className="text-xs" width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No conversion data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Campaign Attribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attributionsLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : campaignAttributions && campaignAttributions.length > 0 ? (
              <div className="space-y-3">
                {campaignAttributions.map((campaign) => (
                  <div 
                    key={campaign.campaignId} 
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.sessions} sessions
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="default">{campaign.conversions} conv.</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No campaign attribution data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
          <CardDescription>
            Latest visitor sessions on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : recentSessions && recentSessions.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <div 
                    key={session.id}
                    className="flex items-center justify-between py-3 px-3 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      {getDeviceIcon(session.deviceType)}
                      <div>
                        <p className="text-sm font-mono text-muted-foreground truncate max-w-[150px]">
                          {session.visitorId.substring(0, 12)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.startedAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{session.pageCount}</p>
                        <p className="text-xs text-muted-foreground">pages</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">
                          {session.duration ? formatDuration(session.duration) : '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">duration</p>
                      </div>
                      {session.utmSource && (
                        <Badge variant="outline" className="text-xs">
                          {session.utmSource}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No session data available yet. Tracking will appear after visitors consent to cookies.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" />
            Cookie Consent Overview
          </CardTitle>
          <CardDescription>
            Breakdown of visitor cookie consent choices (all time)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consentStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{consentStats.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Consents</p>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{consentStats.analyticsAccepted}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Analytics Accepted</p>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-blue-500">{consentStats.marketingAccepted}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Marketing Accepted</p>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-orange-500">{consentStats.essentialOnly}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Essential Only</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    Analytics acceptance rate
                  </span>
                  <span className="font-medium">
                    {consentStats.total > 0 ? Math.round((consentStats.analyticsAccepted / consentStats.total) * 100) : 0}%
                  </span>
                </div>
                <Progress value={consentStats.total > 0 ? (consentStats.analyticsAccepted / consentStats.total) * 100 : 0} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                    Marketing acceptance rate
                  </span>
                  <span className="font-medium">
                    {consentStats.total > 0 ? Math.round((consentStats.marketingAccepted / consentStats.total) * 100) : 0}%
                  </span>
                </div>
                <Progress value={consentStats.total > 0 ? (consentStats.marketingAccepted / consentStats.total) * 100 : 0} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                {consentStats.registeredUsers} consent record(s) linked to registered accounts.
              </p>
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
              No consent data available yet.
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="ai-map" className="mt-4">
          <AIMapAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
