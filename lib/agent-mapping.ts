// Agent mapping utility for handling email to agent name mapping
// Based on gabung.type file

export interface AgentMapping {
  email: string;
  agentName: string;
}

// Hardcoded mapping from gabung.type file
const AGENT_MAPPINGS: AgentMapping[] = [
  { email: "asiatpgk@bce.com", agentName: "555 in2 PKP" },
  { email: "ininpgk@bce.com", agentName: "555 in2 PKP" },
  { email: "sltagent01@bce.com", agentName: "SUNGAILIAT AGEN" },
  { email: "sltagent02@bce.com", agentName: "KOLIM SLT" },
  { email: "blyagent01@bce.com", agentName: "BELINYU AGEN" },
  { email: "blyagent02@bce.com", agentName: "BELINYU AGEN" },
  { email: "p3jbsagent01@bce.com", agentName: "JEBUS (ROBI SAFARI)" },
  { email: "p3jbsagent02@bce.com", agentName: "JEBUS (MARETTA)" },
  { email: "tblagent01@bce.com", agentName: "TOBOALI (ABING)" },
  { email: "tblagent02@bce.com", agentName: "TOBOALI (ABING)" },
  { email: "kobagent01@bce.com", agentName: "KOBA (ABING)" }
];

/**
 * Get all email addresses that map to a specific agent name
 * @param agentName The agent name to search for
 * @returns Array of email addresses mapped to this agent
 */
export function getEmailsForAgent(agentName: string): string[] {
  return AGENT_MAPPINGS
    .filter(mapping => mapping.agentName.toLowerCase() === agentName.toLowerCase())
    .map(mapping => mapping.email);
}

/**
 * Get the agent name for a given email address
 * @param email The email address to look up
 * @returns The agent name or null if not found
 */
export function getAgentForEmail(email: string): string | null {
  const mapping = AGENT_MAPPINGS.find(m => m.email.toLowerCase() === email.toLowerCase());
  return mapping ? mapping.agentName : null;
}

/**
 * Get all agent names and their mapped emails as options for filtering
 * @param baseAgentList The base list of agent names
 * @returns Enhanced agent list with email mappings
 */
export function getEnhancedAgentList(baseAgentList: string[]): string[] {
  const enhancedList = [...baseAgentList];

  // Heuristic: only add mapped agent names when the base list already appears
  // to be for the same branch/area as our AGENT_MAPPINGS. If there is no
  // overlap between the base list and any known mapped agent names, we assume
  // the caller is using a different manifest (for example: central) and we
  // should not inject branch-specific agent names.
  const hasMappedAgentOverlap = baseAgentList.some(baseAgent =>
    AGENT_MAPPINGS.some(mapping => mapping.agentName.toLowerCase() === baseAgent.toLowerCase())
  );

  if (!hasMappedAgentOverlap) {
    // No overlap -> don't augment; return a stable, sorted copy of the base list.
    return enhancedList.sort();
  }

  // Add emails that don't have a corresponding agent in the base list
  AGENT_MAPPINGS.forEach(mapping => {
    if (!baseAgentList.some(agent => agent.toLowerCase() === mapping.agentName.toLowerCase())) {
      if (!enhancedList.includes(mapping.agentName)) {
        enhancedList.push(mapping.agentName);
      }
    }
  });

  return enhancedList.sort();
}

/**
 * Check if a data row matches the selected agent filter (including mapped emails)
 * @param agentCustomer The agent_customer field from the data
 * @param selectedAgent The selected agent filter
 * @returns true if the data matches the filter
 */
export function doesAgentMatch(agentCustomer: string | undefined | null, selectedAgent: string): boolean {
  if (!agentCustomer || !selectedAgent) return false;
  
  // Direct match
  if (agentCustomer.toLowerCase() === selectedAgent.toLowerCase()) {
    return true;
  }
  
  // Check if agentCustomer is an email that maps to selectedAgent
  const mappedAgent = getAgentForEmail(agentCustomer);
  if (mappedAgent && mappedAgent.toLowerCase() === selectedAgent.toLowerCase()) {
    return true;
  }
  
  // Check if selectedAgent has mapped emails and agentCustomer is one of them
  const mappedEmails = getEmailsForAgent(selectedAgent);
  if (mappedEmails.some(email => email.toLowerCase() === agentCustomer.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Get all possible agent identifiers for a given agent name (including mapped emails)
 * This is useful for database queries where you want to include all variations
 * @param agentName The agent name to get identifiers for
 * @returns Array of all identifiers (agent name + mapped emails)
 */
export function getAllAgentIdentifiers(agentName: string): string[] {
  const identifiers = [agentName];
  const mappedEmails = getEmailsForAgent(agentName);
  identifiers.push(...mappedEmails);
  return identifiers;
}
