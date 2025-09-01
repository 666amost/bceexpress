"use client"

import { useState, useEffect } from 'react'
import { supabaseClient } from '@/lib/auth'
import CustomerManager from '@/components/CustomerManager'

export default function CustomersPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [branchOrigin, setBranchOrigin] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          
          // Ambil data user dari table users untuk mendapatkan origin_branch dan role yang benar
          const { data: userData } = await supabaseClient
            .from("users")
            .select("role, origin_branch")
            .eq("id", session.user.id)
            .single()
            
          if (userData) {
            setBranchOrigin(userData.origin_branch as string)
            setUserRole(userData.role as string)
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setLoading(false)
      }
    }

    void checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Unauthorized access. Please login.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <CustomerManager 
          branchOrigin={branchOrigin} 
          userRole={userRole}
          mode="manage" 
        />
      </div>
    </div>
  )
}
