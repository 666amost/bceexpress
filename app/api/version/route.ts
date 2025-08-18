// Simple API endpoint for version checking
// Note: Service worker disabled - this endpoint may not be actively used

import { NextRequest, NextResponse } from 'next/server';

interface VersionResponse {
  version: string;
  buildTime: string;
  features: string[];
  lastSync: string;
  serverStatus: 'healthy' | 'degraded';
}

// Cache version info for 10 minutes to reduce load
const VERSION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let cachedVersion: { data: VersionResponse; timestamp: number } | null = null;

export async function GET(request: NextRequest) {
  try {
    // Check if we have cached version data
    const now = Date.now();
    if (cachedVersion && (now - cachedVersion.timestamp) < VERSION_CACHE_TTL) {
      return NextResponse.json(cachedVersion.data, {
        headers: {
          'Cache-Control': 'public, max-age=600', // 10 minutes
          'X-Cache': 'HIT'
        }
      });
    }

    // Build simple version response
    const versionData: VersionResponse = {
      version: process.env.NEXT_PUBLIC_APP_VERSION || '5.3.1',
      buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      features: [
        'courier-tracking',
        'real-time-updates', 
        'bulk-operations',
        'offline-support'
      ],
      lastSync: new Date().toISOString(),
      serverStatus: 'healthy'
    };

    // Cache the response
    cachedVersion = {
      data: versionData,
      timestamp: now
    };

    return NextResponse.json(versionData, {
      headers: {
        'Cache-Control': 'public, max-age=600',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Version API error:', error);
    
    // Return fallback version info
    return NextResponse.json({
      version: '5.3.1',
      buildTime: new Date().toISOString(),
      features: ['basic-tracking'],
      lastSync: new Date().toISOString(),
      serverStatus: 'degraded',
      error: 'Unable to fetch complete version info'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Fallback': 'true'
      }
    });
  }
}
