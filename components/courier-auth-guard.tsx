"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, type UserSession } from "@/lib/auth"
import { Loader2 } from "lucide-react"
import { isInCapacitor, sendMessageToCapacitor } from "@/lib/capacitor-utils"

export function CourierAuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserSession | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        if (isInCapacitor()) {
          console.warn('CourierAuthGuard: User not found, sending logout message to Capacitor');
          sendMessageToCapacitor('COURIER_LOGOUT', { reason: 'auth_guard_no_user' });
          return;
        }
        router.push("/courier")
        return
      }

      if (currentUser.role !== "courier" && currentUser.role !== "admin") {
        if (isInCapacitor()) {
          console.warn('CourierAuthGuard: Invalid role, sending logout message to Capacitor');
          sendMessageToCapacitor('COURIER_LOGOUT', { reason: 'auth_guard_invalid_role' });
          return;
        }
        router.push("/courier")
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
