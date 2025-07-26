'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children, ...props }: { children: React.ReactNode; attribute?: string; defaultTheme?: string; enableSystem?: boolean; storageKey?: string; disableTransitionOnChange?: boolean }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
