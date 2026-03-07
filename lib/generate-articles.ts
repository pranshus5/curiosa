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

type GeminiArticlePayload = {
  title?: string
  excerpt?: string
  content?: string
  refs?: unknown
  tags?: unknown
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
    const source = REAL_SOURCES[cat]?.[0]

    if (!source) {
      console.error(`No source configured for category: ${cat}`)
      continue
    }

    const prompt = `
Generate a thought-provoking article about ${cat} in the style of ${source.name}.

Return ONLY valid JSON with this exact structure:
{
  "title": "A compelling headline",
  "excerpt": "A 2-sentence summary",
  "content": "A detailed 5-paragraph exploration with line breaks",
  "refs": ["Source 1", "Source 2"],
  "tags": ["tag1", "tag2"]
}

Rules:
- Do not wrap the JSON in markdown
- Do not add commentary
- Ensure refs is an array of strings
- Ensure tags is an array of strings
- Make the content polished and readable
`.trim()

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
              responseMimeType: 'application/json',
            },
          }),
        }
      )

      const rawText = await res.text()
      console.log(`Gemini status for ${cat}: ${res.status}`)
      console.log(`Gemini raw response for ${cat}: ${rawText}`)

      if (!res.ok) {
        console.error(`Gemini request failed for ${cat}: ${res.status} ${rawText}`)
        continue
      }

      let data: any
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        console.error(`Failed to parse Gemini API envelope for ${cat}:`, e)
        continue
      }

      const candidate = data?.candidates?.[0]
      const finishReason = candidate?.finishReason
      const text = candidate?.content?.parts?.[0]?.text

      if (finishReason && finishReason !== 'STOP') {
        console.error(`Gemini did not finish normally for ${cat}: ${finishReason}`, data)
      }

      if (!text || typeof text !== 'string') {
        console.error(`Gemini returned no usable text for ${cat}:`, data)
        continue
      }

      let obj: GeminiArticlePayload
      try {
        obj = JSON.parse(text)
      } catch (e) {
        console.error(`Failed to parse article JSON for ${cat}:`, e)
        console.error(`Article text was:`, text)
        continue
      }

      const refs =
        Array.isArray(obj.refs) ? obj.refs.filter((x): x is string => typeof x === 'string') : []

      const tags =
        Array.isArray(obj.tags) ? obj.tags.filter((x): x is string => typeof x === 'string') : []

      const title = typeof obj.title === 'string' ? obj.title.trim() : ''
      const excerpt = typeof obj.excerpt === 'string' ? obj.excerpt.trim() : ''
      const content = typeof obj.content === 'string' ? obj.content.trim() : ''

      if (!title || !excerpt || !content) {
        console.error(`Gemini returned incomplete article for ${cat}:`, obj)
        continue
      }

      articles.push({
        title,
        excerpt,
        content,
        refs,
        tags,
        category: cat,
        source: source.name,
        source_url: source.url,
        date: dateStr,
        read_time: 7,
        sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      })

      console.log(`Article generated successfully for ${cat}`)
    } catch (e) {
      console.error(`Curation failed for ${cat}:`, e)
    }
  }

  console.log(`Generated ${articles.length} articles total`)
  return articles
}
