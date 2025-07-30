// Helper functions for Branch System API synchronization
import type { BranchManifestData, ScanKeluarRequest, ScanTTDRequest, BranchSyncResult } from "@/types"

const BRANCH_API_BASE_URL = 'https://www.best.borneoekspedisi.com/api';
const BRANCH_API_KEY = 'borneo-test-api-key';

/**
 * Fetch manifest detail from branch system
 */
export async function fetchManifestFromBranch(no_resi: string): Promise<BranchManifestData | null> {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${BRANCH_API_BASE_URL}/trackings/${no_resi}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': BRANCH_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Manifest not found
      }
      console.error(`Branch API error: ${response.status} - ${response.statusText}`);
      return null; // Return null instead of throwing to prevent 500 errors
    }

    const data = await response.json();
    
    // Validate response data structure
    if (!data || typeof data !== 'object') {
      console.error('Invalid response data structure from branch API');
      return null;
    }

    // Return the manifest part of the response, not the entire response
    if (data.success && data.manifest) {
      return data.manifest as BranchManifestData;
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Branch API request timeout for:', no_resi);
      } else {
        console.error('Error fetching manifest from branch:', error.message);
      }
    }
    return null; // Return null instead of throwing to prevent 500 errors
  }
}

/**
 * Send scan keluar to branch system
 */
export async function sendScanKeluarToBranch(data: ScanKeluarRequest): Promise<boolean> {
  try {
    const response = await fetch(`${BRANCH_API_BASE_URL}/scankeluar`, {
      method: 'POST',
      headers: {
        'X-API-KEY': BRANCH_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error('Failed to send scan keluar to branch:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending scan keluar to branch:', error);
    return false;
  }
}

/**
 * Send scan TTD (delivered) to branch system
 */
export async function sendScanTTDToBranch(data: ScanTTDRequest): Promise<boolean> {
  try {
    const response = await fetch(`${BRANCH_API_BASE_URL}/scanttd`, {
      method: 'POST',
      headers: {
        'X-API-KEY': BRANCH_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error('Failed to send scan TTD to branch:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending scan TTD to branch:', error);
    return false;
  }
}

/**
 * Extract courier name from notes or location
 */
export function extractCourierName(notes: string | null, location: string | null): string {
  if (notes) {
    // Try to extract courier name from various note patterns
    const byMatch = notes.match(/by\s+(\w+)/i);
    const dashMatch = notes.match(/-\s+(\w+)/i);
    const bulkMatch = notes.match(/Bulk update - Shipped by\s+(\w+)/i);
    
    if (byMatch && byMatch[1]) {
      return byMatch[1];
    } else if (dashMatch && dashMatch[1]) {
      return dashMatch[1];
    } else if (bulkMatch && bulkMatch[1]) {
      return bulkMatch[1];
    }
  }
  
  // If courier name not found in notes, use location as fallback
  return location || 'Kurir Default';
}
