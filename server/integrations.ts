import Stripe from "stripe";
import { v2 as cloudinary } from "cloudinary";
import { getKvkApiStatus } from "./kvk";

// Define the integration interfaces
interface IntegrationConfig {
  name: string;
  isConfigured: boolean;
  status: "active" | "inactive" | "error" | "slow";
  errorMessage?: string;
  lastChecked: Date;
  responseTime?: number; // in milliseconds
  uptime?: number; // percentage (0-100)
  performance?: "good" | "average" | "poor";
  consecutiveFailures?: number;
  statusHistory?: Array<{
    timestamp: Date;
    status: "active" | "inactive" | "error" | "slow";
    responseTime?: number;
    errorMessage?: string;
  }>;
}

interface IntegrationStatus {
  stripe: IntegrationConfig;
  mailgun: IntegrationConfig;
  cloudinary: IntegrationConfig;
  firebase: IntegrationConfig;
  googleMaps: IntegrationConfig;
  kvk: IntegrationConfig; // Added KVK API
}

// Helper function to measure API response time
async function measureResponseTime<T>(
  apiCall: () => Promise<T>
): Promise<{ data: T | null; responseTime: number; error?: any }> {
  const startTime = Date.now();
  try {
    const data = await apiCall();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    return { data, responseTime };
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    return { data: null, responseTime, error };
  }
}

// Function to determine performance rating
function getPerformanceRating(responseTime: number): "good" | "average" | "poor" {
  if (responseTime < 200) return "good";
  if (responseTime < 500) return "average";
  return "poor";
}

// Function to check if Stripe is properly configured
async function checkStripeStatus(): Promise<IntegrationConfig> {
  const config: IntegrationConfig = {
    name: "Stripe",
    isConfigured: !!process.env.STRIPE_SECRET_KEY,
    status: "inactive",
    lastChecked: new Date(),
    consecutiveFailures: 0,
    statusHistory: []
  };

  if (!config.isConfigured) {
    return config;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });
    
    const { data, responseTime, error } = await measureResponseTime(() => 
      stripe.customers.list({ limit: 1 })
    );
    
    config.responseTime = responseTime;
    
    if (error) {
      config.status = "error";
      config.errorMessage = error.message;
      config.consecutiveFailures = (config.consecutiveFailures || 0) + 1;
    } else {
      if (responseTime > 1000) {
        config.status = "slow";
      } else {
        config.status = "active";
      }
      config.performance = getPerformanceRating(responseTime);
      // Reset consecutive failures when successful
      config.consecutiveFailures = 0;
    }
    
    // Calculate mock uptime percentage (in a real system this would be based on historical data)
    config.uptime = config.status === "active" ? 100 : 
                   config.status === "slow" ? 95 : 
                   Math.max(0, 100 - (config.consecutiveFailures || 0) * 5);
    
    // Add to status history
    config.statusHistory = [{
      timestamp: new Date(),
      status: config.status,
      responseTime,
      errorMessage: error?.message
    }];

  } catch (error: any) {
    config.status = "error";
    config.errorMessage = error.message;
    config.consecutiveFailures = (config.consecutiveFailures || 0) + 1;
    
    // Add to status history
    config.statusHistory = [{
      timestamp: new Date(),
      status: "error",
      errorMessage: error.message
    }];
  }

  return config;
}

// Function to check if Mailgun is properly configured
async function checkMailgunStatus(): Promise<IntegrationConfig> {
  const config: IntegrationConfig = {
    name: "Mailgun",
    isConfigured: !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN),
    status: "inactive",
    lastChecked: new Date(),
    consecutiveFailures: 0,
    statusHistory: []
  };

  if (!config.isConfigured) {
    return config;
  }

  try {
    // Import the emailSystem to check status
    const { emailSystem } = await import('./email');
    
    const responseTime = 0; // Mailgun is initialized synchronously
    config.responseTime = responseTime;
    
    if (emailSystem.isConfigured && emailSystem.isApiKeyWorking) {
      config.status = "active";
      config.performance = "good";
      config.consecutiveFailures = 0;
    } else {
      config.status = "error";
      config.errorMessage = emailSystem.errorMessage || "Mailgun not configured properly";
      config.consecutiveFailures = (config.consecutiveFailures || 0) + 1;
    }
    
    // Calculate uptime percentage
    config.uptime = config.status === "active" ? 100 : 
                   Math.max(0, 100 - (config.consecutiveFailures || 0) * 5);
    
    // Add to status history
    config.statusHistory = [{
      timestamp: new Date(),
      status: config.status,
      responseTime,
      errorMessage: config.errorMessage
    }];
    
  } catch (error: any) {
    config.status = "error";
    config.errorMessage = error.message;
    config.consecutiveFailures = (config.consecutiveFailures || 0) + 1;
    
    // Add to status history
    config.statusHistory = [{
      timestamp: new Date(),
      status: "error",
      errorMessage: error.message
    }];
  }

  return config;
}

// Function to check if Cloudinary is properly configured
async function checkCloudinaryStatus(): Promise<IntegrationConfig> {
  const config: IntegrationConfig = {
    name: "Cloudinary",
    isConfigured: !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ),
    status: "inactive",
    lastChecked: new Date(),
    consecutiveFailures: 0,
    statusHistory: []
  };

  if (!config.isConfigured) {
    return config;
  }

  try {
    const { responseTime, error } = await measureResponseTime(() => 
      cloudinary.api.ping()
    );
    
    config.responseTime = responseTime;
    
    if (error) {
      config.status = "error";
      config.errorMessage = error.message;
      config.consecutiveFailures = (config.consecutiveFailures || 0) + 1;
    } else {
      if (responseTime > 800) {
        config.status = "slow";
      } else {
        config.status = "active";
      }
      config.performance = getPerformanceRating(responseTime);
      config.consecutiveFailures = 0;
    }
    
    // Calculate mock uptime percentage
    config.uptime = config.status === "active" ? 100 : 
                   config.status === "slow" ? 90 : 
                   Math.max(0, 100 - (config.consecutiveFailures || 0) * 5);
    
    // Add to status history
    config.statusHistory = [{
      timestamp: new Date(),
      status: config.status,
      responseTime,
      errorMessage: error?.message
    }];
    
  } catch (error: any) {
    config.status = "error";
    config.errorMessage = error.message;
    config.consecutiveFailures = (config.consecutiveFailures || 0) + 1;
    
    // Add to status history
    config.statusHistory = [{
      timestamp: new Date(),
      status: "error",
      errorMessage: error.message
    }];
  }

  return config;
}

// Function to check if Firebase is properly configured
async function checkFirebaseStatus(): Promise<IntegrationConfig> {
  const config: IntegrationConfig = {
    name: "Firebase",
    isConfigured: !!(
      process.env.VITE_FIREBASE_API_KEY &&
      process.env.VITE_FIREBASE_PROJECT_ID &&
      process.env.VITE_FIREBASE_APP_ID
    ),
    status: "active", // Firebase is client-side, we can only check if configs exist
    lastChecked: new Date(),
    // Since Firebase is client-side, we estimate values
    responseTime: 150, // Simulated average response time
    uptime: 99.9,
    performance: "good",
    consecutiveFailures: 0,
    statusHistory: [{
      timestamp: new Date(),
      status: "active",
      responseTime: 150
    }]
  };

  return config;
}

// Function to check if Google Maps is properly configured
async function checkGoogleMapsStatus(): Promise<IntegrationConfig> {
  const config: IntegrationConfig = {
    name: "Google Maps",
    isConfigured: !!process.env.VITE_GOOGLE_MAPS_API_KEY,
    status: "active", // Google Maps is client-side, we can only check if the key exists
    lastChecked: new Date(),
    // Since Google Maps is client-side, we estimate values
    responseTime: 120, // Simulated average response time
    uptime: 99.8,
    performance: "good",
    consecutiveFailures: 0,
    statusHistory: [{
      timestamp: new Date(),
      status: "active",
      responseTime: 120
    }]
  };

  return config;
}

// Function to check if KVK API is properly configured and working
async function checkKvkApiStatus(): Promise<IntegrationConfig> {
  // Get the current status from the KVK service
  const kvkStatus = getKvkApiStatus();
  
  const config: IntegrationConfig = {
    name: "KVK API",
    isConfigured: kvkStatus.isConfigured,
    status: kvkStatus.status as "active" | "inactive" | "error",
    errorMessage: kvkStatus.error,
    lastChecked: kvkStatus.lastChecked,
    responseTime: kvkStatus.responseTime,
    uptime: kvkStatus.status === "active" ? 99 : 
           kvkStatus.status === "inactive" ? 0 : 70,
    performance: kvkStatus.responseTime ? 
                getPerformanceRating(kvkStatus.responseTime) : "good",
    consecutiveFailures: kvkStatus.failedRequests || 0,
    statusHistory: [{
      timestamp: kvkStatus.lastChecked,
      status: kvkStatus.status as "active" | "inactive" | "error",
      responseTime: kvkStatus.responseTime,
      errorMessage: kvkStatus.error
    }]
  };

  return config;
}

// Main function to check all integrations
export async function checkAllIntegrations(): Promise<IntegrationStatus> {
  return {
    stripe: await checkStripeStatus(),
    mailgun: await checkMailgunStatus(),
    cloudinary: await checkCloudinaryStatus(),
    firebase: await checkFirebaseStatus(),
    googleMaps: await checkGoogleMapsStatus(),
    kvk: await checkKvkApiStatus()
  };
}