import { createServiceClient } from '@/lib/supabase'
import CuriosaClient from '@/components/CuriosaClient'
import type { Article } from '@/types'

export const revalidate = 0
export const dynamic = 'force-dynamic'

function normalizeArticle(row: any): Article {
  const rawReferences = Array.isArray(row.references)
    ? row.references
    : Array.isArray(row.refs)
      ? row.refs
      : []

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    category: row.category,
    source: String(row.source ?? ''),
    source_url: String(row.source_url ?? ''),
    read_time: Number(row.read_time ?? 5),
    date: String(row.date ?? ''),
    sym: String(row.sym ?? '◈'),
    excerpt: String(row.excerpt ?? ''),
    content: String(row.content ?? ''),
    references: rawReferences.filter((x: unknown): x is string => typeof x === 'string'),
    tags: Array.isArray(row.tags)
      ? row.tags.filter((x: unknown): x is string => typeof x === 'string')
      : [],
    created_at: String(row.created_at ?? ''),
  }
}

export default async function Page() {
  const db = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('articles')
    .select('*')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('PAGE LOAD ERROR:', error)
  }

  const articles: Article[] = Array.isArray(data) ? data.map(normalizeArticle) : []

  return <CuriosaClient initialArticles={articles} />
}
