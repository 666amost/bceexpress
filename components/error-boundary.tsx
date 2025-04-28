"use client"

import type React from "react"

import { useEffect, useState } from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ErrorBoundary({
  children,
  fallback = <p>Something went wrong. Please try again later.</p>,
}: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error("Caught error:", error)
      setError(error.error)
      setHasError(true)
    }

    window.addEventListener("error", errorHandler)
    return () => window.removeEventListener("error", errorHandler)
  }, [])

  if (hasError) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 rounded-md">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">Something went wrong</h2>
        {error && <pre className="mt-2 text-sm text-red-700 dark:text-red-300 overflow-auto">{error.message}</pre>}
        <button
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => setHasError(false)}
        >
          Try again
        </button>
      </div>
    )
  }

  return <>{children}</>
}
