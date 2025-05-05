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

// Create Supabase client with proper configuration
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
  }
})

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

export type UserRole = "courier" | "admin" | "customer"

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
    console.error("Sign out error:", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const { data, error: sessionError } = await supabaseClient.auth.getSession()

    if (sessionError || !data.session || !data.session.user) {
      console.error("Session error:", sessionError)
      return null
    }

    // Get user profile from our custom users table
    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", data.session.user.id)
      .single()

    if (userError || !userData) {
      console.error("Get user profile error:", userError)
      return null
    }

    return {
      id: data.session.user.id,
      email: data.session.user.email || "",
      name: userData.name,
      role: userData.role as UserRole,
    }
  } catch (error) {
    console.error("Get current user error:", error)
    return null
  }
}
