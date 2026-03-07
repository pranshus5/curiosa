import { ALL_CATEGORIES, Category } from '@/types'

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇']

const REAL_SOURCES: Record<Category, { name: string; url: string }[]> = {
  Philosophy: [{ name: 'Aeon', url: 'https://aeon.co' }],
  Science: [{ name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' }],
  History: [{ name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' }],
  Economics: [{ name: 'The Economist', url: 'https://www.economist.com' }],
  Culture: [{ name: 'The Atlantic', url: 'https://www.theatlantic.com' }],
  Technology: [{ name: 'WIRED', url: 'https://www.wired.com' }],
  Arts: [{ name: 'The Paris Review', url: 'https://www.theparisreview.org' }],
  Anthropology: [{ name: 'Sapiens', url: 'https://www.sapiens.org' }],
  Research: [{ name: 'The Conversation', url: 'https://theconversation.com' }],
}

type GeneratedArticle = {
  title: string
  excerpt: string
  content: string
  refs: string[]
  tags: string[]
  category: Category
  source: string
  source_url: string
  date: string
  read_time: number
  sym: string
}

export async function generateDailyArticles(dateStr: string): Promise<GeneratedArticle[]> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment variables')
  }

  const shuffled = [...ALL_CATEGORIES]
    .sort(() => Math.random() - 0.5)
    .slice(0, 7)

  const articles: GeneratedArticle[] = []

  for (const cat of shuffled) {
    const source = REAL_SOURCES[cat][0]

    const prompt = `Generate a thought-provoking article about ${cat} in the style of ${source.name}.
Respond ONLY with valid JSON. No markdown fences. No explanation text.
Use exactly this shape:
{
  "title": "A compelling headline",
  "excerpt": "A 2-sentence summary",
  "content": "A detailed 5-paragraph exploration with line breaks",
  "refs": ["Source 1", "Source 2"],
  "tags": ["tag1", "tag2"]
}`

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 1500,
            },
          }),
        }
      )

      console.log(`Gemini status for ${cat}:`, res.status)

      const rawText = await res.text()
      console.log(`Gemini raw response for ${cat}:`, rawText)

      if (!res.ok) {
        console.error(`Gemini request failed for ${cat}`)
        continue
      }

      let data: any
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        console.error(`Failed to parse Gemini API response for ${cat}:`, e)
        continue
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        console.error(`Gemini returned no usable text for ${cat}:`, data)
        continue
      }

      let obj: any
      try {
        const cleanJson = text.replace(/```json|```/g, '').trim()
        obj = JSON.parse(cleanJson)
      } catch (e) {
        console.error(`Failed to parse article JSON for ${cat}:`, e)
        console.error(`Article text was:`, text)
        continue
      }

      articles.push({
        title: obj.title || `Exploring ${cat}`,
        excerpt: obj.excerpt || '',
        content: obj.content || '',
        refs: Array.isArray(obj.refs) ? obj.refs : [],
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        category: cat,
        source: source.name,
        source_url: source.url,
        date: dateStr,
        read_time: 7,
        sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      })
    } catch (e) {
      console.error(`Curation failed for ${cat}:`, e)
    }
  }

  console.log(`Generated ${articles.length} articles total`)
  return articles
}
