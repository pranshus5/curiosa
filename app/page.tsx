// app/page.tsx
import { createServiceClient } from '@/lib/supabase'
import CuriosaClient from '@/components/CuriosaClient'
import { Article } from '@/types'

export const revalidate = 3600 // revalidate every hour

async function getTodaysArticles(): Promise<Article[]> {
  const db    = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('articles')
    .select('*')
    .eq('date', today)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }

  return data || []
}

export default async function Home() {
  const articles = await getTodaysArticles()

  return <CuriosaClient initialArticles={articles} />
}
