import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // Get environment variables
    const vercelUrl = Deno.env.get('VERCEL_WEBHOOK_URL')
    const webhookSecret = Deno.env.get('WA_WEBHOOK_SECRET')
    
    console.log('Environment check:', {
      vercelUrl: vercelUrl ? 'SET' : 'NOT SET',
      webhookSecret: webhookSecret ? 'SET' : 'NOT SET'
    })
    
    // Validate environment variables
    if (!vercelUrl || !webhookSecret) {
      console.error('Missing environment variables:', {
        vercelUrl: vercelUrl ? 'SET' : 'NOT SET',
        webhookSecret: webhookSecret ? 'SET' : 'NOT SET'
      })
      return new Response(JSON.stringify({ 
        error: 'Configuration error - missing environment variables',
        details: {
          vercelUrl: vercelUrl ? 'SET' : 'NOT SET',
          webhookSecret: webhookSecret ? 'SET' : 'NOT SET'
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Forward to Vercel API route
    const response = await fetch(vercelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': webhookSecret
      },
      body: JSON.stringify(body)
    })

    console.log('Vercel response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Vercel API error:', errorText)
      return new Response(JSON.stringify({ 
        error: 'Vercel API error', 
        status: response.status,
        details: errorText
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const result = await response.json()
    console.log('Vercel API success:', result)

    return new Response(JSON.stringify({ 
      success: true, 
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}) 