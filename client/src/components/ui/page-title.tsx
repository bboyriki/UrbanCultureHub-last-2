import React from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
}

/**
 * A reusable page title component with optional subtitle
 */
const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle }) => {
  return (
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
      {subtitle && (
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageTitle;