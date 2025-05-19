"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, type UserSession } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export function LeaderAuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserSession | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        router.push("/admin")
        return
      }

      if (currentUser.role !== "leader" && currentUser.role !== "admin") {
        router.push("/admin")
        return
      }

      setUser(currentUser)
      setIsLoading(false)
    }

    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
