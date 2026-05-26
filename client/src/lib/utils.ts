import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | string | null | undefined): string {
  // Handle invalid inputs
  if (price === null || price === undefined) {
    return '€0,00';
  }
  
  // Convert string to number if needed, and normalize to 2 decimal places to avoid floating point issues
  let numPrice: number;
  if (typeof price === 'string') {
    // Ensure we correctly handle string values by parsing first, then fixing to 2 decimal places
    numPrice = parseFloat(parseFloat(price).toFixed(2));
  } else {
    numPrice = parseFloat(price.toFixed(2));
  }
  
  // Check if it's a valid number
  if (isNaN(numPrice)) {
    return '€0,00';
  }
  
  console.log("Formatting price:", price, "to", numPrice);
  
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(numPrice);
}

export function formatDate(date: Date | string): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'PPP');
}
