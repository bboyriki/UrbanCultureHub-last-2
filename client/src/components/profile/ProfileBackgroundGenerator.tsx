import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, Check, MoveHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";

// Background theme presets
const THEME_PATTERNS = [
  "linear-gradient(to right, #6366f1, #a855f7, #ec4899)",
  "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
  "linear-gradient(to right, #06b6d4, #3b82f6)",
  "linear-gradient(to bottom right, #f97316, #db2777)",
  "linear-gradient(to right, #0ea5e9, #22d3ee)",
  "linear-gradient(to right, #84cc16, #22c55e)",
  "linear-gradient(to right, #f43f5e, #ec4899)",
  "linear-gradient(to bottom right, #14b8a6, #0ea5e9)",
  "linear-gradient(to right, #8b5cf6, #c026d3)",
  "linear-gradient(to bottom, #fbbf24, #ea580c)",
  "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
  "linear-gradient(to right, #064e3b, #059669)",
  "linear-gradient(to right, #312e81, #4338ca)",
];

// Geometric patterns
const GEOMETRIC_PATTERNS = [
  "radial-gradient(circle at top right, rgba(99, 102, 241, 0.8), transparent 400px), radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.8), transparent 400px), linear-gradient(to right, rgba(14, 165, 233, 0.2), rgba(139, 92, 246, 0.2))",
  "repeating-linear-gradient(45deg, rgba(99, 102, 241, 0.1) 0px, rgba(99, 102, 241, 0.1) 10px, rgba(255, 255, 255, 0) 10px, rgba(255, 255, 255, 0) 20px), linear-gradient(to right, #4f46e5, #7c3aed)",
  "linear-gradient(135deg, rgba(59, 130, 246, 0.7) 0%, rgba(37, 99, 235, 0.8) 100%), repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 5px, rgba(255, 255, 255, 0) 5px, rgba(255, 255, 255, 0) 10px)",
  "radial-gradient(circle at 20% 20%, rgba(236, 72, 153, 0.8) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.8) 0%, transparent 50%), linear-gradient(to bottom right, #0891b2, #4338ca)",
  "linear-gradient(45deg, rgba(20, 184, 166, 0.8) 0%, transparent 70%), linear-gradient(135deg, rgba(6, 182, 212, 0.8) 10%, transparent 80%), linear-gradient(225deg, rgba(2, 132, 199, 0.8) 10%, transparent 80%), linear-gradient(315deg, rgba(79, 70, 229, 0.8) 0%, transparent 70%)",
];

// Artistic patterns
const ARTISTIC_PATTERNS = [
  "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(to right, #eecda3, #ef629f)",
  "linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
  "linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(to right, #ff8177, #ff867a, #ff8c7f, #f99185, #cf556c, #b12a5b)",
  "linear-gradient(to right, #6a11cb 0%, #2575fc 100%)",
  "linear-gradient(to right, #b8cbb8 0%, #b8cbb8 0%, #b465da 0%, #cf6cc9 33%, #ee609c 66%, #ee609c 100%)",
  "linear-gradient(to right, #f83600 0%, #f9d423 100%)",
  "linear-gradient(45deg, #8baaaa 0%, #ae8b9c 100%)",
];

// Dynamic patterns that use a seed for consistency
function getDynamicPattern(seed: number) {
  const patterns = [
    {
      id: "circles",
      generator: (s: number) => {
        const hue1 = Math.floor((s * 137.5) % 360);
        const hue2 = Math.floor((s * 271.3) % 360);
        const size = 150 + (s % 300);
        return `radial-gradient(circle at 25% 25%, hsla(${hue1}, 80%, 60%, 0.8) 0%, transparent ${size}px), 
                radial-gradient(circle at 75% 75%, hsla(${hue2}, 80%, 60%, 0.8) 0%, transparent ${size}px),
                linear-gradient(to right, hsla(${(hue1 + 60) % 360}, 70%, 60%, 0.4), hsla(${(hue2 + 60) % 360}, 70%, 50%, 0.4))`;
      }
    },
    {
      id: "waves",
      generator: (s: number) => {
        const hue1 = Math.floor((s * 137.5) % 360);
        const hue2 = Math.floor((s * 271.3) % 360);
        const angle = Math.floor(s % 360);
        return `linear-gradient(${angle}deg, hsla(${hue1}, 80%, 60%, 0.8), hsla(${hue2}, 80%, 60%, 0.8))`;
      }
    },
    {
      id: "mesh",
      generator: (s: number) => {
        const hue1 = Math.floor((s * 137.5) % 360);
        const hue2 = Math.floor((s * 271.3) % 360);
        const hue3 = Math.floor((s * 193.7) % 360);
        return `radial-gradient(circle at 33% 33%, hsla(${hue1}, 80%, 60%, 0.8) 0%, transparent 50%),
                radial-gradient(circle at 66% 66%, hsla(${hue2}, 80%, 60%, 0.8) 0%, transparent 50%),
                linear-gradient(to right bottom, hsla(${hue3}, 70%, 60%, 0.5), transparent)`;
      }
    }
  ];
  
  // Get deterministic pattern based on seed
  const patternIndex = seed % patterns.length;
  return patterns[patternIndex].generator(seed);
}

interface ProfileBackgroundGeneratorProps {
  currentBackground: string;
  onGenerate: (background: string) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

// Local storage key for background
const LOCAL_STORAGE_KEY_PREFIX = "urban_culture_profile_bg_";

export function ProfileBackgroundGenerator({ 
  currentBackground, 
  onGenerate, 
  opacity,
  onOpacityChange
}: ProfileBackgroundGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Function to generate a random background
  const generateRandomBackground = () => {
    setIsGenerating(true);
    const allPatterns = [...THEME_PATTERNS, ...GEOMETRIC_PATTERNS, ...ARTISTIC_PATTERNS];
    
    // Add dynamic patterns
    const timestamp = new Date().getTime();
    const seed = timestamp;
    const dynamicPattern = getDynamicPattern(seed);
    
    // Get random pattern from combined array
    const randomIndex = Math.floor(Math.random() * (allPatterns.length + 1)); // +1 to include dynamic pattern
    let newBackground;
    
    if (randomIndex === allPatterns.length) {
      // Use the dynamic pattern
      newBackground = dynamicPattern;
    } else {
      // Use one of the predefined patterns
      newBackground = allPatterns[randomIndex];
    }
    
    // Notify parent component about the new background
    onGenerate(newBackground);
    
    setIsGenerating(false);
    return newBackground;
  };

  // Save the background to localStorage
  const saveBackground = (background: string) => {
    // Get a random key for the local storage
    const randomId = Math.floor(Math.random() * 10000);
    const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${randomId}`;
    localStorage.setItem(storageKey, background);
    
    // Notify parent component
    onGenerate(background);
    
    toast({
      title: "Background updated",
    });
  };

  // Handle generate and apply
  const handleGenerateAndApply = () => {
    const newBackground = generateRandomBackground();
    saveBackground(newBackground);
  };

  // Handle apply current
  const handleApplyCurrent = () => {
    if (currentBackground) {
      saveBackground(currentBackground);
    } else {
      toast({
        title: "No background selected",
        variant: "destructive",
      });
    }
  };
  
  // Handle opacity change
  const handleOpacityChange = (value: number[]) => {
    onOpacityChange(value[0]);
    // If we have a current background, update it with the new opacity
    if (currentBackground) {
      // Here we're just telling the parent to update, not changing localStorage yet
      onGenerate(currentBackground);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-background/80 backdrop-blur rounded-md border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Profile Background</h3>
        
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateRandomBackground}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Generate
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Generate a random background</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerateAndApply}
                  disabled={isGenerating}
                  className="relative"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  One-Click Theme
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Generate and apply a random background in one click</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {currentBackground && (
        <div className="space-y-3">
          <div 
            className="w-full h-28 rounded-md overflow-hidden relative"
            style={{ background: currentBackground }}
          >
            <div className="absolute bottom-2 right-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/70 hover:bg-white/90 text-black"
                onClick={handleApplyCurrent}
              >
                <Check className="h-3 w-3 mr-1" />
                Apply
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="opacity-slider" className="text-xs text-muted-foreground flex items-center">
                <MoveHorizontal className="h-3 w-3 mr-1" />
                Background Opacity
              </label>
              <span className="text-xs font-medium">{opacity}%</span>
            </div>
            <Slider
              id="opacity-slider"
              min={10}
              max={100}
              step={5}
              value={[opacity]}
              onValueChange={handleOpacityChange}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}