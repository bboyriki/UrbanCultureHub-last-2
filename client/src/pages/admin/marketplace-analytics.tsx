import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag, TrendingUp, AlertTriangle, Package,
  BarChart2, Tag, Users, Euro, Star, ArrowRight
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface Analytics {
  overview: {
    totalListings: number;
    totalOrders: number;
    totalRevenue: number;
    recentListings: number;
    outOfStockCount: number;
    lowQualityCount: number;
    uniqueSellers: number;
  };
  categoryBreakdown: { category: string; count: number; avgPrice: number; revenue: number }[];
  conditionBreakdown: { condition: string; count: number }[];
  listingTypeBreakdown: { type: string; count: number }[];
  pricing: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceRanges: Record<string, number>;
  };
  alerts: {
    lowQualityListings: { id: number; name: string; issues: string[] }[];
    outOfStockListings: { id: number; name: string }[];
  };
}

const CATEGORY_EMOJI: Record<string, string> = {
  artwork: "🎨", clothing: "👕", accessories: "🧢", shoes: "👟",
  equipment: "🛹", vinyl_music: "🎵", books: "📚", collectibles: "✨", other: "📦",
};

const CONDITION_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-green-100 text-green-800" },
  like_new: { label: "Like New", color: "bg-emerald-100 text-emerald-800" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800" },
  fair: { label: "Fair", color: "bg-amber-100 text-amber-800" },
  poor: { label: "Poor", color: "bg-red-100 text-red-800" },
};

export default function AdminMarketplaceAnalyticsPage() {
  const [, navigate] = useLocation();

  const { data: analytics, isLoading, error } = useQuery<Analytics>({
    queryKey: ["/api/marketplace/admin/analytics"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load marketplace analytics.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { overview, categoryBreakdown, conditionBreakdown, listingTypeBreakdown, pricing, alerts } = analytics;
  const maxCategoryCount = Math.max(...categoryBreakdown.map(c => c.count), 1);
  const maxPriceRangeCount = Math.max(...Object.values(pricing.priceRanges), 1);

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            Marketplace Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Insights, quality signals, and performance overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/marketplace")}>
          <ShoppingBag className="h-4 w-4 mr-2" />
          View marketplace
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={ShoppingBag}
          label="Total listings"
          value={overview.totalListings}
          iconColor="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          icon={Users}
          label="Unique sellers"
          value={overview.uniqueSellers}
          iconColor="text-blue-600"
          bgColor="bg-blue-100 dark:bg-blue-900/20"
        />
        <StatCard
          icon={TrendingUp}
          label="Orders"
          value={overview.totalOrders}
          iconColor="text-green-600"
          bgColor="bg-green-100 dark:bg-green-900/20"
        />
        <StatCard
          icon={Euro}
          label="Revenue"
          value={`€${overview.totalRevenue.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
          iconColor="text-yellow-600"
          bgColor="bg-yellow-100 dark:bg-yellow-900/20"
        />
        <StatCard
          icon={Star}
          label="New this week"
          value={overview.recentListings}
          iconColor="text-purple-600"
          bgColor="bg-purple-100 dark:bg-purple-900/20"
        />
        <StatCard
          icon={Package}
          label="Out of stock"
          value={overview.outOfStockCount}
          iconColor="text-orange-600"
          bgColor="bg-orange-100 dark:bg-orange-900/20"
          alert={overview.outOfStockCount > 0}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low quality"
          value={overview.lowQualityCount}
          iconColor="text-red-600"
          bgColor="bg-red-100 dark:bg-red-900/20"
          alert={overview.lowQualityCount > 0}
        />
        <StatCard
          icon={Tag}
          label="Avg price"
          value={`€${pricing.avgPrice}`}
          iconColor="text-teal-600"
          bgColor="bg-teal-100 dark:bg-teal-900/20"
        />
      </div>

      {/* Alerts Section */}
      {(alerts.lowQualityListings.length > 0 || alerts.outOfStockListings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.lowQualityListings.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Listings needing improvement ({alerts.lowQualityListings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.lowQualityListings.map(listing => (
                  <div key={listing.id} className="flex items-start justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{listing.name || `Listing #${listing.id}`}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {listing.issues.map(issue => (
                          <Badge key={issue} variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 text-xs"
                      onClick={() => navigate(`/marketplace/${listing.id}`)}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {alerts.outOfStockListings.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <Package className="h-4 w-4" />
                  Out of stock ({alerts.outOfStockListings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.outOfStockListings.map(listing => (
                  <div key={listing.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium truncate">{listing.name || `Listing #${listing.id}`}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 text-xs"
                      onClick={() => navigate(`/marketplace/${listing.id}`)}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Category performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No listings yet</p>
            ) : (
              categoryBreakdown.map(cat => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm flex items-center gap-1.5">
                      {CATEGORY_EMOJI[cat.category] || "📦"}
                      <span className="capitalize">{cat.category.replace("_", " ")}</span>
                    </span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{cat.count} listings</span>
                      <span>avg €{cat.avgPrice}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(cat.count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Price Ranges */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Price distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Min</p>
                <p className="font-bold text-sm">€{pricing.minPrice}</p>
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Avg</p>
                <p className="font-bold text-sm text-primary">€{pricing.avgPrice}</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Max</p>
                <p className="font-bold text-sm">€{pricing.maxPrice}</p>
              </div>
            </div>
            {Object.entries(pricing.priceRanges).map(([range, count]) => (
              <div key={range}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{range}</span>
                  <span className="text-xs font-medium">{count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(count / maxPriceRangeCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Condition Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Item conditions</CardTitle>
          </CardHeader>
          <CardContent>
            {conditionBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-2">
                {conditionBreakdown.map(({ condition, count }) => {
                  const config = CONDITION_CONFIG[condition] || { label: condition, color: "bg-gray-100 text-gray-800" };
                  const total = conditionBreakdown.reduce((s, c) => s + c.count, 0);
                  return (
                    <div key={condition} className="flex items-center gap-3">
                      <Badge className={cn("text-xs w-20 justify-center", config.color)}>{config.label}</Badge>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-current rounded-full opacity-60"
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {count} ({Math.round((count / total) * 100)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Listing Type Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Secondhand vs. New</CardTitle>
          </CardHeader>
          <CardContent>
            {listingTypeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-4">
                {listingTypeBreakdown.map(({ type, count }) => {
                  const total = listingTypeBreakdown.reduce((s, c) => s + c.count, 0);
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize flex items-center gap-2">
                          {type === "secondhand" ? "♻️ Secondhand" : "✨ New"}
                        </span>
                        <span className="text-sm font-bold">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", type === "secondhand" ? "bg-green-500" : "bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, iconColor, bgColor, alert
}: {
  icon: any; label: string; value: string | number;
  iconColor: string; bgColor: string; alert?: boolean;
}) {
  return (
    <Card className={cn(alert && "border-amber-300 dark:border-amber-700")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={cn("p-2 rounded-lg", bgColor)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          {alert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
