// Helper functions for Branch System API synchronization
import type { BranchManifestData, ScanKeluarRequest, ScanTTDRequest, BranchSyncResult } from "@/types"

// Configuration constants with explicit typing
const BRANCH_API_BASE_URL: string = 'https://www.best.borneoekspedisi.com/api';
const BRANCH_API_KEY: string = 'borneo-test-api-key';
const DEFAULT_TIMEOUT: number = 10000;
const POST_TIMEOUT: number = 15000;

// Type-safe headers
const API_HEADERS: Record<string, string> = {
  'X-API-KEY': BRANCH_API_KEY,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
} as const;

/**
 * Fetch manifest detail from branch system with improved error handling
 */
export async function fetchManifestFromBranch(no_resi: string): Promise<BranchManifestData | null> {
  // Input validation
  if (!no_resi || no_resi.trim().length === 0) {
    console.warn('Invalid resi number provided to fetchManifestFromBranch');
    return null;
  }

  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    const response = await fetch(`${BRANCH_API_BASE_URL}/trackings/${encodeURIComponent(no_resi.trim())}`, {
      method: 'GET',
      headers: API_HEADERS,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        // Using console.warn instead of console.info for ESLint compliance
        console.warn(`Manifest not found in branch system: ${no_resi}`);
        return null; // Manifest not found - this is expected behavior
      }
      console.error(`Branch API error: ${response.status} - ${response.statusText} for resi: ${no_resi}`);
      return null; // Return null instead of throwing to prevent 500 errors
    }

    const data = await response.json();
    
    // Validate response data structure
    if (!data || typeof data !== 'object') {
      console.error('Invalid response data structure from branch API for resi:', no_resi);
      return null;
    }

    // Return the manifest part of the response, not the entire response
    if (data.success && data.manifest) {
      return data.manifest as BranchManifestData;
    }

    // Check if data itself is the manifest (different API response format)
    if (data.awb_no || data.no_resi) {
      return data as BranchManifestData;
    }

    console.warn('Unexpected response format from branch API for resi:', no_resi, 'Response:', data);
    return null;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Branch API request timeout for resi:', no_resi);
      } else {
        console.error('Error fetching manifest from branch for resi:', no_resi, 'Error:', error.message);
      }
    } else {
      console.error('Unknown error fetching manifest from branch for resi:', no_resi, error);
    }
    return null; // Return null instead of throwing to prevent 500 errors
  }
}

/**
 * Send scan keluar to branch system with improved validation
 */
export async function sendScanKeluarToBranch(data: ScanKeluarRequest): Promise<boolean> {
  // Validate input data
  if (!data || typeof data !== 'object') {
    console.error('Invalid scan keluar data provided');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POST_TIMEOUT);

    const response = await fetch(`${BRANCH_API_BASE_URL}/scankeluar`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify(data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Failed to send scan keluar to branch:', response.status, response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Scan keluar request timeout');
      } else {
        console.error('Error sending scan keluar to branch:', error.message);
      }
    } else {
      console.error('Unknown error sending scan keluar to branch:', error);
    }
    return false;
  }
}

/**
 * Send scan TTD (delivered) to branch system with improved validation
 */
export async function sendScanTTDToBranch(data: ScanTTDRequest): Promise<boolean> {
  // Validate input data
  if (!data || typeof data !== 'object') {
    console.error('Invalid scan TTD data provided');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POST_TIMEOUT);

    const response = await fetch(`${BRANCH_API_BASE_URL}/scanttd`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify(data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Failed to send scan TTD to branch:', response.status, response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Scan TTD request timeout');
      } else {
        console.error('Error sending scan TTD to branch:', error.message);
      }
    } else {
      console.error('Unknown error sending scan TTD to branch:', error);
    }
    return false;
  }
}

/**
 * Extract courier name from notes or location with improved type safety
 */
export function extractCourierName(notes: string | null, location: string | null): string {
  if (notes && typeof notes === 'string' && notes.trim().length > 0) {
    // Try to extract courier name from various note patterns
    const byMatch = notes.match(/by\s+(\w+)/i);
    const dashMatch = notes.match(/-\s+(\w+)/i);
    const bulkMatch = notes.match(/Bulk update - Shipped by\s+(\w+)/i);
    
    if (byMatch?.[1]) {
      return byMatch[1];
    } else if (dashMatch?.[1]) {
      return dashMatch[1];
    } else if (bulkMatch?.[1]) {
      return bulkMatch[1];
    }
  }
  
  // If courier name not found in notes, use location as fallback
  return (location && typeof location === 'string' && location.trim().length > 0) 
    ? location.trim() 
    : 'Kurir Default';
}
