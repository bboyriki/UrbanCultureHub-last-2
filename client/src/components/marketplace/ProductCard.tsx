import { useState, useEffect } from "react";
import { Product } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, MapPin, Truck, AlertTriangle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canManageProduct } from "@/lib/permissions";
import { ContentManagementMenu } from "@/components/common/ContentManagement";
import { useShoppingCart } from "@/contexts/ShoppingCartContext";
import { useStockUpdates } from "@/hooks/use-stock-updates";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
}

const CONDITION_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-green-100 text-green-800 border-green-200" },
  like_new: { label: "Like New", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-200" },
  fair: { label: "Fair", color: "bg-amber-100 text-amber-800 border-amber-200" },
  poor: { label: "Poor", color: "bg-red-100 text-red-800 border-red-200" },
};

const getProductImage = (images: Product["images"]): string => {
  if (!images) return "";
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      return parsed || "";
    } catch {
      return images;
    }
  }
  if (Array.isArray(images)) {
    return images.find(img => img && img.trim().length > 0) || "";
  }
  return "";
};

const ProductCard: React.FC<ProductCardProps> = ({ product: initialProduct }) => {
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const { addToCart } = useShoppingCart();
  const { getStockUpdate } = useStockUpdates();
  const [product, setProduct] = useState(initialProduct);
  const [hasStockChanged, setHasStockChanged] = useState(false);
  const [imgError, setImgError] = useState(false);

  const stockUpdate = getStockUpdate(initialProduct.id);

  useEffect(() => {
    if (stockUpdate) {
      setProduct(p => ({ ...p, stock: stockUpdate.stock }));
      setHasStockChanged(true);
      const t = setTimeout(() => setHasStockChanged(false), 2000);
      return () => clearTimeout(t);
    }
  }, [stockUpdate]);

  const productImage = getProductImage(product.images);
  const canManage = canManageProduct(user, product.sellerId);
  const isOutOfStock = typeof product.stock === "number" && product.stock === 0;
  const isLowStock = typeof product.stock === "number" && product.stock > 0 && product.stock <= 3;
  const isDeleted = product.status === "deleted";
  const isActive = !isDeleted && !isOutOfStock;

  const condition = (product as any).condition as string | undefined;
  const listingType = (product as any).listingType as string | undefined;
  const deliveryOption = (product as any).deliveryOption as string | undefined;
  const pickupCity = (product as any).pickupCity as string | undefined;
  const brand = (product as any).brand as string | undefined;
  const size = (product as any).size as string | undefined;

  const conditionConfig = condition ? CONDITION_CONFIG[condition] : null;
  const isSecondhand = listingType === "secondhand";
  const isPickup = deliveryOption === "pickup" || deliveryOption === "both";
  const isShipping = deliveryOption === "shipping" || deliveryOption === "both";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border bg-card overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30",
        isDeleted ? "opacity-50" : "",
        hasStockChanged ? "ring-2 ring-amber-400" : ""
      )}
      onClick={() => navigate(`/marketplace/${product.id}`)}
      data-testid={`card-product-${product.id}`}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-muted aspect-square">
        {productImage && !imgError ? (
          <img
            src={productImage}
            alt={product.name || "Product"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isSecondhand && (
            <span className="text-[10px] font-bold bg-background/90 backdrop-blur-sm border px-1.5 py-0.5 rounded-full text-muted-foreground">
              ♻️ 2nd hand
            </span>
          )}
          {conditionConfig && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm bg-white/90", conditionConfig.color)}>
              {conditionConfig.label}
            </span>
          )}
        </div>

        {/* Management menu */}
        {canManage && (
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <ContentManagementMenu
              canManage={canManage}
              contentId={product.id}
              contentType="product"
              onEdit={() => navigate(`/marketplace/edit/${product.id}`)}
              queryKeys={["/api/products"]}
              className="bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full h-8 w-8 shadow"
            />
          </div>
        )}

        {/* Status overlays */}
        {(isOutOfStock || isDeleted) && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-black text-xs font-bold px-3 py-1 rounded-full">
              {isDeleted ? "Unavailable" : "Sold out"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        {/* Brand / size hint */}
        {(brand || size) && (
          <p className="text-xs text-muted-foreground truncate">
            {[brand, size].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">
          {product.name || "Unnamed item"}
        </h3>

        {/* Price row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-base font-bold text-foreground">
            {formatPrice(parseFloat(parseFloat(product.price || "0").toFixed(2)))}
          </span>

          {/* Delivery icons */}
          <div className="flex items-center gap-1">
            {isShipping && (
              <div title="Shipping available">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            {isPickup && pickupCity && (
              <div title={`Pickup in ${pickupCity}`} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="hidden sm:block truncate max-w-[60px]">{pickupCity}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stock info */}
        {isLowStock && !isDeleted && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Only {product.stock} left
          </div>
        )}

        {/* Add to cart button — appears on hover */}
        {isActive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddToCart}
            className="w-full text-xs h-8 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
            data-testid={`button-add-to-cart-${product.id}`}
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Add to cart
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
