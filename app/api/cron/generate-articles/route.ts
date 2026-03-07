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

  try {
    // 1. Check for existing articles
    const { data: existing, error: checkError } = await db
      .from('articles').select('id').eq('date', today).limit(1)
    
    if (checkError) throw new Error(`Supabase Check Error: ${checkError.message}`)

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Already generated articles for today' })
    }

    // 2. Generate Articles via Gemini
    const articles = await generateDailyArticles(today)
    if (!articles || articles.length === 0) throw new Error('Gemini returned no articles')

    // 3. Map to Database Rows
    const rows = articles.map(a => ({
      title: a.title, 
      category: a.category, 
      source: a.source,
      source_url: a.source_url, 
      read_time: a.read_time || 7, 
      date: today,
      sym: a.sym || '◈', 
      excerpt: a.excerpt, 
      content: a.content,
      refs: a.refs || [], 
      tags: a.tags || [],
    }))

    // 4. Insert into Supabase
    const { error: insertError } = await db.from('articles').insert(rows)
    if (insertError) throw new Error(`Supabase Insert Error: ${insertError.message}`)

    return NextResponse.json({ 
      success: true, 
      count: rows.length, 
      titles: articles.map(a => a.title) 
    })

  } catch (err: any) {
    console.error('CRON ERROR:', err)
    return NextResponse.json({ 
      error: 'Failed', 
      message: err.message || 'Unknown error',
      detail: err.details || 'Check Vercel logs'
    }, { status: 500 })
  }
}
