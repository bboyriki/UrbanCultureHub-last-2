import React, { useState } from 'react';
import { useShoppingCart } from '@/contexts/ShoppingCartContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import CartCheckoutDialog from './CartCheckoutDialog';
import { formatPrice } from '@/lib/utils';

export const CartDrawer = () => {
  const { cartItems, cartCount, removeFromCart, updateQuantity, clearCart, getCartTotal } = useShoppingCart();
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { user } = useAuth();
  
  const handleRemoveItem = (productId: number) => {
    removeFromCart(productId);
    toast({
      title: "Item has been removed from your cart",
    });
  };
  
  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(productId, newQuantity);
    }
  };
  
  const handleClearCart = () => {
    clearCart();
    toast({
      title: "All items have been removed from your cart",
    });
  };
  
  const handleProceedToCheckout = () => {
    if (!user) {
      toast({
        title: "Please log in to continue with checkout",
        variant: "destructive",
      });
      return;
    }
    
    // Open checkout dialog and close the cart drawer
    setCheckoutOpen(true);
    setOpen(false);
  };
  
  // Using the imported formatPrice function from utils
  
  return (
    <>
      <CartCheckoutDialog 
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge variant="secondary" className="absolute -top-2 -right-2 px-1 min-w-[20px] flex items-center justify-center">
                {cartCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle>Your Shopping Cart</SheetTitle>
          <SheetDescription>
            {cartCount === 0 ? 'Your cart is empty' : `You have ${cartCount} items in your cart`}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex flex-col gap-4 my-4 max-h-[60vh] overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Your cart is empty</p>
              <Button variant="outline" className="mt-4" onClick={() => setOpen(false)} asChild>
                <Link href="/marketplace">Browse Products</Link>
              </Button>
            </div>
          ) : (
            cartItems.map((item) => (
              <Card key={item.product.id} className="relative">
                <CardContent className="p-4 flex gap-4">
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {item.product.images && item.product.images.length > 0 ? (
                      <img 
                        src={item.product.images[0]} 
                        alt={item.product.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <ShoppingCart className="h-8 w-8 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-sm">{item.product.name}</h4>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={() => handleRemoveItem(item.product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {item.product.description}
                    </p>
                    
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center border rounded-md">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-none" 
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-none" 
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-medium">
                        {formatPrice(item.product.price)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        {cartItems.length > 0 && (
          <>
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{formatPrice(getCartTotal().toString())}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPrice(getCartTotal().toString())}</span>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleClearCart}
                >
                  Clear Cart
                </Button>
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={handleProceedToCheckout}
                  disabled={!user}
                >
                  Checkout
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
};

export default CartDrawer;