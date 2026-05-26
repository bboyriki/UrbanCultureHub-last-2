import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, Palette, Paintbrush, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            {theme === "light" && <Sun className="h-5 w-5" />}
            {theme === "dark" && <Moon className="h-5 w-5" />}
            {theme === "system" && <Monitor className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => setTheme("light")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Sun className="h-4 w-4" />
            <span>Light</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("dark")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Moon className="h-4 w-4" />
            <span>Dark</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("system")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Monitor className="h-4 w-4" />
            <span>System</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SimpleThemeToggle({ className }: ThemeSwitcherProps) {
  const { isDarkMode, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className={`h-9 w-9 rounded-full transition-colors relative ${className}`}
          >
            <div className="absolute inset-0 rounded-full bg-primary/10 transition-all duration-300"></div>
            {isDarkMode ? (
              <Sun className="h-5 w-5 transition-transform relative z-10" />
            ) : (
              <Moon className="h-5 w-5 transition-transform relative z-10" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch to {isDarkMode ? "light" : "dark"} mode</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Floating theme button for mobile with drag functionality
export function FloatingThemeButton() {
  const { isDarkMode, theme, setTheme, colorPalette, setColorPalette, availablePalettes } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  return (
    <>
      {/* Floating theme button with drag capability */}
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{ left: -150, right: 150, top: -200, bottom: 200 }}
        dragElastic={0.1}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        onDragEnd={(e, info) => {
          // Update position when drag ends
          const newPosition = {
            x: position.x + info.offset.x,
            y: position.y + info.offset.y
          };
          setPosition(newPosition);
        }}
        style={{ 
          x: position.x, 
          y: position.y 
        }}
        className={`fixed bottom-20 right-6 z-40 rounded-full p-3 shadow-lg 
          ${isDarkMode ? 'bg-black text-white border border-gray-800' : 'bg-white text-gray-800 border border-gray-200'} 
          transition-all duration-300 cursor-move`}
        onClick={() => setShowThemeMenu(!showThemeMenu)}
      >
        <div className="flex flex-col items-center relative">
          <SimpleThemeToggle className="h-5 w-5" />
          <span className="text-xs mt-1 font-medium">Theme</span>
        </div>
      </motion.div>
      
      {/* Theme Settings Menu - positioned relative to the dragged button */}
      <AnimatePresence>
        {showThemeMenu && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{ 
              position: 'fixed',
              bottom: `calc(20rem - ${position.y}px)`, 
              right: `calc(1rem - ${position.x}px)`,
              width: '18rem',
              zIndex: 40
            }}
            className={`rounded-lg shadow-xl overflow-hidden ${isDarkMode ? 'bg-black border border-gray-800' : 'bg-white border border-gray-100'} theme-menu md:w-80`}
          >
            <div className="p-4">
              <h3 className="text-lg font-medium mb-3">Theme Settings</h3>
              
              {/* Appearance Options */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Appearance</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center p-2 rounded-lg ${
                      theme === "light" ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <Sun className="h-5 w-5 mb-1" />
                    <span className="text-xs">Light</span>
                    {theme === "light" && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                  <button 
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center p-2 rounded-lg ${
                      theme === "dark" ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <Moon className="h-5 w-5 mb-1" />
                    <span className="text-xs">Dark</span>
                    {theme === "dark" && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                  <button 
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center p-2 rounded-lg ${
                      theme === "system" ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <Palette className="h-5 w-5 mb-1" />
                    <span className="text-xs">System</span>
                    {theme === "system" && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Color Palettes */}
              <div>
                <h4 className="text-sm font-medium mb-2">Urban Color Themes</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(availablePalettes).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setColorPalette(key as any)}
                      className={`relative flex items-center p-2 rounded-lg ${
                        colorPalette === key ? "bg-primary/10 border border-primary/30" : "border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <PaletteColorDemo 
                        color={value[isDarkMode ? "dark" : "light"].primary} 
                        variant={value[isDarkMode ? "dark" : "light"].variant}
                      />
                      <span className="text-xs ml-2 text-left">{
                        key === "default" ? "Default" :
                        key === "graffiti" ? "Graffiti" :
                        key === "neon" ? "Neon" :
                        key === "streetwear" ? "Streetwear" :
                        key === "industrial" ? "Industrial" :
                        key === "hiphop" ? "Hip-Hop" :
                        key === "minimalist" ? "Minimal" : 
                        key
                      }</span>
                      {colorPalette === key && (
                        <div className="absolute top-1 right-1">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Backdrop for clicking outside */}
      {showThemeMenu && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setShowThemeMenu(false);
          }}
          className="fixed inset-0 bg-black z-30"
        />
      )}
    </>
  );
}

// Color palette circle demo to visualize color choices
export function PaletteColorDemo({ color, variant }: { color: string, variant: "professional" | "tint" | "vibrant" }) {
  const borderVariant = {
    professional: "border-gray-300 dark:border-gray-700",
    tint: "border-gray-200 dark:border-gray-800",
    vibrant: "border-gray-100 dark:border-gray-900"
  };

  return (
    <div 
      className={`w-5 h-5 rounded-full border ${borderVariant[variant]}`} 
      style={{ backgroundColor: color }}
    />
  );
}

export function PaletteSwitcher({ className }: ThemeSwitcherProps) {
  const { colorPalette, setColorPalette, availablePalettes, isDarkMode } = useTheme();
  
  const paletteName = {
    default: "Default Purple",
    graffiti: "Graffiti Blue",
    neon: "Neon City",
    streetwear: "Streetwear",
    industrial: "Industrial",
    hiphop: "Hip-Hop Gold", 
    minimalist: "Minimalist"
  };

  const getPaletteIcon = (palette: string) => {
    switch(palette) {
      case "default": return <Palette className="h-4 w-4" />;
      case "graffiti": return <Paintbrush className="h-4 w-4" />;
      case "neon": return <Palette className="h-4 w-4" />;
      case "streetwear": return <Palette className="h-4 w-4" />;
      case "industrial": return <Palette className="h-4 w-4" />;
      case "hiphop": return <Palette className="h-4 w-4" />;
      case "minimalist": return <Palette className="h-4 w-4" />;
      default: return <Palette className="h-4 w-4" />;
    }
  };

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full transition-colors"
          >
            <Palette className="h-5 w-5" />
            <span className="sr-only">Change color palette</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Urban Color Themes</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.keys(availablePalettes).map((palette) => (
            <DropdownMenuItem
              key={palette}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                palette === colorPalette && "bg-accent"
              )}
              onClick={() => setColorPalette(palette as any)}
            >
              <div className="flex items-center gap-2">
                {getPaletteIcon(palette)}
                <span>{paletteName[palette as keyof typeof paletteName]}</span>
              </div>
              <div className="flex items-center gap-1">
                <PaletteColorDemo 
                  color={availablePalettes[palette as keyof typeof availablePalettes][isDarkMode ? "dark" : "light"].primary} 
                  variant={availablePalettes[palette as keyof typeof availablePalettes][isDarkMode ? "dark" : "light"].variant}
                />
                {palette === colorPalette && (
                  <Check className="h-4 w-4 ml-2" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Combined theme switcher that includes both dark/light mode toggle and palette selection
export function CombinedThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { theme, setTheme, colorPalette, setColorPalette, availablePalettes, isDarkMode } = useTheme();
  
  const paletteName = {
    default: "Default Purple",
    graffiti: "Graffiti Blue",
    neon: "Neon City",
    streetwear: "Streetwear",
    industrial: "Industrial", 
    hiphop: "Hip-Hop Gold",
    minimalist: "Minimalist"
  };
  
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            {theme === "light" && <Sun className="h-5 w-5" />}
            {theme === "dark" && <Moon className="h-5 w-5" />}
            {theme === "system" && <Monitor className="h-5 w-5" />}
            <span className="sr-only">Open theme menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Theme mode selection */}
          <DropdownMenuItem 
            onClick={() => setTheme("light")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Sun className="h-4 w-4" />
            <span>Light</span>
            {theme === "light" && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("dark")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Moon className="h-4 w-4" />
            <span>Dark</span>
            {theme === "dark" && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("system")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Monitor className="h-4 w-4" />
            <span>System</span>
            {theme === "system" && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Urban Color Themes</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Color palette selection */}
          {Object.keys(availablePalettes).map((palette) => (
            <DropdownMenuItem
              key={palette}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                palette === colorPalette && "bg-accent/30"
              )}
              onClick={() => setColorPalette(palette as any)}
            >
              <div className="flex items-center gap-2">
                <PaletteColorDemo 
                  color={availablePalettes[palette as keyof typeof availablePalettes][isDarkMode ? "dark" : "light"].primary} 
                  variant={availablePalettes[palette as keyof typeof availablePalettes][isDarkMode ? "dark" : "light"].variant}
                />
                <span>{paletteName[palette as keyof typeof paletteName]}</span>
              </div>
              {palette === colorPalette && (
                <Check className="h-4 w-4 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}