// app/api/articles/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date     = searchParams.get('date')     // YYYY-MM-DD, default today
  const category = searchParams.get('category') // optional filter
  const archive  = searchParams.get('archive')  // 'true' = fetch last 30 days except today

  const db    = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  let query = db
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })

  if (archive === 'true') {
    // Return articles from last 30 days, excluding today
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    query = query
      .lt('date', today)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
  } else {
    // Default: today's articles
    query = query.eq('date', date || today)
  }

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ articles: data || [] })
}
