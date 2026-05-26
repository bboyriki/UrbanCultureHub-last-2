import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useShoppingCart } from "@/contexts/ShoppingCartContext";
import { getQueryFn } from "@/lib/queryClient";
import { formatPrice, cn } from "@/lib/utils";
import { Product, User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ShoppingCart, MapPin, Truck, Package,
  User as UserIcon, AlertTriangle, CheckCircle, RefreshCcw,
  MessageCircle, Share2, Heart
} from "lucide-react";
import ImageGallery from "@/components/shared/ImageGallery";
import CheckoutDialog from "@/components/marketplace/CheckoutDialog";
import { useStockUpdates } from "@/hooks/use-stock-updates";

const CONDITION_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  new: { label: "New", color: "bg-green-100 text-green-800 border-green-200", description: "Never used, with original tags" },
  like_new: { label: "Like New", color: "bg-emerald-100 text-emerald-800 border-emerald-200", description: "Used once or twice, no visible wear" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-200", description: "Light use, minor wear" },
  fair: { label: "Fair", color: "bg-amber-100 text-amber-800 border-amber-200", description: "Visible wear but functional" },
  poor: { label: "Poor", color: "bg-red-100 text-red-800 border-red-200", description: "Heavy use or damage" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  artwork: "🎨", clothing: "👕", accessories: "🧢", shoes: "👟",
  equipment: "🛹", vinyl_music: "🎵", books: "📚", collectibles: "✨", other: "📦",
};

function processImages(images: Product["images"]): string[] {
  if (!images) return [];
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return parsed ? [parsed] : [];
    } catch {
      return images.trim() ? [images] : [];
    }
  }
  if (Array.isArray(images)) return images.filter(img => img && img.trim());
  return [];
}

export default function ProductDetailPage() {
  const [, params] = useRoute("/marketplace/:id");
  const productId = params?.id ? (isNaN(parseInt(params.id)) ? null : parseInt(params.id)) : null;

  const { toast } = useToast();
  const { user } = useAuth();
  const { addToCart } = useShoppingCart();
  const [quantity, setQuantity] = useState(1);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [hasStockChanged, setHasStockChanged] = useState(false);
  const queryClient = useQueryClient();
  const { getStockUpdate } = useStockUpdates(productId || undefined);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/products", productId],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!productId,
  });

  const { data: seller } = useQuery<User>({
    queryKey: [`/api/users/${product?.sellerId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!product?.sellerId,
  });

  useEffect(() => {
    if (!product || !productId) return;
    const stockUpdate = getStockUpdate(productId);
    if (stockUpdate) {
      queryClient.setQueryData(["/api/products", productId], { ...product, stock: stockUpdate.stock });
      setHasStockChanged(true);
      const t = setTimeout(() => setHasStockChanged(false), 2000);
      return () => clearTimeout(t);
    }
  }, [getStockUpdate, product, productId, queryClient]);

  if (isLoading) return <DetailSkeleton />;

  if (!product) {
    return (
      <div className="container mx-auto py-10 px-4 text-center">
        <p className="text-muted-foreground mb-4">This listing could not be found.</p>
        <Link href="/marketplace">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to marketplace
          </Button>
        </Link>
      </div>
    );
  }

  const images = processImages(product.images);
  const productPrice = parseFloat(product.price || "0");
  const isOutOfStock = typeof product.stock === "number" && product.stock === 0;
  const isLowStock = typeof product.stock === "number" && product.stock > 0 && product.stock <= 5;
  const isActive = product.status !== "deleted" && !isOutOfStock;

  const condition = (product as any).condition as string | undefined;
  const listingType = (product as any).listingType as string | undefined;
  const deliveryOption = (product as any).deliveryOption as string | undefined;
  const pickupCity = (product as any).pickupCity as string | undefined;
  const pickupAddress = (product as any).pickupAddress as string | undefined;
  const brand = (product as any).brand as string | undefined;
  const size = (product as any).size as string | undefined;
  const color = (product as any).color as string | undefined;
  const shippingCost = (product as any).shippingCost as string | undefined;

  const conditionInfo = condition ? CONDITION_CONFIG[condition] : null;
  const categoryEmoji = CATEGORY_EMOJI[product.category] || "📦";
  const isPickup = deliveryOption === "pickup" || deliveryOption === "both";
  const isShipping = deliveryOption === "shipping" || deliveryOption === "both";
  const shippingFree = !shippingCost || parseFloat(shippingCost) === 0;
  const isSecondhand = listingType === "secondhand";

  const handleAddToCart = () => addToCart(product, quantity);

  const handleBuyNow = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to purchase.", variant: "destructive" });
      return;
    }
    setShowCheckoutDialog(true);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: product.name || "Check this out", url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Back */}
      <Link href="/marketplace">
        <Button variant="ghost" size="sm" className="mb-5 gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Button>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: Images */}
        <div className="space-y-3">
          {hasStockChanged && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-700">
              <RefreshCcw className="h-4 w-4 animate-spin" />
              Stock updated — {product.stock === 0 ? "Now out of stock" : `${product.stock} available`}
            </div>
          )}

          {images.length > 0 ? (
            <div className={cn("rounded-xl overflow-hidden bg-muted relative", hasStockChanged && "ring-2 ring-amber-400")}>
              <div className="relative pt-[100%]">
                <ImageGallery images={images} className="absolute inset-0 w-full h-full object-cover" />
                {(isOutOfStock || product.status === "deleted") && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-white text-black font-bold px-4 py-2 rounded-full text-sm">
                      {product.status === "deleted" ? "No longer available" : "Sold out"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted aspect-square flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}

          {/* Condition & listing type pills */}
          <div className="flex flex-wrap gap-2">
            {isSecondhand && (
              <Badge variant="outline" className="gap-1 text-xs">
                <span>♻️</span> Secondhand
              </Badge>
            )}
            {conditionInfo && (
              <Badge className={cn("text-xs border", conditionInfo.color)}>
                {conditionInfo.label}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-xs capitalize">
              {categoryEmoji} {product.category}
            </Badge>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col gap-5">
          {/* Title + price */}
          <div>
            {(brand || size) && (
              <p className="text-sm text-muted-foreground mb-1">
                {[brand, size && `Size ${size}`, color].filter(Boolean).join(" · ")}
              </p>
            )}
            <h1 className="text-2xl font-bold leading-snug mb-3">{product.name}</h1>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{formatPrice(productPrice)}</span>
              {isShipping && (
                <span className="text-sm text-muted-foreground">
                  {shippingFree ? "+ free shipping" : `+ €${parseFloat(shippingCost || "0").toFixed(2)} shipping`}
                </span>
              )}
            </div>
          </div>

          {/* Condition detail */}
          {conditionInfo && (
            <div className={cn("rounded-lg p-3 border text-sm flex items-start gap-2", conditionInfo.color)}>
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">{conditionInfo.label}:</span> {conditionInfo.description}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {product.description || "No description provided."}
            </p>
          </div>

          {/* Delivery */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold mb-2">Delivery options</h3>
              {isShipping && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Shipping available
                    {shippingFree ? " — free" : ` — €${parseFloat(shippingCost || "0").toFixed(2)}`}
                  </span>
                </div>
              )}
              {isPickup && (
                <div className="flex items-center gap-2.5 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Pickup in {pickupCity}
                    {pickupAddress ? ` — ${pickupAddress}` : ""}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seller */}
          {seller && (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {seller.profilePicture ? (
                  <img src={seller.profilePicture} alt={seller.displayName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Seller</p>
                <p className="text-sm font-semibold truncate">{seller.displayName}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs gap-1 shrink-0" onClick={() => window.location.href = `/profile/${seller.id}`}>
                <MessageCircle className="h-3.5 w-3.5" />
                Contact
              </Button>
            </div>
          )}

          {/* Stock warning */}
          {isLowStock && !isOutOfStock && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Only {product.stock} left in stock
            </div>
          )}

          {/* Quantity + CTA */}
          {isActive ? (
            <div className="space-y-3">
              {product.stock !== null && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Qty:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >-</Button>
                    <span className="text-sm font-medium w-6 text-center">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(q => Math.min(product.stock ?? 99, q + 1))}
                      disabled={typeof product.stock === "number" && quantity >= product.stock}
                    >+</Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleAddToCart}
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to cart
                </Button>
                <Button
                  onClick={handleBuyNow}
                  className="gap-2"
                  data-testid="button-buy-now"
                >
                  Buy now
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-muted-foreground"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
                Share listing
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 border rounded-lg bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">
                {product.status === "deleted" ? "This item is no longer available" : "This item is sold out"}
              </p>
            </div>
          )}

          {/* Extra details */}
          {(brand || size || color || condition) && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                {brand && (
                  <div>
                    <span className="text-muted-foreground">Brand</span>
                    <p className="font-medium">{brand}</p>
                  </div>
                )}
                {size && (
                  <div>
                    <span className="text-muted-foreground">Size</span>
                    <p className="font-medium">{size}</p>
                  </div>
                )}
                {color && (
                  <div>
                    <span className="text-muted-foreground">Color</span>
                    <p className="font-medium">{color}</p>
                  </div>
                )}
                {conditionInfo && (
                  <div>
                    <span className="text-muted-foreground">Condition</span>
                    <p className="font-medium">{conditionInfo.label}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CheckoutDialog
        isOpen={showCheckoutDialog}
        onClose={() => setShowCheckoutDialog(false)}
        product={product}
        quantity={quantity}
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <Skeleton className="h-8 w-40 mb-5" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
