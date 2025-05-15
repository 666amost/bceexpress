import type * as React from "react"
import { cn } from "@/lib/utils"

interface TimelineProps {
  children: React.ReactNode
  className?: string
}

export function Timeline({ children, className }: TimelineProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>
}

interface TimelineItemProps {
  children: React.ReactNode
  className?: string
}

export function TimelineItem({ children, className }: TimelineItemProps) {
  return <div className={cn("relative", className)}>{children}</div>
}

interface TimelineConnectorProps {
  className?: string
}

export function TimelineConnector({ className }: TimelineConnectorProps) {
  return <div className={cn("absolute left-3.5 top-8 -bottom-6 w-px bg-border", className)} aria-hidden="true"></div>
}

interface TimelineHeaderProps {
  children: React.ReactNode
  className?: string
}

export function TimelineHeader({ children, className }: TimelineHeaderProps) {
  return <div className={cn("flex items-start gap-3", className)}>{children}</div>
}

interface TimelineIconProps {
  className?: string
}

export function TimelineIcon({ className }: TimelineIconProps) {
  return <div className={cn("mt-1 h-7 w-7 rounded-full", className)}></div>
}

interface TimelineBodyProps {
  children: React.ReactNode
  className?: string
}

export function TimelineBody({ children, className }: TimelineBodyProps) {
  return <div className={cn("ml-10", className)}>{children}</div>
}
