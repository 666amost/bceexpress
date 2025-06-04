import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Coba ambil Git commit SHA dari environment variables Vercel
    const gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || 
                        process.env.CF_PAGES_COMMIT_SHA || 
                        process.env.GIT_HASH;
    
    // Jika tidak ada Git SHA, gunakan timestamp deployment sebagai fallback
    const deploymentTime = process.env.VERCEL_DEPLOYMENT_TIME || Date.now().toString();
    
    // Gunakan Git SHA jika tersedia, jika tidak gunakan deployment time
    const version = gitCommitSha || deploymentTime;
    
    return NextResponse.json({
      version: version,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
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