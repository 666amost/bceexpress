import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const status = {
      webhook_secret: {
        configured: !!process.env.WA_WEBHOOK_SECRET,
        value: process.env.WA_WEBHOOK_SECRET ? '***SET***' : 'NOT SET'
      },
      waha_api_url: {
        configured: !!process.env.WAHA_API_URL,
        value: process.env.WAHA_API_URL || 'NOT SET'
      },
      waha_session: {
        configured: !!process.env.WAHA_SESSION,
        value: process.env.WAHA_SESSION || 'default'
      },
      wa_group_id: {
        configured: !!process.env.WA_GROUP_ID,
        value: process.env.WA_GROUP_ID || 'NOT SET'
      },
      vercel_webhook_url: {
        configured: !!process.env.VERCEL_WEBHOOK_URL,
        value: process.env.VERCEL_WEBHOOK_URL || 'NOT SET'
      }
    };

    const allConfigured = status.webhook_secret.configured && 
                         status.waha_api_url.configured && 
                         status.wa_group_id.configured;

    return NextResponse.json({
      status: allConfigured ? 'ready' : 'incomplete',
      configurations: status,
      message: allConfigured 
        ? 'WhatsApp integration is properly configured' 
        : 'Some WhatsApp environment variables are missing'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to check WhatsApp status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 