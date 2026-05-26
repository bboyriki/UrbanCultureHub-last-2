import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DashboardStats = () => {
  const [timeRange, setTimeRange] = useState("30");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Use the real admin ID from authentication context
  const adminId = user?.id || 1;
  
  // Effect to show a message when stats are auto-refreshed, but only when manually triggered
  // We're using a ref to keep track of whether we've already shown a toast for this refresh
  const hasShownAutoRefreshToastRef = useRef(false);
  
  useEffect(() => {
    if (lastRefreshTime && !hasShownAutoRefreshToastRef.current) {
      const interval = setInterval(() => {
        toast({
          title: "Stats Auto-Refreshed",
          description: `Dashboard statistics were automatically updated at ${lastRefreshTime.toLocaleTimeString()}`,
          variant: "default"
        });
        setLastRefreshTime(null);
        hasShownAutoRefreshToastRef.current = true;
        
        // Reset the flag after a few seconds so future manual refreshes can show the toast
        setTimeout(() => {
          hasShownAutoRefreshToastRef.current = false;
        }, 5000);
      }, 300); // Short delay to ensure toast appears after data is loaded
      
      return () => clearInterval(interval);
    }
  }, [lastRefreshTime, toast]);

  // Function to manually refresh stats from the server
  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      console.log("Sending stats refresh request with adminId:", adminId);
      const response = await apiRequest("/api/admin/stats/update", "POST", { adminId });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error occurred" }));
        throw new Error(errorData.message || "Failed to update stats");
      }
      
      const result = await response.json();
      console.log("Stats refreshed successfully:", result);
      
      // Invalidate the stats queries to fetch fresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/range", timeRange] });
      
      toast({
        title: "Stats refreshed",
        description: "The dashboard statistics have been updated with fresh data",
        variant: "default"
      });
      
      // Update last refresh time
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error("Failed to refresh stats:", error);
      
      let errorMessage = "Could not update the statistics. Please try again later.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Failed to refresh stats",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch latest system stats
  const { data: currentStats = {}, isLoading: loadingCurrentStats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/admin/stats", "GET", { adminId });
        const data = await response.json();
        console.log("Fetched current stats:", data);
        // Update last refresh time when data is successfully fetched
        if (!isRefreshing) {
          setLastRefreshTime(new Date());
        }
        return data;
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        // Return default values if API fails
        return {
          totalUsers: 0,
          newUsers: 0,
          activeEvents: 0,
          pendingEvents: 0,
          totalPosts: 0,
          flaggedContent: 0,
          totalRevenue: 0,
          revenueChange: 0,
        };
      }
    },
    refetchInterval: 60000, // Auto-refresh every minute
    enabled: !!user?.id && user.role === 'admin' // Only fetch if user is authenticated and admin
  });

  // Fetch historical stats for the charts
  const { data: historicalStats = [], isLoading: loadingHistoricalStats } = useQuery({
    queryKey: ["/api/admin/stats/range", timeRange],
    queryFn: async () => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeRange));
        
        const response = await apiRequest(
          "/api/admin/stats/range", 
          "GET", 
          { 
            startDate: startDate.toISOString(), 
            endDate: endDate.toISOString(),
            adminId 
          }
        );
        const data = await response.json();
        console.log("Fetched historical stats:", data);
        
        // Update last refresh time when historical data is successfully fetched
        if (!isRefreshing) {
          setLastRefreshTime(new Date());
        }
        
        return data;
      } catch (error) {
        console.error("Failed to fetch historical stats:", error);
        // Return empty array if API fails
        return [];
      }
    },
    refetchInterval: 300000, // Refresh historical stats every 5 minutes
    enabled: !!user?.id && user.role === 'admin' // Only fetch if user is authenticated and admin
  });

  // Format the data for charts
  const userChartData = historicalStats.map((stat: any) => ({
    date: new Date(stat.timestamp).toLocaleDateString(),
    users: stat.totalUsers,
    newUsers: stat.newUsers
  }));

  const activityChartData = historicalStats.map((stat: any) => ({
    date: new Date(stat.timestamp).toLocaleDateString(),
    posts: stat.totalPosts,
    events: stat.totalEvents,
    comments: stat.totalComments
  }));

  const engagementChartData = historicalStats.map((stat: any) => ({
    date: new Date(stat.timestamp).toLocaleDateString(),
    likes: stat.totalLikes,
    rsvps: stat.totalRsvps
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">System Analytics Dashboard</h2>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshStats}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px] border-2 focus:border-primary">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      {loadingCurrentStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse shadow-md">
              <CardHeader className="pb-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <Card className="shadow-md border-0 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{currentStats?.totalUsers || 0}</div>
              <p className="text-sm font-medium mt-1 text-blue-600 dark:text-blue-400">
                {currentStats?.newUsers > 0 && `+${currentStats.newUsers} new today`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md border-0 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Active Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{currentStats?.activeEvents || 0}</div>
              <p className="text-sm font-medium mt-1 text-green-600 dark:text-green-400">
                {currentStats?.pendingEvents > 0 && `${currentStats.pendingEvents} pending approval`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md border-0 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Content Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{currentStats?.totalPosts || 0}</div>
              <p className="text-sm font-medium mt-1 text-purple-600 dark:text-purple-400">
                {currentStats?.flaggedContent > 0 && `${currentStats.flaggedContent} flagged for review`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md border-0 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">${(currentStats?.totalRevenue || 0).toFixed(2)}</div>
              <p className="text-sm font-medium mt-1 text-amber-600 dark:text-amber-400">
                {currentStats?.revenueChange > 0 
                  ? `+${currentStats.revenueChange}% from last month` 
                  : currentStats?.revenueChange < 0
                  ? `${currentStats.revenueChange}% from last month`
                  : currentStats?.ticketsSold > 0 ? `${currentStats.ticketsSold} tickets sold` : 'No revenue yet'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secondary Stats Row - Engagement Metrics */}
      {!loadingCurrentStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="shadow-sm border bg-white dark:bg-gray-800">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{currentStats?.ticketsSold || 0}</div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tickets Sold</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border bg-white dark:bg-gray-800">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{currentStats?.totalComments || 0}</div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Comments</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border bg-white dark:bg-gray-800">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{currentStats?.totalLikes || 0}</div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Likes</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border bg-white dark:bg-gray-800">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{currentStats?.totalRsvps || 0}</div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">RSVPs</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border bg-white dark:bg-gray-800">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">${(currentStats?.ticketRevenue || 0).toFixed(2)}</div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ticket Revenue</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border bg-white dark:bg-gray-800">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">${(currentStats?.serviceRevenue || 0).toFixed(2)}</div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Service Revenue</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
              User Growth
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingHistoricalStats ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip contentStyle={{fontSize: '14px'}} />
                  <Legend wrapperStyle={{fontSize: '14px', paddingTop: '10px'}} />
                  <Area type="monotone" name="Total Users" dataKey="users" stroke="#6366f1" fillOpacity={1} fill="url(#colorUsers)" />
                  <Area type="monotone" name="New Users" dataKey="newUsers" stroke="#34d399" fillOpacity={1} fill="url(#colorNewUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Activity Chart */}
        <Card className="shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-gray-800">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingHistoricalStats ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <Tooltip contentStyle={{fontSize: '14px'}} />
                  <Legend wrapperStyle={{fontSize: '14px', paddingTop: '10px'}} />
                  <Bar name="Posts" dataKey="posts" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar name="Events" dataKey="events" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar name="Comments" dataKey="comments" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Engagement Chart */}
        <Card className="shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
              User Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingHistoricalStats ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={engagementChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <Tooltip contentStyle={{fontSize: '14px'}} />
                  <Legend wrapperStyle={{fontSize: '14px', paddingTop: '10px'}} />
                  <Line type="monotone" name="Likes" dataKey="likes" stroke="#6366f1" strokeWidth={2} activeDot={{ r: 8 }} />
                  <Line type="monotone" name="RSVPs" dataKey="rsvps" stroke="#34d399" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardStats;