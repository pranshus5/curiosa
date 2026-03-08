import { NextResponse } from 'next/server'
import { generateDailyArticles } from '@/lib/generate-articles'
import { createServiceClient } from '@/lib/supabase'
import type { Category } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const TARGET_DAILY_COUNT = 3

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
      .select('id, category')
      .eq('date', today)

    if (checkError) {
      throw new Error(`Supabase check failed: ${checkError.message}`)
    }

    const existingRows = existing ?? []
    const existingCount = existingRows.length

    if (existingCount >= TARGET_DAILY_COUNT) {
      return NextResponse.json({
        success: true,
        message: 'Articles already exist for today',
        count: existingCount,
      })
    }

    const existingCategories = existingRows
      .map((row) => row.category)
      .filter((x): x is Category => typeof x === 'string') as Category[]

    const missingCount = TARGET_DAILY_COUNT - existingCount

    const articles = await generateDailyArticles(today, {
      count: missingCount,
      excludeCategories: existingCategories,
    })

    if (!articles || articles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generation Failed',
          message: 'No articles were generated',
          hint: 'Check Vercel runtime logs for Gemini status/raw response lines',
        },
        { status: 500 },
      )
    }

    const { error: insertError } = await db
      .from('articles')
      .insert(articles)

    if (insertError) {
      throw new Error(`Supabase insert failed: ${insertError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Articles generated successfully',
      count: existingCount + articles.length,
      inserted_now: articles.length,
    })
  } catch (err: any) {
    console.error('CRON EXECUTION ERROR:', err)

    return NextResponse.json(
      {
        success: false,
        error: 'Generation Failed',
        message: err?.message || 'Unknown error',
      },
      { status: 500 },
    )
  }
}
