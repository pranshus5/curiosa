// lib/generate-articles.ts
import Anthropic from '@anthropic-ai/sdk'
import { ALL_CATEGORIES, Category } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Real high-quality publications to cite from
const REAL_SOURCES: Record<Category, { name: string; url: string }[]> = {
  Philosophy:   [{ name: 'Aeon', url: 'https://aeon.co' }, { name: 'Philosophy Now', url: 'https://philosophynow.org' }, { name: 'The Stone (NYT)', url: 'https://www.nytimes.com/column/the-stone' }],
  Science:      [{ name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' }, { name: 'Nature', url: 'https://www.nature.com' }, { name: 'Scientific American', url: 'https://www.scientificamerican.com' }],
  History:      [{ name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' }, { name: "History Today", url: 'https://www.historytoday.com' }, { name: 'Lapham\'s Quarterly', url: 'https://www.laphamsquarterly.org' }],
  Economics:    [{ name: 'The Economist', url: 'https://www.economist.com' }, { name: 'RAND Corporation', url: 'https://www.rand.org' }, { name: 'Project Syndicate', url: 'https://www.project-syndicate.org' }],
  Culture:      [{ name: 'The Atlantic', url: 'https://www.theatlantic.com' }, { name: 'The New Yorker', url: 'https://www.newyorker.com' }, { name: 'Lapham\'s Quarterly', url: 'https://www.laphamsquarterly.org' }],
  Technology:   [{ name: 'WIRED', url: 'https://www.wired.com' }, { name: 'MIT Technology Review', url: 'https://www.technologyreview.com' }, { name: 'Ars Technica', url: 'https://arstechnica.com' }],
  Arts:         [{ name: 'The Paris Review', url: 'https://www.theparisreview.org' }, { name: 'Frieze', url: 'https://www.frieze.com' }, { name: 'Literary Hub', url: 'https://lithub.com' }],
  Anthropology: [{ name: 'Sapiens', url: 'https://www.sapiens.org' }, { name: 'American Ethnologist', url: 'https://americanethnologist.org' }, { name: 'Aeon', url: 'https://aeon.co' }],
  Research:     [{ name: 'The Conversation', url: 'https://theconversation.com' }, { name: 'Nautilus', url: 'https://nautil.us' }, { name: 'Psyche', url: 'https://psyche.co' }],
}

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '𝛙', '❋', '◇', '⟁', '⌘']

interface GeneratedArticle {
  title: string
  category: Category
  source: string
  source_url: string
  read_time: number
  sym: string
  excerpt: string
  content: string
  references: string[]
  tags: string[]
}

async function generateOneArticle(
  category: Category,
  usedTitles: string[],
  dateStr: string
): Promise<GeneratedArticle> {
  const sources = REAL_SOURCES[category]
  const source  = sources[Math.floor(Math.random() * sources.length)]
  const sym     = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]

  const avoidStr = usedTitles.length
    ? `\nAvoid these topics already covered today: ${usedTitles.slice(-5).join(', ')}`
    : ''

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: `You are Curiosa's editorial AI — you curate intellectually rich, thought-provoking long-form articles for a daily reading app inspired by publications like Aeon, The Atlantic, and Quanta Magazine.

Today's date: ${dateStr}
Category: ${category}
Publication style: ${source.name}${avoidStr}

Generate ONE outstanding article. It must be:
- Genuinely thought-provoking and intellectually substantive
- Grounded in real thinkers, researchers, or historical events
- Relevant to the contemporary world while being timeless in its questions
- Written in an elegant, literary style — not academic jargon
- Between 450–600 words of body content

Respond ONLY with valid JSON (no markdown fences, no extra text):
{
  "title": "Compelling, specific headline — not generic",
  "excerpt": "2 sharp sentences that make a curious reader need to continue",
  "content": "5–6 rich paragraphs separated by \\n\\n. Real thinkers, studies, and concepts. First paragraph should be especially gripping.",
  "references": [
    "Author, A. (Year). Title. Publisher.",
    "Author, B. (Year). Article title. Journal Name, vol(issue), pages."
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "read_time": 8
}`,
      },
    ],
  })

  const raw   = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const obj   = JSON.parse(clean)

  return {
    ...obj,
    category,
    source:     source.name,
    source_url: source.url,
    sym,
  }
}

export async function generateDailyArticles(dateStr: string): Promise<GeneratedArticle[]> {
  // Pick 7 diverse categories — shuffle and take first 7
  const shuffled = [...ALL_CATEGORIES].sort(() => Math.random() - 0.5)
  const picks    = shuffled.slice(0, 7)

  const articles: GeneratedArticle[] = []
  const usedTitles: string[] = []

  // Generate sequentially to pass used titles and avoid overlap
  for (const category of picks) {
    try {
      const art = await generateOneArticle(category, usedTitles, dateStr)
      articles.push(art)
      usedTitles.push(art.title)
    } catch (err) {
      console.error(`Failed to generate article for ${category}:`, err)
      // Continue — don't fail the whole batch for one
    }
  }

  return articles
}
