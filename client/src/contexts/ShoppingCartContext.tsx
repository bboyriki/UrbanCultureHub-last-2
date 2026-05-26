import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Product } from '@shared/schema';
import { toast } from '@/hooks/use-toast';

// Define cart item type
export interface CartItem {
  id: number;
  product: Product;
  quantity: number;
}

// Define the context type
interface ShoppingCartContextType {
  cartItems: CartItem[];
  cartCount: number;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

// Create the context with an initial empty value
const ShoppingCartContext = createContext<ShoppingCartContextType | undefined>(undefined);

// Custom hook to use the shopping cart context
export const useShoppingCart = () => {
  const context = useContext(ShoppingCartContext);
  if (context === undefined) {
    throw new Error('useShoppingCart must be used within a ShoppingCartProvider');
  }
  return context;
};

interface ShoppingCartProviderProps {
  children: ReactNode;
}

// The provider component
export const ShoppingCartProvider: React.FC<ShoppingCartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem('shoppingCart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse shopping cart from localStorage', error);
        localStorage.removeItem('shoppingCart');
      }
    }
  }, []);

  // Save cart to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Get total number of items in cart
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  // Add an item to the cart
  const addToCart = (product: Product, quantity: number) => {
    setCartItems(prevItems => {
      // Check if item already exists in cart
      const existingItem = prevItems.find(item => item.product.id === product.id);
      
      if (existingItem) {
        // Update quantity if item exists
        return prevItems.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      } else {
        // Add new item if it doesn't exist
        return [...prevItems, { id: product.id, product, quantity }];
      }
    });

    // Show toast notification
    toast({
      title: `${quantity} x ${product.name} added to your cart`,
    });
  };

  // Remove an item from the cart
  const removeFromCart = (productId: number) => {
    setCartItems(prevItems => prevItems.filter(item => item.product.id !== productId));
  };

  // Update quantity of an item in the cart
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems(prevItems => 
      prevItems.map(item => 
        item.product.id === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  };

  // Clear the cart
  const clearCart = () => {
    setCartItems([]);
  };

  // Calculate total price of items in cart
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (parseFloat(item.product.price) * item.quantity);
    }, 0);
  };

  // Context value
  const value: ShoppingCartContextType = {
    cartItems,
    cartCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal
  };

  return (
    <ShoppingCartContext.Provider value={value}>
      {children}
    </ShoppingCartContext.Provider>
  );
};