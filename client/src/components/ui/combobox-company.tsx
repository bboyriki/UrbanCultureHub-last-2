import React, { useState, useEffect, useRef, forwardRef } from "react";
import { Check, ChevronsUpDown, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

export interface CompanyData {
  kvkNumber: string;
  businessName: string;
  city?: string;
  isActive: boolean;
}

export interface CompanyComboboxProps {
  onSelect: (company: CompanyData | null) => void;
  value?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CompanyCombobox = forwardRef<HTMLInputElement, CompanyComboboxProps>((props, ref) => {
  const {
    onSelect,
    value = "",
    placeholder = "Search for your company...",
    className,
    disabled = false
  } = props;
  
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState(value || "");
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const searchCompanies = async (query: string) => {
    if (!query || query.length < 2) {
      setCompanies([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest(`/api/kvk/search?query=${encodeURIComponent(query)}`, "GET");
      
      if (response && typeof response === 'object' && 'success' in response && 'results' in response) {
        const typedResponse = response as { success: boolean, results: CompanyData[], message?: string };
        if (typedResponse.success && typedResponse.results) {
          setCompanies(typedResponse.results);
        } else {
          setError(typedResponse.message || "Failed to fetch company data");
          setCompanies([]);
        }
      } else {
        setError("Invalid response format from API");
        setCompanies([]);
      }
    } catch (err) {
      console.error("Error searching companies:", err);
      setError("Failed to connect to KVK API");
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.length >= 2) {
      searchTimeoutRef.current = window.setTimeout(() => {
        searchCompanies(searchTerm);
      }, 500);
    } else {
      setCompanies([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSearchTerm(newValue);
    // If input is cleared, also clear the selection
    if (!newValue) {
      onSelect(null);
    }
  };

  const handleSelectCompany = (company: CompanyData) => {
    setInputValue(company.businessName);
    onSelect(company);
    setOpen(false);
  };

  const handleClear = () => {
    setInputValue("");
    setSearchTerm("");
    onSelect(null);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="pr-10"
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
        />
        
        {inputValue && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={handleClear}
            type="button"
          >
            <X className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Clear</span>
          </Button>
        )}
      </div>
      
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="hidden"
            aria-expanded={open}
          >
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[320px]" align="start">
          <Command>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <CommandInput 
                placeholder="Search for a company..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="h-9 pl-8"
              />
            </div>
            
            <CommandList>
              {isLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                  <span className="ml-2 text-sm text-muted-foreground">Searching companies...</span>
                </div>
              )}
              
              {error && !isLoading && (
                <div className="flex flex-col items-center justify-center py-6 px-4">
                  <div className="text-destructive mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <p className="text-sm text-center text-muted-foreground">{error}</p>
                  <p className="text-xs text-center text-muted-foreground mt-1">Try again or enter your KVK number manually</p>
                </div>
              )}

              {!isLoading && !error && searchTerm.length < 2 && (
                <CommandEmpty className="py-6 text-center text-sm">
                  Start typing to search for companies
                </CommandEmpty>
              )}
              
              {!isLoading && !error && searchTerm.length >= 2 && companies.length === 0 && (
                <CommandEmpty className="py-6 text-center">
                  No companies found
                </CommandEmpty>
              )}
              
              {companies.length > 0 && (
                <CommandGroup heading="Matching companies">
                  {companies.map((company) => (
                    <CommandItem
                      key={company.kvkNumber}
                      value={company.businessName}
                      onSelect={() => handleSelectCompany(company)}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span className="mr-2">{company.businessName}</span>
                          {company.isActive ? 
                            <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge> : 
                            <Badge variant="outline" className="ml-auto text-xs bg-red-50 text-red-700 border-red-200">
                              Inactive
                            </Badge>
                          }
                        </div>
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-muted-foreground">KVK: {company.kvkNumber}</span>
                          {company.city && (
                            <span className="text-xs text-muted-foreground ml-2">
                              • {company.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
});

CompanyCombobox.displayName = "CompanyCombobox";