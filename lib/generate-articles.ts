import { ALL_CATEGORIES, Category } from '@/types'

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇']

const REAL_SOURCES: Record<Category, { name: string; url: string }[]> = {
  Philosophy:   [{ name: 'Aeon', url: 'https://aeon.co' }],
  Science:      [{ name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' }],
  History:      [{ name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' }],
  Economics:    [{ name: 'The Economist', url: 'https://www.economist.com' }],
  Culture:      [{ name: 'The Atlantic', url: 'https://www.theatlantic.com' }],
  Technology:   [{ name: 'WIRED', url: 'https://www.wired.com' }],
  Arts:         [{ name: 'The Paris Review', url: 'https://www.theparisreview.org' }],
  Anthropology: [{ name: 'Sapiens', url: 'https://www.sapiens.org' }],
  Research:     [{ name: 'The Conversation', url: 'https://theconversation.com' }],
}

export async function generateDailyArticles(dateStr: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const shuffled = [...ALL_CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 7);
  const articles = [];

  for (const cat of shuffled) {
    const source = REAL_SOURCES[cat][0];
    const prompt = `Generate a JSON object for a thought-provoking article about ${cat}. 
    Format: {"title": "string", "excerpt": "2 sentences", "content": "5 paragraphs", "refs": ["Source 1"], "tags": ["tag1"]}. 
    Ensure valid JSON. No markdown backticks.`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanJson = text.replace(/```json|```/g, "").trim();
      const obj = JSON.parse(cleanJson);

      articles.push({
        ...obj,
        category: cat,
        source: source.name,
        source_url: source.url,
        date: dateStr,
        read_time: 7,
        sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      });
    } catch (e) {
      console.error("Gemini failed for", cat, e);
    }
  }
  return articles;
}
