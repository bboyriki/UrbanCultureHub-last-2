import React from 'react';
import { MapPin } from 'lucide-react';

interface MapPreviewProps {
  height?: number;
}

/**
 * A simplified map preview component used in the explore page
 * This is a static representation of the map with some markers
 */
const MapPreview: React.FC<MapPreviewProps> = ({ height = 200 }) => {
  return (
    <div 
      className="w-full relative bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* Simplified map background with grid lines */}
      <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 opacity-40 grid grid-cols-4 grid-rows-4">
        {Array.from({ length: 16 }).map((_, index) => (
          <div key={index} className="border border-gray-300 dark:border-gray-600 border-opacity-20"></div>
        ))}
      </div>
      
      {/* Decorative map elements */}
      <div className="absolute left-[20%] top-[30%] w-2/5 h-1/6 bg-gray-300 dark:bg-gray-600 rounded-full opacity-20"></div>
      <div className="absolute right-[15%] bottom-[25%] w-1/4 h-1/5 bg-gray-300 dark:bg-gray-600 rounded-full opacity-20"></div>
      <div className="absolute right-[30%] top-[15%] w-1/5 h-1/4 bg-gray-300 dark:bg-gray-600 rounded-sm opacity-20"></div>
      
      {/* Map markers */}
      <div className="absolute left-[25%] top-[30%] transform -translate-x-1/2 -translate-y-1/2">
        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
      </div>
      <div className="absolute left-[60%] top-[40%] transform -translate-x-1/2 -translate-y-1/2">
        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
      </div>
      <div className="absolute left-[40%] top-[60%] transform -translate-x-1/2 -translate-y-1/2">
        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
      </div>
      <div className="absolute left-[75%] top-[25%] transform -translate-x-1/2 -translate-y-1/2">
        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
      </div>
      
      {/* Compass rose in the corner */}
      <div className="absolute right-1 sm:right-2 bottom-1 sm:bottom-2 h-6 w-6 sm:h-8 sm:w-8 border border-gray-400 dark:border-gray-500 sm:border-2 rounded-full flex items-center justify-center">
        <div className="text-[8px] sm:text-xs font-bold text-gray-600 dark:text-gray-300">N</div>
        <div className="absolute top-[1.35rem] sm:top-6 text-[8px] sm:text-xs font-bold text-gray-600 dark:text-gray-300">S</div>
        <div className="absolute left-[1.35rem] sm:left-6 text-[8px] sm:text-xs font-bold text-gray-600 dark:text-gray-300">W</div>
        <div className="absolute right-[1.35rem] sm:right-6 text-[8px] sm:text-xs font-bold text-gray-600 dark:text-gray-300">E</div>
      </div>
    </div>
  );
};

export default MapPreview;