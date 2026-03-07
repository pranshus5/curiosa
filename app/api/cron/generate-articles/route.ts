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

const ok = cronHeader === '1'
|| (secretParam && secretParam === cronSecret)
|| (authHeader && authHeader === Bearer ${cronSecret})

if (!ok) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const db = createServiceClient()
const today = new Date().toISOString().split('T')[0]

try {
const { data: existing, error: checkError } = await db
.from('articles')
.select('id')
.eq('date', today)
.limit(1)

} catch (err: any) {
console.error('CRON EXECUTION ERROR:', err)
return NextResponse.json({
error: 'Generation Failed',
message: err.message || 'Unknown error'
}, { status: 500 })
}
}
