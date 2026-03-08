// app/api/user/route.ts
//
// Simple user-state API using a client-generated UUID stored in localStorage.
// No authentication required — each browser is its own "user".
// To add real auth later, replace user_id with a Supabase Auth UID.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// ── GET: fetch read articles + annotations for a user ──
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const db = createServiceClient()

  const [readRes, annotRes] = await Promise.all([
    db.from('user_article_states').select('article_id, read_at').eq('user_id', userId).eq('is_read', true),
    db.from('annotations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    readArticles: readRes.data || [],
    annotations:  annotRes.data || [],
  })
}

// ── POST: mark article as read OR save annotation ──
export async function POST(request: Request) {
  const body = await request.json()
  const db   = createServiceClient()

  // Mark as read
  if (body.type === 'mark_read') {
    const { user_id, article_id } = body
    const { error } = await db.from('user_article_states').upsert(
      { user_id, article_id, is_read: true, read_at: new Date().toISOString() },
      { onConflict: 'user_id,article_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Save annotation
  if (body.type === 'save_annotation') {
    const { user_id, article_id, article_title, text, note, color } = body
    const { data, error } = await db.from('annotations').insert({
      user_id, article_id, article_title, text, note, color,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ annotation: data })
  }

  // Delete annotation
  if (body.type === 'delete_annotation') {
    const { id, user_id } = body
    const { error } = await db.from('annotations').delete().eq('id', id).eq('user_id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
