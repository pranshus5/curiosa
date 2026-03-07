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

  const ok = cronHeader === '1'
    || secretParam === process.env.CRON_SECRET
    || authHeader === ('Bearer ' + process.env.CRON_SECRET)

  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await db
    .from('articles').select('id').eq('date', today).limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Already generated articles for today' })
  }

  try {
    const articles = await generateDailyArticles(today)
    if (articles.length === 0) throw new Error('No articles generated')

    const rows = articles.map(a => ({
      title: a.title, category: a.category, source: a.source,
      source_url: a.source_url, read_time: a.read_time, date: today,
      sym: a.sym, excerpt: a.excerpt, content: a.content,
      refs: a.refs ?? [], tags: a.tags ?? [],
    }))

    const { error } = await db.from('articles').insert(rows)
    if (error) throw error

    return NextResponse.json({ success: true, count: rows.length, titles: articles.map(a => a.title) })
  } catch (err) {
    return NextResponse.json({ error: 'Failed', detail: String(err) }, { status: 500 })
  }
}
