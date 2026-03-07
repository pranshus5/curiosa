import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  const db = createServiceClient()

  try {
    const { data, error } = await db
      .from('articles')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ articles: data || [] })
  } catch (err: any) {
    console.error('Fetch error:', err)
    return NextResponse.json({ 
      error: 'Failed to fetch articles', 
      message: err.message || 'Unknown error' 
    }, { status: 500 })
  }
}
