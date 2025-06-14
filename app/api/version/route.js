import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Selalu generate timestamp baru untuk memastikan sync
    const currentTime = new Date().toISOString();
    
    // Coba ambil Git commit SHA dari environment variables Vercel
    const gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || 
                        process.env.CF_PAGES_COMMIT_SHA || 
                        process.env.GIT_HASH;
    
    // Jika tidak ada Git SHA, gunakan timestamp deployment sebagai fallback
    const deploymentTime = process.env.VERCEL_DEPLOYMENT_TIME || currentTime;
    
    // Gunakan Git SHA jika tersedia, jika tidak gunakan deployment time
    const version = gitCommitSha || deploymentTime;
    
    // Tambahkan build time untuk memastikan cache invalidation
    const buildTime = currentTime;
    
    return NextResponse.json({
      version: version,
      buildTime: buildTime,
      timestamp: currentTime,
      environment: process.env.NODE_ENV || 'development',
      forceUpdate: true, // Selalu force update untuk memastikan sync
      lastSync: currentTime
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Error getting app version:', error);
    
    return NextResponse.json({
      version: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to get version'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
} 