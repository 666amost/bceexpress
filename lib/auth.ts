import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Ensure the URL is properly formatted
const formattedUrl = supabaseUrl.startsWith('https://') ? supabaseUrl : `https://${supabaseUrl}`

// Create Supabase client with optimized configuration for high concurrency
export const supabaseClient = createClient<Database>(formattedUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'bcexpress-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  global: {
    headers: {
      'X-Client-Info': 'bcexpress-web'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10 // Limit realtime events for better performance
    }
  }
})

// Simplified connection management to avoid multiple GoTrueClient instances
class ConnectionPool {
  private static instance: ConnectionPool
  private requestCount = 0

  private constructor() {
    // No need to create multiple clients, just use the main client
  }

  public static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool()
    }
    return ConnectionPool.instance
  }

  public async getClient() {
    // Always return the main client to avoid multiple instances
    // Add minimal delay for load balancing only when needed
    this.requestCount++
    if (this.requestCount % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 20)) // 20ms delay every 10th request
    }
    
    return supabaseClient
  }
}

// Get pooled client for high concurrency operations with fallback
export const getPooledClient = async () => {
  try {
    return await ConnectionPool.getInstance().getClient()
  } catch (error) {

    return supabaseClient
  }
}

// Alternative function to get authenticated client
export const getAuthenticatedClient = async () => {
  try {
    // First try to get session from main client
    const { data: session, error } = await supabaseClient.auth.getSession()
    
    if (error || !session.session) {
      throw new Error('No valid session found')
    }
    
    // Return main client if session is valid
    return supabaseClient
  } catch (error) {

    throw error
  }
}

// Retry wrapper for database operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff with jitter
      const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 1000
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }
  }

  throw lastError!
}

// Add this after the supabaseClient definition
export async function getCachedSession() {
  if (typeof window !== 'undefined') {
    const cachedSession = localStorage.getItem('cachedSession');
    if (cachedSession) {
      const parsedSession = JSON.parse(cachedSession);
      if (parsedSession.expiry > Date.now()) {
        return parsedSession.session;
      } else {
        localStorage.removeItem('cachedSession');
      }
    }
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      const expiryTime = Date.now() + 5 * 60 * 1000;  // Cache for 5 minutes
      localStorage.setItem('cachedSession', JSON.stringify({ session: data.session, expiry: expiryTime }));
    }
    return data.session;
  }
  return null;
}

// Create a separate client for server-side operations
export const supabaseServerClient = createClient(formattedUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      'X-Client-Info': 'bcexpress-server'
    }
  }
})

export type UserRole = "courier" | "admin" | "customer" | "branch"

export interface UserSession {
  id: string
  email: string
  name: string
  role: UserRole
}

export async function signOut(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      return { error: error.message }
    }
    return { error: null }
  } catch (error) {
    throw error
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const { data, error: sessionError } = await supabaseClient.auth.getSession()

    if (sessionError || !data.session || !data.session.user) {
      return null
    }

    // Get user profile from our custom users table
    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", data.session.user.id)
      .single()

    if (userError || !userData) {
      return null
    }

    return {
      id: data.session.user.id,
      email: data.session.user.email || "",
      name: userData.name,
      role: userData.role as UserRole,
    }
  } catch (error) {
    throw error
  }
}
