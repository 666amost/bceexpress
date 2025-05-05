import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

// Initialize Supabase client with proper error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
  )
}

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'bcexpress'
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
    const { data } = await supabaseClient.auth.getSession()

    if (!data.session || !data.session.user) {
      return null
    }

    // Get user profile from our custom users table
    const { data: userData, error } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", data.session.user.id)
      .single()

    if (error || !userData) {
      console.error("Get user profile error:", error)
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
