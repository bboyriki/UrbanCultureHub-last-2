import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Product, ProductCategory } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShoppingBag, Search, PlusCircle, Tag, SlidersHorizontal,
  Sparkles, ArrowUpDown, X, Package, Flame, Star, TrendingUp, Zap, Shield
} from "lucide-react";
import ProductCard from "@/components/marketplace/ProductCard";
import CreateListingWizard from "@/components/marketplace/CreateListingWizard";
import { cn } from "@/lib/utils";

const CATEGORY_FILTERS = [
  { value: "all", label: "All", emoji: "🛒" },
  { value: ProductCategory.CLOTHING, label: "Clothing", emoji: "👕" },
  { value: ProductCategory.SHOES, label: "Shoes", emoji: "👟" },
  { value: ProductCategory.ACCESSORIES, label: "Accessories", emoji: "🧢" },
  { value: ProductCategory.ARTWORK, label: "Artwork", emoji: "🎨" },
  { value: ProductCategory.VINYL_MUSIC, label: "Vinyl", emoji: "🎵" },
  { value: ProductCategory.EQUIPMENT, label: "Equipment", emoji: "🛹" },
  { value: ProductCategory.BOOKS, label: "Books", emoji: "📚" },
  { value: ProductCategory.COLLECTIBLES, label: "Collectibles", emoji: "✨" },
  { value: ProductCategory.OTHER, label: "Other", emoji: "📦" },
];

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-green-100 text-green-800 border-green-300" },
  like_new: { label: "Like New", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-300" },
  fair: { label: "Fair", color: "bg-amber-100 text-amber-800 border-amber-300" },
  poor: { label: "Poor", color: "bg-red-100 text-red-800 border-red-300" },
};

const TRUST_BADGES = [
  { icon: Shield, label: "Verified Community", color: "text-blue-500" },
  { icon: Zap, label: "Fast Payments", color: "text-yellow-500" },
  { icon: Star, label: "5-Star Sellers", color: "text-orange-500" },
];

export default function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [listingTypeFilter, setListingTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showWizard, setShowWizard] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sell") === "true" && user) setShowWizard(true);
  }, [user]);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let list = products.filter(p => {
      if (p.status === "deleted" && !isAdmin) return false;
      if (p.isDigital) return false;
      return true;
    });
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p as any).brand?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") list = list.filter(p => p.category === categoryFilter);
    if (conditionFilter !== "all") list = list.filter(p => (p as any).condition === conditionFilter);
    if (listingTypeFilter !== "all") list = list.filter(p => (p as any).listingType === listingTypeFilter);
    list = [...list].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
      if (sortBy === "price_asc") return parseFloat(a.price || "0") - parseFloat(b.price || "0");
      if (sortBy === "price_desc") return parseFloat(b.price || "0") - parseFloat(a.price || "0");
      return 0;
    });
    return list;
  }, [products, searchTerm, categoryFilter, conditionFilter, listingTypeFilter, sortBy, isAdmin]);

  const activeFiltersCount = [conditionFilter !== "all" ? 1 : 0, listingTypeFilter !== "all" ? 1 : 0].reduce((a, b) => a + b, 0);
  const clearFilters = () => { setSearchTerm(""); setCategoryFilter("all"); setConditionFilter("all"); setListingTypeFilter("all"); setSortBy("newest"); };
  const totalListings = filteredProducts.length;
  const secondhandCount = products?.filter(p => !p.isDigital && (p as any).listingType === "secondhand" && p.status !== "deleted").length || 0;
  const newCount = products?.filter(p => !p.isDigital && (p as any).listingType === "new" && p.status !== "deleted").length || 0;

  return (
    <div className="min-h-screen bg-background">

      {/* Hero Banner — Urban / Graffiti style */}
      <div className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_50%,_#f97316/15,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_10%_60%,_#7c3aed/10,_transparent_55%)]" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        {/* Floating graffiti-style shapes */}
        <div className="absolute top-4 right-8 text-6xl opacity-10 rotate-12 font-black select-none">SALE</div>
        <div className="absolute bottom-4 right-48 text-4xl opacity-8 -rotate-6 font-black select-none text-orange-400">DRIP</div>

        <div className="container mx-auto px-4 py-10 md:py-16 relative">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="text-xs gap-1.5 bg-orange-500/20 text-orange-400 border-orange-500/30 px-3 py-1">
                  <Flame className="h-3.5 w-3.5" />
                  Urban Culture Marketplace
                </Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 text-white">
                Buy & Sell<br />
                <span className="bg-gradient-to-r from-orange-400 via-red-400 to-yellow-400 bg-clip-text text-transparent">
                  Street Culture
                </span>
              </h1>
              <p className="text-gray-400 text-base mb-6 max-w-lg leading-relaxed">
                Secondhand gear, streetwear, artwork, vinyl and more — directly from people in the urban culture scene.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="lg"
                  onClick={() => setShowWizard(true)}
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/25"
                  data-testid="button-sell-item"
                >
                  <PlusCircle className="h-5 w-5" />
                  Sell an Item
                </Button>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span>{secondhandCount} secondhand</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                    <span>{newCount} new</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats panel */}
            <div className="hidden md:flex flex-col gap-3">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 min-w-[200px]">
                <div className="text-3xl font-black text-white">{(secondhandCount + newCount).toLocaleString()}</div>
                <div className="text-sm text-gray-400 mt-1">Active listings</div>
                <div className="mt-3 space-y-2">
                  {TRUST_BADGES.map(badge => {
                    const Icon = badge.icon;
                    return (
                      <div key={badge.label} className="flex items-center gap-2 text-xs text-gray-400">
                        <Icon className={cn("w-3.5 h-3.5", badge.color)} />
                        {badge.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-5">

        {/* Search + Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items, brands, descriptions…"
              className="pl-10 h-11 rounded-xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger className="w-[130px] h-11 rounded-xl" data-testid="select-condition">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Condition" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conditions</SelectItem>
                {Object.entries(CONDITION_LABELS).map(([val, info]) => (
                  <SelectItem key={val} value={val}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={listingTypeFilter} onValueChange={setListingTypeFilter}>
              <SelectTrigger className="w-[130px] h-11 rounded-xl" data-testid="select-type">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="secondhand">Secondhand ♻️</SelectItem>
                <SelectItem value="new">New ✨</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] h-11 rounded-xl" data-testid="select-sort">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="price_asc">Price: Low to high</SelectItem>
                <SelectItem value="price_desc">Price: High to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_FILTERS.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-all shrink-0",
                categoryFilter === cat.value
                  ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                  : "bg-card border-border text-muted-foreground hover:border-orange-400/50 hover:text-foreground"
              )}
              data-testid={`filter-category-${cat.value}`}
            >
              <span className="text-base leading-none">{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {conditionFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {CONDITION_LABELS[conditionFilter]?.label}
                <button onClick={() => setConditionFilter("all")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {listingTypeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs capitalize">
                {listingTypeFilter}
                <button onClick={() => setListingTypeFilter("all")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline">Clear all</button>
          </div>
        )}

        {/* Trending strip */}
        {!searchTerm && categoryFilter === "all" && !isLoading && filteredProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold">Hot Right Now</span>
              <Badge variant="secondary" className="text-xs">Just In</Badge>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {filteredProducts.slice(0, 6).map(product => (
                <div key={product.id} className="shrink-0 w-40">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border/40" />
          </div>
        )}

        {/* Results count */}
        {!isLoading && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalListings === 0 ? "No listings found" : `${totalListings} listing${totalListings !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full aspect-square rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 flex items-center justify-center mb-5">
              <Package className="h-12 w-12 text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold mb-2">
              {products?.length === 0 ? "The marketplace is empty" : "No listings match your search"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6 leading-relaxed">
              {products?.length === 0
                ? "Be the first to list something. Urban art, streetwear, vinyl — anything goes."
                : "Try different keywords or adjust your filters."}
            </p>
            <div className="flex gap-3">
              {activeFiltersCount > 0 || searchTerm ? (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              ) : null}
              <Button onClick={() => setShowWizard(true)} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
                <PlusCircle className="h-4 w-4" />
                List an item
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Sell Item Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-xl p-0 gap-0 h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-create-listing">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Create a listing
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <CreateListingWizard onSuccess={() => setShowWizard(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
