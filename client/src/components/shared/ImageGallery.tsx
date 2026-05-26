import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ImageIcon, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ImageGalleryProps {
  images: string[] | string | any;
  className?: string;
}

const ImageGallery = ({ images = [], className }: ImageGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [validImages, setValidImages] = useState<string[]>([]);
  const [debugInfo, setDebugInfo] = useState<{
    originalInput: any,
    processedInput: any,
    filteredUrls: string[]
  }>({
    originalInput: null,
    processedInput: null,
    filteredUrls: []
  });
  
  // Filter and validate images on mount and when images prop changes
  useEffect(() => {
    // Start with a clean slate
    setImageErrors({});
    
    // Store original input for debugging
    setDebugInfo(prev => ({...prev, originalInput: images}));
    
    // Handle various image data formats
    let imagesToProcess = images || [];
    
    // If images is a string that might be JSON, try to parse it
    if (typeof imagesToProcess === 'string') {
      try {
        // Check if it's a JSON string - should start with [ or { 
        if (imagesToProcess.trim().startsWith('[') || imagesToProcess.trim().startsWith('{')) {
          console.log("Attempting to parse JSON string:", imagesToProcess);
          const parsed = JSON.parse(imagesToProcess);
          imagesToProcess = Array.isArray(parsed) ? parsed : [imagesToProcess];
          console.log("Successfully parsed JSON to:", imagesToProcess);
        } else {
          // If it doesn't look like JSON, treat it as a single URL
          console.log("String doesn't appear to be JSON, treating as URL:", imagesToProcess);
          imagesToProcess = [imagesToProcess];
        }
      } catch (e) {
        // If parsing fails, treat it as a single image URL
        console.warn("Failed to parse image string as JSON:", e);
        imagesToProcess = [imagesToProcess];
      }
    } else if (!Array.isArray(imagesToProcess)) {
      // If it's not an array and not a string, convert to array with the value
      console.log("Non-array, non-string image value:", imagesToProcess);
      imagesToProcess = imagesToProcess ? [imagesToProcess] : [];
    }
    
    // Store processed input for debugging
    setDebugInfo(prev => ({...prev, processedInput: imagesToProcess}));
    
    // Filter out empty/null/undefined values and log details for debugging
    const filteredImages = Array.isArray(imagesToProcess) 
      ? imagesToProcess.filter((url: any, index: number) => {
          const isValid = !!url && typeof url === 'string' && url.trim().length > 0;
          if (!isValid) {
            console.warn(`Invalid image URL at index ${index}:`, url);
          }
          return isValid;
        })
      : [];
    
    // Store filtered URLs for debugging  
    setDebugInfo(prev => ({...prev, filteredUrls: filteredImages}));
    
    console.log("Image gallery processing results:", {
      originalType: typeof images,
      originalValue: images,
      isArray: Array.isArray(images),
      processedType: typeof imagesToProcess,
      processedIsArray: Array.isArray(imagesToProcess),
      filteredCount: filteredImages.length,
      filteredImages: filteredImages
    });
    
    setValidImages(filteredImages);
    
    // Reset current index if it's out of bounds
    if (currentIndex >= filteredImages.length) {
      setCurrentIndex(filteredImages.length > 0 ? 0 : -1);
    }
  }, [images]);
  
  // Don't render the gallery if no valid images are available
  if (!validImages || validImages.length === 0) {
    return (
      <div className={cn("w-full aspect-square bg-muted flex items-center justify-center rounded-lg", className)}>
        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">No images available</p>
          
          {/* Debug info for development purposes */}
          <div className="mt-4 text-xs text-left w-full max-w-xs">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="inline-flex items-center text-amber-600 hover:text-amber-800 mb-2">
                    <Info className="h-3 w-3 mr-1" /> Debug info
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm text-xs">
                  This shows debugging information about the image data.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="bg-gray-100 p-2 rounded text-gray-600 overflow-auto max-h-40">
              <p><strong>Input type:</strong> {typeof debugInfo.originalInput}</p>
              <p><strong>Is array:</strong> {Array.isArray(debugInfo.originalInput) ? 'yes' : 'no'}</p>
              {typeof debugInfo.originalInput === 'string' && (
                <p><strong>Input string:</strong> {debugInfo.originalInput.substring(0, 50)}{debugInfo.originalInput.length > 50 ? '...' : ''}</p>
              )}
              <p><strong>Processed items:</strong> {Array.isArray(debugInfo.processedInput) ? debugInfo.processedInput.length : 'not an array'}</p>
              <p><strong>Valid images:</strong> {debugInfo.filteredUrls.length}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there's only one valid image, render it without controls
  if (validImages.length === 1) {
    return (
      <div className={cn("w-full h-full", className)}>
        <img
          src={validImages[0]}
          alt="Product image"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://placehold.co/600x600/e2e8f0/1a202c?text=Image+Not+Available";
            e.currentTarget.className = "w-full h-full object-contain p-4";
            console.error("Failed to load the single image:", validImages[0]);
          }}
        />
        
        {/* Small debug indicator for development - absolute positioned so it doesn't take space */}
        <div className="absolute bottom-1 right-1 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center text-xs bg-background/70 px-1 py-0.5 rounded text-amber-600 hover:text-amber-800">
                  <Info className="h-3 w-3 mr-1" /> 
                  <span className="text-xs">Image data</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-sm">
                <div className="text-xs">
                  <p><strong>Source:</strong> {validImages[0].substring(0, 40)}{validImages[0].length > 40 ? '...' : ''}</p>
                  <p><strong>Original count:</strong> {Array.isArray(debugInfo.originalInput) ? debugInfo.originalInput.length : 'N/A'}</p>
                  <p><strong>Input type:</strong> {typeof debugInfo.originalInput}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  const prevImage = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? validImages.length - 1 : prevIndex - 1
    );
  };

  const nextImage = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === validImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const selectImage = (index: number) => {
    setCurrentIndex(index);
  };

  // Handler for image loading errors
  const handleImageError = (index: number) => {
    setImageErrors(prev => ({
      ...prev,
      [index]: true
    }));
    console.error(`Failed to load image at index ${index}`);
  };

  return (
    <div className={cn("w-full h-full", className)}>
      {/* Main image with navigation arrows - matches ProductCard aspect ratio */}
      <div className="relative w-full h-full">
        {imageErrors[currentIndex] ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-2 text-amber-500" />
              <p className="text-sm">Image could not be loaded</p>
            </div>
          </div>
        ) : (
          <img
            src={validImages[currentIndex]}
            alt={`Product image ${currentIndex + 1}`}
            className="w-full h-full object-cover"
            onError={() => handleImageError(currentIndex)}
          />
        )}
        
        {/* Only show navigation buttons if we have multiple valid images */}
        {validImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background/90 z-10"
              onClick={prevImage}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background/90 z-10"
              onClick={nextImage}
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
        
        {/* Thumbnail navigation - absolute positioning at bottom */}
        {validImages.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-2 px-2 z-10">
            {validImages.map((image, index) => (
              <button
                key={index}
                className={cn(
                  "w-10 h-10 rounded border-2 flex-shrink-0 overflow-hidden transition-all bg-background/70",
                  currentIndex === index 
                    ? "border-primary" 
                    : "border-transparent opacity-70 hover:opacity-100",
                  imageErrors[index] ? "bg-muted" : ""
                )}
                onClick={() => selectImage(index)}
                aria-label={`View image ${index + 1}`}
              >
                {imageErrors[index] ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-amber-500/50" />
                  </div>
                ) : (
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(index)}
                  />
                )}
              </button>
            ))}
          </div>
        )}
        
        {/* Debug tools - absolute positioned */}
        <div className="absolute bottom-1 right-1 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center text-xs bg-background/70 px-1 py-0.5 rounded text-amber-600 hover:text-amber-800">
                  <Info className="h-3 w-3 mr-1" /> 
                  <span className="text-xs">Images {currentIndex+1}/{validImages.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-sm">
                <div className="text-xs space-y-1 max-h-60 overflow-auto">
                  <p><strong>Input type:</strong> {typeof debugInfo.originalInput}</p>
                  <p><strong>Is array:</strong> {Array.isArray(debugInfo.originalInput) ? 'yes' : 'no'}</p>
                  <p><strong>Original image count:</strong> {Array.isArray(debugInfo.originalInput) ? debugInfo.originalInput.length : 'N/A'}</p>
                  <p><strong>Valid images:</strong> {debugInfo.filteredUrls.length}</p>
                  <div className="mt-2">
                    <p className="font-medium">Image URLs:</p>
                    <ul className="text-[10px] pl-2 mt-1 space-y-1">
                      {validImages.map((url, i) => (
                        <li key={i} className={i === currentIndex ? "font-bold" : ""}>
                          {i+1}: {url.substring(0, 30)}{url.length > 30 ? '...' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default ImageGallery;