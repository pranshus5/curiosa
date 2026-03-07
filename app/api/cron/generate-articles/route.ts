import { NextResponse } from 'next/server'
import { generateDailyArticles } from '@/lib/generate-articles'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const url = new URL(request.url)
  const secretParam = url.searchParams.get('secret')
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET || ''

  const ok =
    cronHeader === '1' ||
    secretParam === cronSecret ||
    authHeader === `Bearer ${cronSecret}`

  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: existing, error: checkError } = await db
      .from('articles')
      .select('id')
      .eq('date', today)
      .limit(1)

    if (checkError) {
      throw new Error(`Supabase Check Error: ${checkError.message}`)
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Articles already exist for today',
      })
    }

    const result = await generateDailyArticles()

    return NextResponse.json({
      success: true,
      message: 'Articles generated successfully',
      result,
    })
  } catch (err: any) {
    console.error('CRON EXECUTION ERROR:', err)

    return NextResponse.json(
      {
        error: 'Generation Failed',
        message: err?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
