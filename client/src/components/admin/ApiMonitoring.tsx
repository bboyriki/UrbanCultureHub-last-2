import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FixPromptPanel, { FixIssue } from "./FixPromptPanel";
import { format, formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
  BarChart4,
} from "lucide-react";

// Interface for API status
interface ApiStatus {
  name: string;
  isConfigured: boolean;
  status: "active" | "inactive" | "error" | "slow";
  errorMessage?: string;
  lastChecked: Date;
  responseTime?: number; // in ms
  uptime?: number; // percentage
  performance?: "good" | "average" | "poor";
  consecutiveFailures?: number;
  statusHistory?: Array<{
    timestamp: Date;
    status: "active" | "inactive" | "error" | "slow";
    responseTime?: number;
    errorMessage?: string;
  }>;
}

// Interface for all API statuses
interface ApiIntegrations {
  stripe: ApiStatus;
  sendgrid: ApiStatus;
  cloudinary: ApiStatus;
  firebase: ApiStatus;
  googleMaps: ApiStatus;
  [key: string]: ApiStatus; // For any additional APIs
}

// Component for displaying API history
const ApiHistory = ({ api }: { api: ApiStatus }) => {
  // In a real app, this would fetch history from an endpoint
  const history = api.statusHistory || [];
  const isLoading = false;

  if (isLoading) {
    return <div className="text-center py-4">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">No history data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{api.name} Status History</h3>
      <Table>
        <TableCaption>Recent status changes for {api.name}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Response Time</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={entry.status} />
              </TableCell>
              <TableCell>
                {entry.responseTime ? `${entry.responseTime}ms` : "N/A"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {entry.errorMessage || "OK"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: "active" | "inactive" | "error" | "slow" }) => {
  const variants: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
    active: {
      variant: "success",
      icon: <CheckCircle2 className="h-4 w-4 mr-1" />,
      label: "Active",
    },
    inactive: {
      variant: "outline",
      icon: <Clock className="h-4 w-4 mr-1" />,
      label: "Inactive",
    },
    error: {
      variant: "destructive",
      icon: <XCircle className="h-4 w-4 mr-1" />,
      label: "Error",
    },
    slow: {
      variant: "warning",
      icon: <AlertTriangle className="h-4 w-4 mr-1" />,
      label: "Slow",
    },
  };

  const { variant, icon, label } = variants[status];

  return (
    <Badge variant={variant} className="flex items-center">
      {icon}
      {label}
    </Badge>
  );
};

// Performance Badge Component
const PerformanceBadge = ({ 
  performance 
}: { 
  performance: "good" | "average" | "poor" | undefined 
}) => {
  if (!performance) return null;
  
  const variants: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
    good: {
      variant: "success",
      icon: <CheckCircle2 className="h-4 w-4 mr-1" />,
      label: "Good",
    },
    average: {
      variant: "warning",
      icon: <AlertTriangle className="h-4 w-4 mr-1" />,
      label: "Average",
    },
    poor: {
      variant: "destructive",
      icon: <AlertCircle className="h-4 w-4 mr-1" />,
      label: "Poor",
    },
  };

  const { variant, icon, label } = variants[performance];

  return (
    <Badge variant={variant} className="flex items-center ml-2">
      {icon}
      {label}
    </Badge>
  );
};

// API Detail Dialog Component
const ApiDetailDialog = ({ api }: { api: ApiStatus }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Info className="h-4 w-4 mr-1" />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {api.name} API Integration 
            <StatusBadge status={api.status} />
            {api.performance && (
              <PerformanceBadge performance={api.performance} />
            )}
          </DialogTitle>
          <DialogDescription>
            Detailed information and performance metrics
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <div className="flex items-center mt-1">
                  <StatusBadge status={api.status} />
                </div>
              </div>
              
              <div>
                <Label>Last Checked</Label>
                <div className="mt-1">
                  {api.lastChecked ? (
                    <>
                      <div>{format(new Date(api.lastChecked), "MMM d, yyyy h:mm a")}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(api.lastChecked), { addSuffix: true })}
                      </div>
                    </>
                  ) : (
                    "Never"
                  )}
                </div>
              </div>
              
              <div>
                <Label>Configuration Status</Label>
                <div className="mt-1">
                  {api.isConfigured ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Missing Configuration
                    </Badge>
                  )}
                </div>
              </div>
              
              <div>
                <Label>Response Time</Label>
                <div className="mt-1">
                  {api.responseTime ? `${api.responseTime}ms` : "N/A"}
                </div>
              </div>
              
              <div className="col-span-2">
                <Label>Uptime</Label>
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span>{api.uptime ? `${api.uptime}%` : "N/A"}</span>
                  </div>
                  {api.uptime && (
                    <Progress value={api.uptime} className="h-2" />
                  )}
                </div>
              </div>
            </div>
            
            {api.errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {api.errorMessage}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="history">
            <ApiHistory api={api} />
          </TabsContent>
          
          <TabsContent value="performance">
            <div className="text-center py-10">
              <BarChart4 className="h-16 w-16 mx-auto text-primary opacity-20" />
              <p className="mt-4 text-muted-foreground">
                Performance metrics will be available in future updates
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {api.isConfigured ? "API is configured" : "API requires configuration"}
          </span>
          <Button>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ApiMonitoring = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notificationSent, setNotificationSent] = useState<Record<string, boolean>>({});

  // Query to fetch API integration statuses
  const { 
    data: apiIntegrations, 
    isLoading, 
    isError, 
    error,
    refetch
  } = useQuery({
    queryKey: ["/api/admin/integrations"],
    queryFn: async () => {
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const res = await apiRequest("/api/admin/integrations", "GET", { adminId: user.id });
      if (!res.ok) {
        throw new Error("Failed to fetch API integration statuses");
      }

      return await res.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Handle API error notification
  useEffect(() => {
    if (apiIntegrations) {
      Object.keys(apiIntegrations).forEach(key => {
        const api = apiIntegrations[key];
        if (api.status === "error" && !notificationSent[key]) {
          toast({
            title: `${api.name} API Error`,
            description: api.errorMessage || "An error occurred with the API integration",
            variant: "destructive",
          });
          setNotificationSent(prev => ({ ...prev, [key]: true }));
        }
      });
    }
  }, [apiIntegrations, toast, notificationSent]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const apiFixIssues: FixIssue[] = useMemo(() => {
    if (!apiIntegrations) return [];
    return Object.values(apiIntegrations as Record<string, any>)
      .filter((api: any) => api.status === "error" || api.status === "inactive" || !api.isConfigured)
      .map((api: any) => ({
        severity: api.status === "error" ? ("high" as const) : ("moderate" as const),
        title: `${api.name} integration is ${api.status}`,
        detail: api.errorMessage
          || (!api.isConfigured ? "API key or credentials not configured" : "Service unavailable or unreachable"),
        category: "API Integration",
        recommendation: !api.isConfigured
          ? "Add the required API key/secret to your environment variables (Replit Secrets)"
          : "Check your API credentials, quota limits, and service status page",
      }));
  }, [apiIntegrations]);

  // Handle the manual refresh of API statuses
  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing API Status",
      description: "Checking all API integrations...",
    });
  };

  // Calculate overall health percentage
  const calculateOverallHealth = () => {
    if (!apiIntegrations) return 0;
    
    const apis = Object.values(apiIntegrations);
    const activeCount = apis.filter(api => api.status === "active").length;
    return Math.round((activeCount / apis.length) * 100);
  };

  const healthPercentage = calculateOverallHealth();
  
  // Determine overall health status
  const getHealthStatus = () => {
    if (healthPercentage > 90) return "good";
    if (healthPercentage > 70) return "average";
    return "poor";
  };
  
  const healthStatus = getHealthStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Integration Status</CardTitle>
          <CardDescription>Loading API integration status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Integration Status</CardTitle>
          <CardDescription>Failed to load API integration status</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "An unknown error occurred"}
            </AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>API Integration Status</CardTitle>
            <CardDescription>
              Status and health of all connected APIs
            </CardDescription>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Health Section */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Overall System Health</h3>
            <PerformanceBadge performance={healthStatus} />
          </div>
          <div className="flex items-center mt-1">
            <div className="flex-1 mr-4">
              <Progress value={healthPercentage} className="h-2" />
            </div>
            <span className="text-sm font-medium">{healthPercentage}%</span>
          </div>
        </div>
        
        {/* API List */}
        <div className="border rounded-md divide-y">
          {apiIntegrations && Object.keys(apiIntegrations).map((key) => {
            const api = apiIntegrations[key];
            const isExpanded = expanded[key] || false;
            
            return (
              <div key={key} className="hover:bg-muted/50 transition-colors">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-center space-x-3">
                    <StatusBadge status={api.status} />
                    <span className="font-medium">{api.name}</span>
                    {api.performance && (
                      <PerformanceBadge performance={api.performance} />
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <ApiDetailDialog api={api} />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div className="font-medium">
                          {api.isConfigured ? (
                            <span className="text-green-600">Configured</span>
                          ) : (
                            <span className="text-amber-600">Not Configured</span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Uptime</Label>
                        <div className="font-medium">{api.uptime ? `${api.uptime}%` : "N/A"}</div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Response Time</Label>
                        <div className="font-medium">{api.responseTime ? `${api.responseTime}ms` : "N/A"}</div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Checked</Label>
                        <div className="font-medium">
                          {formatDistanceToNow(new Date(api.lastChecked), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    
                    {api.errorMessage && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error Details</AlertTitle>
                        <AlertDescription>
                          {api.errorMessage}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      
      <CardFooter className="border-t pt-4 flex flex-col gap-3 items-stretch">
        <FixPromptPanel section="API Status" issues={apiFixIssues} />
        <p className="text-sm text-muted-foreground">
          Last updated: {apiIntegrations ? format(new Date(), "PPp") : "Never"}
        </p>
      </CardFooter>
    </Card>
  );
};

export default ApiMonitoring;