// app/api/cron/generate-articles/route.ts
import { NextResponse } from 'next/server'
import { generateDailyArticles } from '@/lib/generate-articles'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min timeout for Vercel Pro; 60s on hobby

export async function GET(request: Request) {
  // ── Security: only allow Vercel cron or requests with your secret ──
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-vercel-cron') // set by Vercel automatically

  const isVercelCron  = cronHeader === '1'
  const hasSecret     = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron && !hasSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db      = createServiceClient()
  const today   = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // ── Check if we already ran today ──
  const { data: existing } = await db
    .from('articles')
    .select('id')
    .eq('date', today)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: `Already generated articles for ${today}` })
  }

  try {
    console.log(`[Curiosa Cron] Generating articles for ${today}…`)
    const articles = await generateDailyArticles(today)

    if (articles.length === 0) {
      throw new Error('No articles were generated')
    }

    // ── Insert into Supabase ──
    const rows = articles.map(a => ({
      title:      a.title,
      category:   a.category,
      source:     a.source,
      source_url: a.source_url,
      read_time:  a.read_time,
      date:       today,
      sym:        a.sym,
      excerpt:    a.excerpt,
      content:    a.content,
      references: a.references,   // stored as jsonb array
      tags:       a.tags,         // stored as jsonb array
    }))

    const { error } = await db.from('articles').insert(rows)

    if (error) throw error

    console.log(`[Curiosa Cron] ✓ Inserted ${rows.length} articles for ${today}`)
    return NextResponse.json({
      success: true,
      date: today,
      count: rows.length,
      titles: articles.map(a => a.title),
    })
  } catch (err) {
    console.error('[Curiosa Cron] Error:', err)
    return NextResponse.json(
      { error: 'Failed to generate articles', detail: String(err) },
      { status: 500 }
    )
  }
}
