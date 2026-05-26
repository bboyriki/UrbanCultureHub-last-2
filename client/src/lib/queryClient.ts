import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to parse as JSON first
    let errorData;
    let text;
    
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        // Clone response because we can only read the body once
        const clonedRes = res.clone();
        errorData = await clonedRes.json();
        text = JSON.stringify(errorData);
      } else {
        text = await res.text() || res.statusText;
      }
    } catch (e) {
      text = await res.text() || res.statusText;
    }
    
    // Create error with additional properties
    const error = new Error(`${res.status}: ${text}`);
    (error as any).status = res.status;
    (error as any).response = { 
      status: res.status, 
      data: errorData 
    };
    
    throw error;
  }
}

export async function apiRequest(
  urlOrOptions: string | { url: string; method: string; data?: unknown },
  method?: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Handle both formats of the function
  let url: string;
  let finalMethod: string;
  let finalData: unknown | undefined;
  let headers: Record<string, string> = {};
  let params: Record<string, any> = {};
  let withCredentials: boolean = true;

  // Try to get Firebase token from auth
  try {
    const auth = await import("@/firebase/firebase").then(m => m.auth);
    if (auth.currentUser) {
      const rawToken = await auth.currentUser.getIdToken();
      const token = rawToken?.replace(/[\s\r\n\t]+/g, "").trim();
      if (token && /^[A-Za-z0-9\-._~+/=]+$/.test(token)) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    console.error("Could not retrieve Firebase token:", error);
  }

  if (typeof urlOrOptions === 'string') {
    // Old format: apiRequest(url, method, data)
    url = urlOrOptions;
    finalMethod = method || 'GET';
    
    // Handle if data contains special configuration options
    if (data && typeof data === 'object') {
      // Handle special case for config object with headers, params, withCredentials
      if ((data as any).headers || (data as any).params || (data as any).withCredentials !== undefined) {
        if ((data as any).headers) {
          headers = { ...headers, ...(data as any).headers };
        }
        if ((data as any).params) {
          params = { ...params, ...(data as any).params };
        }
        if ((data as any).withCredentials !== undefined) {
          withCredentials = (data as any).withCredentials;
        }
        
        // If it's a config object, the data field could be nested or absent
        finalData = (data as any).data;
      } else {
        finalData = data;
      }
    } else {
      finalData = data;
    }
  } else {
    // New format: apiRequest({ url, method, data })
    url = urlOrOptions.url;
    finalMethod = urlOrOptions.method;
    finalData = urlOrOptions.data;
  }

  // For GET and HEAD methods, append query parameters to URL instead of using a request body
  let finalUrl = url;
  const requestOptions: RequestInit = {
    method: finalMethod,
    credentials: withCredentials ? "include" : "same-origin",
    headers: headers,
  };

  // Add query parameters to the URL
  if (Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });
    
    finalUrl = `${url}${url.includes("?") ? "&" : "?"}${searchParams.toString()}`;
  }

  if (finalData && (finalMethod === "GET" || finalMethod === "HEAD")) {
    // Convert data object to query parameters
    const dataParams = new URLSearchParams();
    Object.entries(finalData as Record<string, any>).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        dataParams.append(key, value.toString());
      }
    });
    
    // Append params to URL
    finalUrl = `${finalUrl}${finalUrl.includes("?") ? "&" : "?"}${dataParams.toString()}`;
  } else if (finalData) {
    // For other methods, use request body as usual
    if (finalData instanceof FormData) {
      // Don't set Content-Type for FormData - the browser will set it with the correct boundary
      requestOptions.body = finalData;
    } else {
      // For regular JSON data
      if (!requestOptions.headers || Object.keys(requestOptions.headers).length === 0) {
        requestOptions.headers = { "Content-Type": "application/json" };
      } else if (!(requestOptions.headers as Record<string, string>)["Content-Type"]) {
        (requestOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
      requestOptions.body = JSON.stringify(finalData);
    }
  }

  const res = await fetch(finalUrl, requestOptions);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Try to get Firebase token from auth
    let headers: Record<string, string> = {};
    try {
      const auth = await import("@/firebase/firebase").then(m => m.auth);
      if (auth.currentUser) {
        const rawToken = await auth.currentUser.getIdToken();
        const token = rawToken?.replace(/[\s\r\n\t]+/g, "").trim();
        if (token && /^[A-Za-z0-9\-._~+/=]+$/.test(token)) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error("Could not retrieve Firebase token for query:", error);
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
