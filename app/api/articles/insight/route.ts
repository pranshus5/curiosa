// app/api/articles/insight/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { title, category, content } = await request.json()

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are a thoughtful intellectual companion for Curiosa, a reading app.

Article: "${title}"
Category: ${category}
Excerpt: ${content.slice(0, 900)}

Respond ONLY with valid JSON:
{
  "coreInsight": "The single deepest idea in 2 elegant sentences.",
  "rabbitHole": {
    "topic": "One fascinating related area to explore",
    "why": "One sentence explaining why it matters"
  },
  "question": "One genuinely open, provocative question to sit with",
  "connectedTo": "One specific book or essay the reader should seek out next"
}`,
      },
    ],
  })

  const raw   = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  try {
    return NextResponse.json(JSON.parse(clean))
  } catch {
    return NextResponse.json({ error: 'Failed to parse insight' }, { status: 500 })
  }
}
