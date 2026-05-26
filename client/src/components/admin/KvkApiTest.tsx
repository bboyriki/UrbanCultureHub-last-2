import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { CompanyCombobox } from "@/components/ui/combobox-company";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

// Interface for KVK API status
interface KvkApiStatus {
  isConfigured: boolean;
  lastChecked: Date;
  status: 'active' | 'inactive' | 'error';
  error?: string;
  responseTime?: number;
}

// Interface for KVK verification result
interface KvkVerificationResult {
  kvkNumber: string;
  businessName: string;
  isActive: boolean;
  isValid: boolean;
  vat?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  foundationDate?: string;
  legalForm?: string;
  errorMessage?: string;
}

// Interface for company search result
interface CompanySearchResult {
  kvkNumber: string;
  businessName: string;
  city?: string;
  isActive: boolean;
}

export function KvkApiTest() {
  const [apiStatus, setApiStatus] = useState<KvkApiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("status");
  
  // Verification state
  const [kvkNumber, setKvkNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [btwNumber, setBtwNumber] = useState("");
  const [verificationResult, setVerificationResult] = useState<KvkVerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  
  // Company search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  
  // Check KVK API status
  const checkApiStatus = async () => {
    setIsLoading(true);
    setTestResults(null);
    try {
      const response: any = await apiRequest('GET', '/api/kvk/status');
      if (response && typeof response === 'object') {
        setApiStatus(response);
      }
      setTestResults(JSON.stringify(response, null, 2));
    } catch (error: any) {
      setTestResults(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test KVK API connection
  const testApiConnection = async () => {
    setIsLoading(true);
    setTestResults(null);
    try {
      const response: any = await apiRequest('GET', '/api/kvk/test');
      setTestResults(JSON.stringify(response, null, 2));
    } catch (error: any) {
      setTestResults(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verify KVK number
  const verifyKvkNumber = async () => {
    setIsLoading(true);
    setVerificationResult(null);
    setVerificationError(null);
    
    try {
      const response: any = await apiRequest('POST', '/api/kvk/verify', {
        kvkNumber,
        companyName: companyName || undefined,
        btwNumber: btwNumber || undefined
      });
      
      if (response && typeof response === 'object') {
        setVerificationResult(response);
      }
    } catch (error: any) {
      setVerificationError(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Search companies by name
  const searchCompanies = async () => {
    if (!searchTerm || searchTerm.length < 3) {
      setVerificationError("Please enter at least 3 characters to search");
      return;
    }
    
    setIsLoading(true);
    setSearchResults([]);
    setVerificationError(null);
    
    try {
      // Using parameters according to KVK API documentation
      const response: any = await apiRequest('GET', 
        `/api/kvk/search?naam=${encodeURIComponent(searchTerm)}&pagina=1&resultatenPerPagina=10`
      );
      
      if (response && typeof response === 'object' && 'success' in response && 'results' in response) {
        if (response.success && Array.isArray(response.results)) {
          setSearchResults(response.results);
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error: any) {
      setVerificationError(`Error: ${error.message}`);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle company selection
  const handleCompanySelect = (company: CompanySearchResult | null) => {
    setSelectedCompany(company);
    
    if (company) {
      setKvkNumber(company.kvkNumber);
      setCompanyName(company.businessName);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>KVK API Test Tool</CardTitle>
        <CardDescription>
          Test the KVK API integration with various endpoints and operations
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="status" value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="verify">Verify KVK</TabsTrigger>
            <TabsTrigger value="search">Search Companies</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={checkApiStatus} 
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Check API Status
                </Button>
                
                <Button 
                  onClick={testApiConnection} 
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test API Connection
                </Button>
              </div>
              
              {apiStatus && (
                <Alert variant={apiStatus.status === 'active' ? 'default' : 'destructive'}>
                  <div className="flex items-center">
                    {apiStatus.status === 'active' ? (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mr-2" />
                    )}
                    <AlertTitle>
                      KVK API Status: {' '}
                      <Badge variant={apiStatus.status === 'active' ? 'default' : 'destructive'}>
                        {typeof apiStatus.status === 'string' ? apiStatus.status.toUpperCase() : String(apiStatus.status).toUpperCase()}
                      </Badge>
                    </AlertTitle>
                  </div>
                  <AlertDescription className="mt-2">
                    <div className="text-sm">
                      <p>Last checked: {new Date(apiStatus.lastChecked).toLocaleString()}</p>
                      {apiStatus.responseTime && (
                        <p>Response time: {apiStatus.responseTime}ms</p>
                      )}
                      {apiStatus.error && (
                        <p className="text-red-500">Error: {apiStatus.error}</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {testResults && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Test Results:</h3>
                  <Textarea 
                    value={testResults}
                    readOnly
                    className="h-60 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="verify" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">KVK Number</label>
                  <Input 
                    placeholder="Enter KVK Number" 
                    value={kvkNumber}
                    onChange={(e) => setKvkNumber(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Name (Optional)</label>
                  <Input 
                    placeholder="Enter Company Name" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">BTW Number (Optional)</label>
                <Input 
                  placeholder="Enter BTW/VAT Number" 
                  value={btwNumber}
                  onChange={(e) => setBtwNumber(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={verifyKvkNumber} 
                disabled={isLoading || !kvkNumber}
              >
                {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify KVK Number
              </Button>
              
              {verificationError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {verificationError}
                  </AlertDescription>
                </Alert>
              )}
              
              {verificationResult && (
                <div className="mt-4 p-4 border rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Verification Result</h3>
                    <Badge variant={verificationResult.isValid ? "default" : "destructive"}>
                      {verificationResult.isValid ? "VALID" : "INVALID"}
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-1">
                    <p className="flex justify-between">
                      <span className="text-sm font-medium">KVK Number:</span>
                      <span>{verificationResult.kvkNumber}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-sm font-medium">Business Name:</span>
                      <span>{verificationResult.businessName}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge variant={verificationResult.isActive ? "outline" : "secondary"}>
                        {verificationResult.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </p>
                    
                    {verificationResult.vat && (
                      <p className="flex justify-between">
                        <span className="text-sm font-medium">VAT Number:</span>
                        <span>{verificationResult.vat}</span>
                      </p>
                    )}
                    
                    {verificationResult.legalForm && (
                      <p className="flex justify-between">
                        <span className="text-sm font-medium">Legal Form:</span>
                        <span>{verificationResult.legalForm}</span>
                      </p>
                    )}
                    
                    {verificationResult.foundationDate && (
                      <p className="flex justify-between">
                        <span className="text-sm font-medium">Foundation Date:</span>
                        <span>{verificationResult.foundationDate}</span>
                      </p>
                    )}
                    
                    {verificationResult.address && (
                      <>
                        <Separator className="my-2" />
                        <h4 className="font-medium">Address:</h4>
                        <p className="text-sm">{verificationResult.address.street}</p>
                        <p className="text-sm">{verificationResult.address.postalCode} {verificationResult.address.city}</p>
                        <p className="text-sm">{verificationResult.address.country}</p>
                      </>
                    )}
                    
                    {verificationResult.errorMessage && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-red-500 text-sm">{verificationResult.errorMessage}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="search" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name Search</label>
                <div className="flex space-x-2">
                  <Input 
                    placeholder="Enter search term" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button 
                    onClick={searchCompanies} 
                    disabled={isLoading || searchTerm.length < 3}
                    variant="outline"
                  >
                    {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Search
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Enter at least 3 characters to search for companies
                </p>
              </div>
              
              {verificationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {verificationError}
                  </AlertDescription>
                </Alert>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Search Results:</h3>
                  <div className="border rounded-md divide-y">
                    {searchResults.map((company) => (
                      <div 
                        key={company.kvkNumber} 
                        className="p-3 hover:bg-muted cursor-pointer"
                        onClick={() => handleCompanySelect(company)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{company.businessName}</p>
                            <p className="text-xs text-muted-foreground">
                              KVK: {company.kvkNumber} | 
                              Location: {company.city || 'Unknown'}
                            </p>
                          </div>
                          <Badge variant={company.isActive ? "outline" : "secondary"}>
                            {company.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {searchResults.length === 0 && searchTerm.length >= 3 && !isLoading && !verificationError && (
                <Alert variant="default">
                  <AlertTitle>No Results</AlertTitle>
                  <AlertDescription>
                    No companies found matching your search criteria.
                  </AlertDescription>
                </Alert>
              )}
              
              {selectedCompany && (
                <div className="mt-4 p-4 border rounded-md">
                  <h3 className="font-semibold mb-2">Selected Company</h3>
                  <div className="space-y-1">
                    <p className="flex justify-between">
                      <span className="text-sm font-medium">KVK Number:</span>
                      <span>{selectedCompany.kvkNumber}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-sm font-medium">Business Name:</span>
                      <span>{selectedCompany.businessName}</span>
                    </p>
                    {selectedCompany.city && (
                      <p className="flex justify-between">
                        <span className="text-sm font-medium">City:</span>
                        <span>{selectedCompany.city}</span>
                      </p>
                    )}
                    <p className="flex justify-between">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge variant={selectedCompany.isActive ? "outline" : "secondary"}>
                        {selectedCompany.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        setSelectedTab("verify");
                        setKvkNumber(selectedCompany.kvkNumber);
                        setCompanyName(selectedCompany.businessName);
                      }}
                      variant="outline"
                    >
                      Use for Verification
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="pt-4">
                <h3 className="text-sm font-semibold mb-2">Company Autocomplete</h3>
                <CompanyCombobox
                  onSelect={(company) => {
                    if (company) {
                      handleCompanySelect({
                        kvkNumber: company.kvkNumber,
                        businessName: company.businessName,
                        city: company.city,
                        isActive: company.isActive
                      });
                    }
                  }}
                  placeholder="Search companies..."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          KVK API Test Tool - Urban Culture Platform
        </p>
      </CardFooter>
    </Card>
  );
}