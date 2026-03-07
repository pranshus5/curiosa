import { ALL_CATEGORIES, Category } from '@/types'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY

const REAL_SOURCES: Record<Category, { name: string; url: string }[]> = {
  Philosophy:   [{ name: 'Aeon', url: 'https://aeon.co' }, { name: 'Philosophy Now', url: 'https://philosophynow.org' }],
  Science:      [{ name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' }, { name: 'Scientific American', url: 'https://www.scientificamerican.com' }],
  History:      [{ name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' }, { name: 'History Today', url: 'https://www.historytoday.com' }],
  Economics:    [{ name: 'The Economist', url: 'https://www.economist.com' }, { name: 'Project Syndicate', url: 'https://www.project-syndicate.org' }],
  Culture:      [{ name: 'The Atlantic', url: 'https://www.theatlantic.com' }, { name: 'The New Yorker', url: 'https://www.newyorker.com' }],
  Technology:   [{ name: 'WIRED', url: 'https://www.wired.com' }, { name: 'MIT Technology Review', url: 'https://www.technologyreview.com' }],
  Arts:         [{ name: 'The Paris Review', url: 'https://www.theparisreview.org' }, { name: 'Literary Hub', url: 'https://lithub.com' }],
  Anthropology: [{ name: 'Sapiens', url: 'https://www.sapiens.org' }, { name: 'Aeon', url: 'https://aeon.co' }],
  Research:     [{ name: 'The Conversation', url: 'https://theconversation.com' }, { name: 'Nautilus', url: 'https://nautil.us' }],
}

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇']

interface GeneratedArticle {
  title: string
  category: Category
  source: string
  source_url: string
  read_time: number
  sym: string
  excerpt: string
  content: string
  refs: string[]
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
  const avoid   = usedTitles.length ? 'Avoid these topics already covered: ' + usedTitles.slice(-5).join(', ') : ''

  const prompt = 'You are Curiosa editorial AI. Generate ONE thought-provoking article.\n\nDate: ' + dateStr + '\nCategory: ' + category + '\nStyle: ' + source.name + '\n' + avoid + '\n\nRespond ONLY with valid JSON:\n{"title":"compelling headline","excerpt":"2 sharp sentences","content":"5 paragraphs separated by \\n\\n with real thinkers and concepts","refs":["Author A. (Year). Title. Publisher.","Author B. (Year). Title. Journal."],"tags":["tag1","tag2","tag3"],"read_time":8}'

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 1200 },
    }),
  })

  const data  = await res.json()
  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const obj   = JSON.parse(clean)

  return {
    title:      obj.title,
    excerpt:    obj.excerpt,
    content:    obj.content,
    refs:       obj.refs || [],
    tags:       obj.tags || [],
    read_time:  obj.read_time || 8,
    category,
    source:     source.name,
    source_url: source.url,
    sym,
  }
}

export async function generateDailyArticles(dateStr: string): Promise<GeneratedArticle[]> {
  const shuffled = [...ALL_CATEGORIES].sort(() => Math.random() - 0.5)
  const picks    = shuffled.slice(0, 7)
  const articles: GeneratedArticle[] = []
  const usedTitles: string[] = []

  for (const category of picks) {
    try {
      const art = await generateOneArticle(category, usedTitles, dateStr)
      articles.push(art)
      usedTitles.push(art.title)
    } catch (err) {
      console.error('Failed to generate article for ' + category + ':', err)
    }
  }

  return articles
}
