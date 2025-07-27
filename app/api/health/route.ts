import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  try {
    // Simple health check - just return OK if the service is running
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      environment: process.env.NODE_ENV || 'development',
      services: {
        api: 'running',
        database: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'not_configured',
        whatsapp: process.env.WAHA_API_URL ? 'configured' : 'not_configured'
      }
    };

    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

export async function HEAD(): Promise<NextResponse> {
  // Simple HEAD request for basic health check
  return new NextResponse(null, { status: 200 });
}
