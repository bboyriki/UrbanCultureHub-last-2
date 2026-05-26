import React, { forwardRef, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Search, Loader2, MapPin } from "lucide-react";

export interface ComboboxPopoverProps {
  suggestions: string[];
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (value: string) => void;
}

export const ComboboxPopover = forwardRef<HTMLInputElement, ComboboxPopoverProps>(({
  suggestions,
  value = "",
  onSelect,
  onChange,
  placeholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
  loading = false
}, ref) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Store the forwarded ref
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else {
        ref.current = inputRef.current;
      }
    }
  }, [ref]);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle input change with parent callback
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
    if (newValue) {
      setOpen(true);
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (listRef.current && !listRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-8 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onFocus={() => setOpen(true)}
        />
        {(disabled || loading) && (
          <Loader2 className="absolute right-3 h-4 w-4 animate-spin opacity-70" />
        )}
        {!disabled && !loading && inputValue && (
          <button
            type="button"
            className="absolute right-3 h-4 w-4 opacity-70"
            onClick={() => {
              setInputValue("");
              setOpen(false);
              onChange?.("");
            }}
          >
            &times;
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div 
          ref={listRef}
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-input bg-background shadow-md"
        >
          <div className="max-h-[200px] overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onSelect(suggestion);
                  setInputValue(suggestion);
                  setOpen(false);
                }}
              >
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {open && inputValue && suggestions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-input bg-background shadow-md p-2 text-sm text-muted-foreground">
          {loading ? (
            <div className="flex items-center justify-center py-1">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            emptyMessage
          )}
        </div>
      )}
    </div>
  );
});

ComboboxPopover.displayName = "ComboboxPopover";

export default ComboboxPopover;