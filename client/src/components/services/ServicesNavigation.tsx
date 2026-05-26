import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useScreenSize } from "@/hooks/use-mobile";
import { 
  PanelTop, 
  Home, 
  Search, 
  PlusCircle,
  Settings, 
  Package, 
  Calendar,
  User,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationBadgeWrapper from "@/components/badges/NotificationBadgeWrapper";
import { useServicesAccess } from "@/components/services/ServicesGate";

export default function ServicesNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { isMobile, isTablet } = useScreenSize();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { canAccess: canAccessServices } = useServicesAccess();

  const links = [
    {
      href: "/services",
      label: "Browse Services",
      icon: <Search className="w-4 h-4 mr-2" />,
      activeOn: ["/services"],
    },
    {
      href: "/services/my-services",
      label: "My Services",
      icon: <Package className="w-4 h-4 mr-2" />,
      activeOn: ["/services/my-services", "/services/edit", "/services/create"],
      requiresAuth: true,
      requiresServicesAccess: true,
    },
    {
      href: "/bookings",
      label: "My Bookings",
      icon: <Calendar className="w-4 h-4 mr-2" />,
      activeOn: ["/bookings"],
      requiresAuth: true,
      requiresServicesAccess: true,
    },
    {
      href: "/",
      label: "Back to App",
      icon: <Home className="w-4 h-4 mr-2" />,
      activeOn: [],
    },
  ];

  // Filter out links that require auth (or services access) when the user
  // doesn't qualify. This keeps the locked-down marketplace from advertising
  // pages that would just show the "Coming Soon" screen.
  const filteredLinks = links.filter(link => {
    if (link.requiresAuth && !user) return false;
    if (link.requiresServicesAccess && !canAccessServices) return false;
    return true;
  });
  
  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && menuOpen) {
        setMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);
  
  // Close menu when changing location
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Check if a link is active
  const isLinkActive = (link: typeof links[0]) => {
    return link.activeOn.some(path => {
      if (path === location) return true;
      if (path.endsWith('/create') && location.startsWith('/services/create')) return true;
      if (path.endsWith('/edit') && location.startsWith('/services/edit/')) return true;
      return false;
    });
  };

  return (
    <div className="bg-background border-b shadow-sm sticky top-0 z-20 transition-all duration-300">
      <div className="container-fluid py-2">
        <div className="flex justify-between items-center">
          {/* Logo and Title */}
          <div className="flex items-center">
            <PanelTop className="h-5 w-5 mr-2 text-primary transition-colors" />
            <span className="font-bold text-base sm:text-lg whitespace-nowrap">Talent Marketplace</span>
          </div>
          
          {/* Desktop/Tablet Navigation */}
          <div className="hidden sm:flex items-center space-x-2 overflow-x-auto pb-1 hide-scrollbar">
            {filteredLinks.map((link) => {
              const isActive = isLinkActive(link);
              
              return (
                <Button
                  key={link.href}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  asChild
                  className="transition-all duration-200"
                >
                  <Link href={link.href} className="relative">
                    <span className="flex items-center whitespace-nowrap">
                      {link.icon}
                      {link.label}
                    </span>
                    {link.href === "/bookings" && (
                      <NotificationBadgeWrapper section="service" className="absolute -top-1 -right-1 z-10" />
                    )}
                  </Link>
                </Button>
              );
            })}

            {user && location === "/services" && (
              <Button variant="outline" size="sm" asChild className="whitespace-nowrap">
                <Link href="/services/create" className="relative">
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Create Service
                  <NotificationBadgeWrapper section="service-create" className="absolute -top-1 -right-1 z-10" />
                </Link>
              </Button>
            )}
          </div>
          
          {/* Mobile Navigation Toggle */}
          <div className="flex items-center space-x-2 sm:hidden">
            {user && location === "/services" && (
              <Button variant="outline" size="sm" asChild className="p-2">
                <Link href="/services/create" className="relative">
                  <PlusCircle className="w-4 h-4" />
                  <span className="sr-only">Create Service</span>
                  <NotificationBadgeWrapper section="service-create" className="absolute -top-1 -right-1 z-10" />
                </Link>
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-2" 
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
          
          {/* User Authentication Button */}
          {!user && (
            <Button variant="outline" size="sm" asChild className="transition-all duration-200">
              <Link href="/auth">
                <User className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            ref={menuRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden sm:hidden"
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 py-2 space-y-2 bg-background/95 backdrop-blur-sm border-t">
              {filteredLinks.map((link) => {
                const isActive = isLinkActive(link);
                
                return (
                  <Button
                    key={link.href}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    asChild
                    className="w-full justify-start"
                  >
                    <Link href={link.href} className="relative w-full">
                      <span className="flex items-center">
                        {link.icon}
                        {link.label}
                      </span>
                      {link.href === "/bookings" && (
                        <NotificationBadgeWrapper section="service" className="absolute -top-1 -right-1 z-10" />
                      )}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}