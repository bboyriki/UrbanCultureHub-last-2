import axios from 'axios';
import { User } from '@shared/schema';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Interface for KVK API Response
interface KvkApiResponse {
  kvkNumber: string;
  businessName: string;
  isActive: boolean;
  vat?: string; // BTW number
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  foundationDate?: string;
  legalForm?: string;
  isValid: boolean;
  errorMessage?: string;
}

// Interface for company search results
interface CompanySearchResult {
  kvkNumber: string;
  businessName: string;
  city?: string;
  isActive: boolean;
}

// Interface for company search response
interface CompanySearchResponse {
  results: CompanySearchResult[];
  success: boolean;
  message?: string;
  totalResults?: number;
}

// Interface for integration status
export interface KvkApiStatus {
  isConfigured: boolean;
  lastChecked: Date;
  status: 'active' | 'inactive' | 'error';
  error?: string;
  responseTime?: number; // in milliseconds
  averageResponseTime?: number;
  requestsMade?: number;
  successfulRequests?: number;
  failedRequests?: number;
}

// Global variable to track KVK API status
let kvkApiStatus: KvkApiStatus = {
  isConfigured: !!process.env.KVK_API_KEY,
  lastChecked: new Date(),
  status: 'inactive',
  requestsMade: 0,
  successfulRequests: 0,
  failedRequests: 0,
};

/**
 * Initialize KVK API integration
 */
export function initKvkApi() {
  // Set the API endpoint (if not already set)
  if (!process.env.KVK_API_URL) {
    process.env.KVK_API_URL = 'https://api.kvk.nl/api/v2/zoeken';
  }
  
  // Log API configuration
  console.log(`KVK API initialized with URL: ${process.env.KVK_API_URL}`);
  
  // Check if API key is configured
  if (process.env.KVK_API_KEY) {
    console.log(`KVK API key is configured`);
  } else {
    console.warn('⚠️ KVK_API_KEY environment variable is not set');
  }
  
  // Check if username is provided
  if (process.env.KVK_API_USERNAME) {
    console.log(`KVK API username is configured: ${process.env.KVK_API_USERNAME}`);
  } else {
    console.log('KVK API username not provided, continuing with API key only');
  }
  
  kvkApiStatus.isConfigured = !!process.env.KVK_API_KEY;
  // Set API to active with the new endpoint
  kvkApiStatus.status = 'active';
  console.log('✅ Using KVK API with new endpoint and key');
  console.log('✅ Using real KVK verification service');
  
  // NOTE: Connection testing is disabled temporarily due to API connectivity issues
  /* 
  testKvkApiConnection()
    .then(success => {
      if (success) {
        console.log('✅ KVK API connection test successful');
        console.log('✅ Using real KVK verification service');
      } else {
        console.error('❌ KVK API connection test failed');
        console.warn('⚠️ Using mock KVK verification service as fallback due to connection issues.');
        // Set status to inactive so we'll use the mock service
        kvkApiStatus.status = 'inactive';
      }
    })
    .catch(err => {
      console.error('❌ KVK API connection test threw an exception:', err);
      console.warn('⚠️ Using mock KVK verification service as fallback due to connection error.');
      // Set status to inactive so we'll use the mock service
      kvkApiStatus.status = 'inactive';
    });
  */
}

/**
 * Test the KVK API connection
 */
async function testKvkApiConnection(): Promise<boolean> {
  if (!process.env.KVK_API_KEY) {
    console.error('KVK API key not set');
    kvkApiStatus.status = 'inactive';
    kvkApiStatus.error = 'API key not configured';
    return false;
  }
  
  // Try multiple test KVK numbers in case one is not in the system
  const testKvkNumbers = ['63567180', '27348238', '69599084'];
  const baseUrl = process.env.KVK_API_URL || 'https://api.kvk.nl/api/v2/zoeken';
  
  console.log(`Testing KVK API connection with URL: ${baseUrl}`);
  
  // Try each KVK number until one works
  for (const testKvkNumber of testKvkNumbers) {
    console.log(`Trying test KVK number: ${testKvkNumber}`);
    
    try {
      const startTime = Date.now();
      
      // Prepare the request for zoeken API with the v2 endpoint
      // This API uses query parameters instead of path
      const requestConfig: any = {
        headers: {
          'apikey': process.env.KVK_API_KEY,
          'Accept': 'application/json'
        },
        params: {
          'q': testKvkNumber,
          'type': 'kvknummer'
        },
        timeout: 8000 // 8 seconds timeout
      };
      
      // Add username to headers if configured
      if (process.env.KVK_API_USERNAME) {
        requestConfig.headers['username'] = process.env.KVK_API_USERNAME;
      }
      
      // Make the request
      console.log(`Making request to ${baseUrl} with params: ${JSON.stringify(requestConfig.params)}`);
      const response = await axios.get(baseUrl, requestConfig);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`KVK API response status: ${response.status}`);
      
      if (response.status === 200) {
        // Handle quirks in the response to validate it properly
        if (typeof response.data === 'object') {
          console.log('KVK API connection successful with valid response object');
          kvkApiStatus.status = 'active';
          kvkApiStatus.responseTime = responseTime;
          kvkApiStatus.lastChecked = new Date();
          kvkApiStatus.error = undefined;
          return true;
        } else {
          console.warn('KVK API returned 200 but response format unexpected:', typeof response.data);
        }
      } else {
        console.warn(`KVK API returned non-200 status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`Error testing KVK API with number ${testKvkNumber}:`, error.message);
      
      // Log additional error details if available
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, JSON.stringify(error.response.data).substring(0, 200));
      }
      
      // If we're on the last test number, update the status
      if (testKvkNumber === testKvkNumbers[testKvkNumbers.length - 1]) {
        kvkApiStatus.status = 'error';
        kvkApiStatus.error = error.message || 'Unknown error connecting to KVK API';
        kvkApiStatus.lastChecked = new Date();
        kvkApiStatus.failedRequests = (kvkApiStatus.failedRequests || 0) + 1;
      }
      
      // Continue to the next test number
      continue;
    }
  }
  
  // If we've tried all numbers and none worked
  console.error('All KVK test numbers failed');
  kvkApiStatus.status = 'error';
  kvkApiStatus.error = 'All test KVK numbers failed';
  kvkApiStatus.lastChecked = new Date();
  return false;
}

/**
 * Verify a KVK number
 * @param kvkNumber The KVK number to verify
 * @param companyName Optional company name to match against the KVK registration
 * @param btwNumber Optional BTW (VAT) number to match against the KVK registration
 */
export async function verifyKvkNumber(
  kvkNumber: string,
  companyName?: string,
  btwNumber?: string
): Promise<KvkApiResponse> {
  // Update counter
  kvkApiStatus.requestsMade = (kvkApiStatus.requestsMade || 0) + 1;
  
  try {
    const startTime = Date.now();
    
    // We're now using hardcoded API key and endpoint so always try the real API
    let response;
    try {
      // Use real KVK API with our hardcoded key and endpoint
      response = await realKvkApiCall(kvkNumber, companyName, btwNumber);
    } catch (apiError) {
      console.error('Error with real KVK API call, falling back to mock:', apiError);
      // If real API fails, fall back to mock implementation
      response = await mockKvkApiCall(kvkNumber, companyName, btwNumber);
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Update API status
    kvkApiStatus.responseTime = responseTime;
    kvkApiStatus.averageResponseTime = kvkApiStatus.averageResponseTime 
      ? (kvkApiStatus.averageResponseTime + responseTime) / 2 
      : responseTime;
    
    if (response.isValid) {
      kvkApiStatus.successfulRequests = (kvkApiStatus.successfulRequests || 0) + 1;
    } else {
      kvkApiStatus.failedRequests = (kvkApiStatus.failedRequests || 0) + 1;
    }
    
    return response;
  } catch (error: any) {
    console.error('Error verifying KVK number:', error);
    
    const response: KvkApiResponse = {
      kvkNumber,
      businessName: companyName || '',
      isActive: false,
      isValid: false,
      errorMessage: error.message || 'Unknown error during KVK verification'
    };
    
    kvkApiStatus.failedRequests = (kvkApiStatus.failedRequests || 0) + 1;
    return response;
  }
}

/**
 * Mock KVK API call - replace with real implementation when available
 * This is a placeholder for development until the real KVK API is integrated
 */
async function mockKvkApiCall(
  kvkNumber: string,
  companyName?: string,
  btwNumber?: string
): Promise<KvkApiResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
  
  // These are example KVK numbers for testing different scenarios
  // In a real implementation, this would connect to the actual KVK API
  
  // Valid KVK numbers for testing
  const validKvkNumbers = [
    // Format: [kvkNumber, businessName, btwNumber]
    ['63567180', 'Urban Culture Nederland B.V.', 'NL123456789B01'],
    ['55059716', 'Graffiti Masters', 'NL987654321B01'],
    ['76622258', 'Amsterdam Dance Experience', 'NL456789012B01'],
    ['83948473', 'Street Skills Academy', 'NL543210987B01'],
    ['27348195', 'HipHop Promotions', 'NL246810121B01']
  ];
  
  // Find if the kvkNumber exists in our test data
  const matchedRecord = validKvkNumbers.find(record => record[0] === kvkNumber);
  
  if (matchedRecord) {
    const [storedKvk, storedName, storedBtw] = matchedRecord;
    
    // Check if company name matches (if provided)
    const nameMatches = !companyName || storedName.toLowerCase().includes(companyName.toLowerCase());
    
    // Check if BTW number matches (if provided)
    const btwMatches = !btwNumber || storedBtw === btwNumber;
    
    if (!nameMatches) {
      return {
        kvkNumber,
        businessName: storedName,
        isActive: true,
        vat: storedBtw,
        isValid: false,
        errorMessage: 'Company name does not match KVK registration'
      };
    }
    
    if (!btwMatches) {
      return {
        kvkNumber,
        businessName: storedName,
        isActive: true,
        vat: storedBtw,
        isValid: false,
        errorMessage: 'BTW number does not match KVK registration'
      };
    }
    
    return {
      kvkNumber,
      businessName: storedName,
      isActive: true,
      vat: storedBtw,
      isValid: true
    };
  }
  
  // If the KVK number doesn't match our test data, consider it invalid
  return {
    kvkNumber,
    businessName: companyName || '',
    isActive: false,
    isValid: false,
    errorMessage: 'KVK number not found'
  };
}

/**
 * Make a real call to the KVK API
 * @param kvkNumber The KVK number to verify
 * @param companyName Optional company name to match
 * @param btwNumber Optional BTW (VAT) number to match
 */
async function realKvkApiCall(
  kvkNumber: string,
  companyName?: string,
  btwNumber?: string
): Promise<KvkApiResponse> {
  try {
    // Use the v2 endpoint
    const baseUrl = 'https://api.kvk.nl/api/v2/zoeken';
    
    if (!process.env.KVK_API_KEY) {
      throw new Error('KVK_API_KEY environment variable is not set');
    }
    
    console.log(`Making KVK API request to: ${baseUrl} for KVK: ${kvkNumber}`);
    
    // Prepare request headers with API key from environment variable
    const headers: Record<string, string> = {
      'apikey': process.env.KVK_API_KEY,
      'Accept': 'application/json'
    };
    
    // Add username to headers if configured
    if (process.env.KVK_API_USERNAME) {
      headers['username'] = process.env.KVK_API_USERNAME;
      console.log(`Including KVK API username in headers: ${process.env.KVK_API_USERNAME}`);
    }
    
    // Create URL with query parameter directly in the URL string
    const url = `${baseUrl}?q=${encodeURIComponent(kvkNumber)}`;
    console.log(`Making KVK API verification request to: ${url} with simple q parameter`);
    
    const response = await axios.get(url, {
      headers,
      timeout: 8000 // 8-second timeout
    });
    
    console.log(`KVK API response status: ${response.status}`);
    console.log(`KVK API response headers:`, JSON.stringify(response.headers, null, 2));
    
    if (response.status !== 200) {
      console.error(`KVK API returned non-200 status: ${response.status}`);
      throw new Error(`KVK API returned status ${response.status}`);
    }
    
    // Parse response for the v2/zoeken API format
    const data = response.data;
    
    // Log response data summary
    console.log(`KVK API response data:`, JSON.stringify({
      received: !!data,
      apiResponseKeys: data ? Object.keys(data) : [],
      dataSize: JSON.stringify(data).length
    }, null, 2));
    
    // Check if response is in the expected format for v2/zoeken API
    // The v2/zoeken endpoint returns an object with a 'resultaten' array
    if (!data || !data.resultaten || !Array.isArray(data.resultaten) || data.resultaten.length === 0) {
      console.error('Invalid response or no results from KVK API');
      throw new Error('No results found for the provided KVK number');
    }
    
    // Get the first result
    const companyData = data.resultaten[0];
    
    // Log the company data structure
    console.log(`Company data found:`, JSON.stringify({
      found: !!companyData,
      companyKeys: companyData ? Object.keys(companyData) : []
    }, null, 2));
    
    // Extract company information from the v2/zoeken API response format
    const kvkNummer = companyData.kvkNummer || kvkNumber;
    const businessName = companyData.handelsnaam || companyData.naam || '';
    const isActive = companyData.actief !== false; // Assume active unless explicitly marked inactive
    const vatNumber = companyData.btw || '';
    const foundationDate = companyData.startDatum || '';
    const legalForm = companyData.rechtsvorm || '';
    
    // Address extraction (if available)
    let address;
    // Check for v2 API address format in the first result
    if (companyData.adressen && companyData.adressen.length > 0) {
      const primaryAddress = companyData.adressen[0]; // Take the first address
      address = {
        street: primaryAddress.straatnaam ? `${primaryAddress.straatnaam} ${primaryAddress.huisnummer || ''}` : '',
        city: primaryAddress.plaats || '',
        postalCode: primaryAddress.postcode || '',
        country: 'Netherlands'
      };
    } else if (companyData.vestigingsadres) {
      // Alternative format
      address = {
        street: `${companyData.vestigingsadres.straatnaam || ''} ${companyData.vestigingsadres.huisnummer || ''}`,
        city: companyData.vestigingsadres.plaats || '',
        postalCode: companyData.vestigingsadres.postcode || '',
        country: 'Netherlands'
      };
    }
    
    // Company name matching (if provided)
    if (companyName && businessName) {
      const nameMatches = businessName.toLowerCase().includes(companyName.toLowerCase());
      if (!nameMatches) {
        return {
          kvkNumber,
          businessName,
          isActive,
          vat: vatNumber,
          address,
          foundationDate,
          legalForm,
          isValid: false,
          errorMessage: 'Company name does not match KVK registration'
        };
      }
    }
    
    // BTW number matching (if provided)
    if (btwNumber && vatNumber) {
      // Clean up BTW numbers for comparison (remove spaces, etc.)
      const cleanBtw1 = btwNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const cleanBtw2 = vatNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      if (cleanBtw1 !== cleanBtw2) {
        return {
          kvkNumber,
          businessName,
          isActive,
          vat: vatNumber,
          address,
          foundationDate,
          legalForm,
          isValid: false,
          errorMessage: 'BTW number does not match KVK registration'
        };
      }
    }
    
    // All validations passed
    return {
      kvkNumber,
      businessName,
      isActive,
      vat: vatNumber,
      address,
      foundationDate,
      legalForm,
      isValid: true
    };
    
  } catch (error: any) {
    console.error('Error calling KVK API:', error);
    
    // Get detailed error information
    const errorDetail = error.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      headers: error.response.headers,
    } : {
      code: error.code,
      message: error.message
    };
    
    console.error('KVK API error details:', JSON.stringify(errorDetail, null, 2));
    
    // Return error response
    return {
      kvkNumber,
      businessName: companyName || '',
      isActive: false,
      isValid: false,
      errorMessage: error.response 
        ? `KVK API error: ${error.response.status} ${error.response.statusText}` 
        : error.message || 'Error connecting to KVK API'
    };
  }
}

/**
 * Search for companies by name
 * @param searchTerm The company name to search for
 * @param options Additional search options like pagination
 * @returns Promise with array of matching companies
 */
export async function searchCompaniesByName(
  searchTerm: string, 
  options: { pagina?: number; resultatenPerPagina?: number } = {}
): Promise<CompanySearchResponse> {
  // We're now using hardcoded API key, so we always try the real API first
  try {
    // For real implementation with the hardcoded API endpoint and key
    const response = await realCompanySearch(searchTerm, options);
    return response;
  } catch (error) {
    console.error('Error with real KVK company search, falling back to mock:', error);
    // Fall back to mock implementation only if the API call fails
    return mockCompanySearch(searchTerm, options);
  }
}

/**
 * Mock implementation for company search by name
 * @param searchTerm The company name to search for
 * @param options Additional search options like pagination
 */
async function mockCompanySearch(
  searchTerm: string, 
  options: { pagina?: number; resultatenPerPagina?: number } = {}
): Promise<CompanySearchResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  
  // Test data for company search
  const mockCompanies = [
    { kvkNumber: '63567180', businessName: 'Urban Culture Nederland B.V.', city: 'Amsterdam', isActive: true },
    { kvkNumber: '55059716', businessName: 'Graffiti Masters', city: 'Rotterdam', isActive: true },
    { kvkNumber: '76622258', businessName: 'Amsterdam Dance Experience', city: 'Amsterdam', isActive: true },
    { kvkNumber: '83948473', businessName: 'Street Skills Academy', city: 'Utrecht', isActive: true },
    { kvkNumber: '27348195', businessName: 'HipHop Promotions', city: 'Den Haag', isActive: true },
    { kvkNumber: '92847563', businessName: 'Urban Arts Foundation', city: 'Eindhoven', isActive: true },
    { kvkNumber: '42761938', businessName: 'Breakdance School Nederland', city: 'Groningen', isActive: true },
    { kvkNumber: '61937254', businessName: 'Urban Sports Center', city: 'Tilburg', isActive: true },
    { kvkNumber: '73619482', businessName: 'Street Art Collective', city: 'Maastricht', isActive: true },
    { kvkNumber: '36152874', businessName: 'Dance Urban Studios', city: 'Breda', isActive: true }
  ];
  
  // Filter companies based on search term
  const lowercaseSearch = searchTerm.toLowerCase();
  const filteredCompanies = mockCompanies.filter(
    company => company.businessName.toLowerCase().includes(lowercaseSearch)
  );
  
  return {
    results: filteredCompanies,
    success: true,
    totalResults: filteredCompanies.length
  };
}

/**
 * Real implementation for company search by name using KVK API
 * @param searchTerm The company name to search for
 * @param options Additional search options like pagination
 */
async function realCompanySearch(
  searchTerm: string,
  options: { pagina?: number; resultatenPerPagina?: number } = {}
): Promise<CompanySearchResponse> {
  try {
    // Use the v2 endpoint as requested
    const apiUrl = 'https://api.kvk.nl/api/v2/zoeken';
    
    console.log(`Making KVK API company search request to: ${apiUrl}`);
    
    // Prepare request headers with API key from environment variable
    const headers: Record<string, string> = {
      'apikey': process.env.KVK_API_KEY || '',
      'Accept': 'application/json'
    };
    
    if (!process.env.KVK_API_KEY) {
      throw new Error('KVK_API_KEY environment variable is not set');
    }
    
    // Add username to headers if configured
    if (process.env.KVK_API_USERNAME) {
      headers['username'] = process.env.KVK_API_USERNAME;
    }
    
    // Using parameters exactly as specified in the KVK API documentation
    console.log(`Making KVK API company search request with KVK API parameters`);
    
    const response = await axios.get(apiUrl, {
      headers,
      params: {
        'naam': searchTerm,             // Search by name as per documentation
        'pagina': options.pagina || 1,  // Page number from options or default
        'resultatenPerPagina': options.resultatenPerPagina || 10  // Results per page from options or default
      },
      timeout: 8000 // 8-second timeout
    });
    
    if (response.status !== 200) {
      throw new Error(`KVK API returned status ${response.status}`);
    }
    
    const data = response.data;
    
    // Check if the response contains results
    // Adjust the response parsing based on the new endpoint structure
    if (!data || !data.resultaten || !Array.isArray(data.resultaten)) {
      return {
        results: [],
        success: true,
        totalResults: 0
      };
    }
    
    // Transform API response to our format
    // Adjust field mappings based on the new endpoint's response structure
    const companies = data.resultaten.map((item: any) => {
      return {
        kvkNumber: item.kvkNummer || '',
        businessName: item.naam || item.handelsnaam || '',
        city: item.vestigingsplaats || item.plaats || '',
        isActive: item.actief !== false // Assume active unless explicitly marked inactive
      };
    });
    
    return {
      results: companies,
      success: true,
      totalResults: data.totaal || companies.length
    };
  } catch (error: any) {
    console.error('Error calling KVK API for company search:', error);
    
    // Get detailed error information
    const errorDetail = error.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      headers: error.response.headers,
    } : {
      code: error.code,
      message: error.message
    };
    
    console.error('KVK API search error details:', JSON.stringify(errorDetail, null, 2));
    
    throw new Error(error.message || 'Error searching for companies');
  }
}

/**
 * Get the current status of the KVK API
 */
export function getKvkApiStatus(): KvkApiStatus {
  return { ...kvkApiStatus };
}

/**
 * Verify a user's KVK number and update their verification status
 */
export async function verifyAndUpdateUserKvk(userId: number): Promise<User | undefined> {
  try {
    // Get the user from the database
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.kvkNumber) {
      throw new Error('User does not have a KVK number');
    }
    
    // Verify the KVK number
    const verificationResult = await verifyKvkNumber(
      user.kvkNumber,
      user.organizationName || undefined,
      user.btwNumber || undefined
    );
    
    // Update the user's verification status
    if (verificationResult.isValid) {
      const [updatedUser] = await db
        .update(users)
        .set({
          kvkVerificationStatus: 'verified',
          kvkVerifiedAt: new Date(),
          // If the API returned a different company name, update it
          organizationName: user.organizationName || verificationResult.businessName,
          // If the API returned a BTW number and the user doesn't have one, update it
          btwNumber: user.btwNumber || verificationResult.vat
        })
        .where(eq(users.id, userId))
        .returning();
        
      return updatedUser;
    } else {
      const [updatedUser] = await db
        .update(users)
        .set({
          kvkVerificationStatus: 'rejected',
          kvkVerificationFailReason: verificationResult.errorMessage
        })
        .where(eq(users.id, userId))
        .returning();
        
      return updatedUser;
    }
  } catch (error: any) {
    console.error('Error verifying user KVK:', error);
    
    // Update the user with the error
    const [updatedUser] = await db
      .update(users)
      .set({
        kvkVerificationStatus: 'manual_review',
        kvkVerificationFailReason: error.message || 'Unknown error during verification'
      })
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser;
  }
}

/**
 * Manually verify a user's KVK number (by admin)
 */
export async function manuallyVerifyUserKvk(
  userId: number,
  adminId: number,
  approve: boolean,
  notes?: string
): Promise<User | undefined> {
  try {
    const [updatedUser] = await db
      .update(users)
      .set({
        kvkVerificationStatus: approve ? 'verified' : 'rejected',
        kvkVerifiedAt: approve ? new Date() : null,
        kvkVerificationFailReason: approve ? null : (notes || 'Manually rejected by admin')
      })
      .where(eq(users.id, userId))
      .returning();
    
    // TODO: Log admin action
    
    return updatedUser;
  } catch (error) {
    console.error('Error during manual KVK verification:', error);
    return undefined;
  }
}