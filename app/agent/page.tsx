"use client"

import { AgentProvider } from './context/AgentContext'
import { AgentDashboard } from './components/AgentDashboard'

export default function AgentPage() {
  return (
    <AgentProvider>
      <AgentDashboard />
    </AgentProvider>
  )
}
