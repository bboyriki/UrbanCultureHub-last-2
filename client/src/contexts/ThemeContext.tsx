import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Theme and color palette types
type Theme = "light" | "dark" | "system";
type ColorPalette = 
  | "default"       // Default blue theme
  | "graffiti"      // Vibrant, bold spray paint colors
  | "neon"          // Bright neon colors reminiscent of city lights
  | "streetwear"    // Urban fashion-inspired earthy tones
  | "industrial"    // Raw, concrete and metal tones
  | "hiphop"        // Hip-hop culture inspired palette
  | "minimalist";   // Clean, monochromatic urban style

// Define color palette values (HSL format)
export const PALETTES: Record<ColorPalette, { 
  light: { primary: string, variant: "professional" | "tint" | "vibrant" },
  dark: { primary: string, variant: "professional" | "tint" | "vibrant" }
}> = {
  default: {
    light: { primary: "hsl(221, 83%, 53%)", variant: "professional" },
    dark: { primary: "hsl(221, 83%, 60%)", variant: "professional" }
  },
  graffiti: {
    light: { primary: "hsl(196, 80%, 45%)", variant: "vibrant" }, // Bright blue
    dark: { primary: "hsl(196, 80%, 55%)", variant: "vibrant" }
  },
  neon: {
    light: { primary: "hsl(320, 100%, 60%)", variant: "vibrant" }, // Neon pink
    dark: { primary: "hsl(320, 100%, 70%)", variant: "vibrant" }
  },
  streetwear: {
    light: { primary: "hsl(25, 80%, 45%)", variant: "tint" }, // Urban orange
    dark: { primary: "hsl(25, 80%, 55%)", variant: "tint" }
  },
  industrial: {
    light: { primary: "hsl(200, 15%, 40%)", variant: "professional" }, // Industrial blue-gray
    dark: { primary: "hsl(200, 15%, 60%)", variant: "professional" }
  },
  hiphop: {
    light: { primary: "hsl(45, 90%, 45%)", variant: "vibrant" }, // Gold
    dark: { primary: "hsl(45, 90%, 55%)", variant: "vibrant" }
  },
  minimalist: {
    light: { primary: "hsl(0, 0%, 30%)", variant: "professional" }, // Monochrome
    dark: { primary: "hsl(0, 0%, 70%)", variant: "professional" }
  }
};

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  defaultPalette?: ColorPalette;
  storageKey?: string;
  paletteStorageKey?: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorPalette: ColorPalette;
  setColorPalette: (palette: ColorPalette) => void;
  isDarkMode: boolean;
  availablePalettes: typeof PALETTES;
}

const initialState: ThemeContextType = {
  theme: "system",
  setTheme: () => null,
  colorPalette: "default",
  setColorPalette: () => null,
  isDarkMode: false,
  availablePalettes: PALETTES
};

const ThemeContext = createContext<ThemeContextType>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultPalette = "default",
  storageKey = "urban-culture-theme",
  paletteStorageKey = "urban-culture-palette",
  ...props
}: ThemeProviderProps) {
  // Initialize theme state from localStorage or default
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedTheme = localStorage.getItem(storageKey);
        return (storedTheme as Theme) || defaultTheme;
      } catch (error) {
        console.error('Error accessing localStorage:', error);
        return defaultTheme;
      }
    }
    return defaultTheme;
  });
  
  // Initialize color palette state from localStorage or default
  const [colorPalette, setColorPalette] = useState<ColorPalette>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedPalette = localStorage.getItem(paletteStorageKey);
        return (storedPalette as ColorPalette) || defaultPalette;
      } catch (error) {
        console.error('Error accessing localStorage:', error);
        return defaultPalette;
      }
    }
    return defaultPalette;
  });
  
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Apply theme to HTML element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      
      // Remove class before setting again to avoid duplicates
      root.classList.remove("light", "dark");

      // Set the appropriate theme
      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
        setIsDarkMode(systemTheme === "dark");
      } else {
        root.classList.add(theme);
        setIsDarkMode(theme === "dark");
      }
    }
  }, [theme]);

  // Apply color palette to theme.json via dynamic updating
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Determine if it's dark or light mode
      const effectiveTheme = theme === "system" 
        ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        : theme;
        
      // Get the appropriate palette based on theme
      const paletteConfig = PALETTES[colorPalette][effectiveTheme === "dark" ? "dark" : "light"];
      
      // Update CSS Variables for primary color
      const primaryHSL = paletteConfig.primary;
      // Extract HSL values (hue, saturation, lightness) from the string
      const hslMatch = primaryHSL.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const [_, hue, saturation, lightness] = hslMatch;
        document.documentElement.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
      }
      
      // For extra theme enhancements in the future
      document.documentElement.setAttribute('data-palette', colorPalette);
    }
  }, [colorPalette, theme, isDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      
      const handleChange = () => {
        if (theme === "system") {
          const systemTheme = mediaQuery.matches ? "dark" : "light";
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(systemTheme);
          setIsDarkMode(systemTheme === "dark");
          
          // Update palette colors when system theme changes
          const paletteConfig = PALETTES[colorPalette][systemTheme === "dark" ? "dark" : "light"];
          // Update theme.json primary color
          const primaryHSL = paletteConfig.primary;
          const hslMatch = primaryHSL.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
          if (hslMatch) {
            const [_, hue, saturation, lightness] = hslMatch;
            document.documentElement.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
          }
        }
      };
      
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme, colorPalette]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newTheme);
        } catch (error) {
          console.error('Error setting theme in localStorage:', error);
        }
      }
      setTheme(newTheme);
    },
    colorPalette,
    setColorPalette: (newPalette: ColorPalette) => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(paletteStorageKey, newPalette);
        } catch (error) {
          console.error('Error setting palette in localStorage:', error);
        }
      }
      setColorPalette(newPalette);
    },
    isDarkMode,
    availablePalettes: PALETTES
  };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};