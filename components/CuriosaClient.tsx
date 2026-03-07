'use client'
// components/CuriosaClient.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Article, Category,
  ALL_CATEGORIES, CATEGORY_COLORS,
  HIGHLIGHT_COLORS, HIGHLIGHT_NAMES,
} from '@/types'

/* ── helpers ── */
const fmt = (d: string) => {
  const today = new Date().toISOString().split('T')[0]
  const yday  = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (d === today) return 'Today'
  if (d === yday)  return 'Yesterday'
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const grp = <T,>(arr: T[], fn: (v: T) => string): Record<string, T[]> =>
  arr.reduce((a, v) => { const k = fn(v); (a[k] = a[k] || []).push(v); return a }, {} as Record<string, T[]>)

/* ── user ID (localStorage) ── */
function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('curiosa_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('curiosa_uid', id) }
  return id
}

interface Annotation {
  id: string
  article_id: string
  article_title: string
  text: string
  note: string
  color: string
  created_at: string
}

interface Insight {
  coreInsight: string
  rabbitHole: { topic: string; why: string }
  question: string
  connectedTo: string
}

export default function CuriosaClient({ initialArticles }: { initialArticles: Article[] }) {
  /* ── state ── */
  const [articles, setArticles]       = useState<Article[]>(initialArticles)
  const [selCat, setSelCat]           = useState<'All' | Category>('All')
  const [readSet, setReadSet]         = useState<Set<string>>(new Set())
  const [annots, setAnnots]           = useState<Annotation[]>([])
  const [openArt, setOpenArt]         = useState<Article | null>(null)
  const [view, setView]               = useState<'feed' | 'archive' | 'notebook'>('feed')
  const [streak, setStreak]           = useState(0)
  const [goal]                        = useState(3)
  const [searchQ, setSearchQ]         = useState('')
  const [searchOpen, setSearchOpen]   = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [archiveLoaded, setArchiveLoaded] = useState(false)
  const [archiveArts, setArchiveArts] = useState<Article[]>([])

  /* reader */
  const [readPct, setReadPct]         = useState(0)
  const [ttsOn, setTtsOn]             = useState(false)
  const [textSel, setTextSel]         = useState<string | null>(null)
  const [hiIdx, setHiIdx]             = useState(0)
  const [noteText, setNoteText]       = useState('')
  const [insight, setInsight]         = useState<Insight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [toastMsg, setToastMsg]       = useState('')
  const [rfs, setRfs]                 = useState(18)

  const readerRef = useRef<HTMLDivElement>(null)
  const markRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── load user state on mount ── */
  useEffect(() => {
    const uid = getUserId()
    if (!uid) return
    fetch(`/api/user?user_id=${uid}`)
      .then(r => r.json())
      .then(({ readArticles, annotations }) => {
        setReadSet(new Set((readArticles || []).map((r: any) => r.article_id)))
        setAnnots(annotations || [])
        // Compute streak from readArticles
        computeStreak(readArticles || [])
      })
      .catch(console.error)
  }, [])

  const computeStreak = (readArticles: { read_at: string }[]) => {
    if (!readArticles.length) { setStreak(0); return }
    const dates = [...new Set(readArticles.map(r => r.read_at?.split('T')[0]).filter(Boolean))]
    dates.sort((a, b) => b!.localeCompare(a!))
    let s = 0; let cur = new Date()
    for (const d of dates) {
      const dd = new Date(d!)
      const diff = Math.round((cur.getTime() - dd.getTime()) / 86400000)
      if (diff <= 1) { s++; cur = dd } else break
    }
    setStreak(s)
  }

  /* ── load archive on tab switch ── */
  useEffect(() => {
    if (view === 'archive' && !archiveLoaded) {
      setLoadingMore(true)
      fetch('/api/articles?archive=true')
        .then(r => r.json())
        .then(({ articles: arts }) => { setArchiveArts(arts || []); setArchiveLoaded(true) })
        .catch(console.error)
        .finally(() => setLoadingMore(false))
    }
  }, [view, archiveLoaded])

  /* ── reader scroll ── */
  useEffect(() => {
    const el = readerRef.current; if (!el) return
    const fn = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setReadPct(Math.min(100, Math.round(scrollTop / (scrollHeight - clientHeight) * 100)))
    }
    el.addEventListener('scroll', fn)
    return () => el.removeEventListener('scroll', fn)
  }, [openArt])

  const showToast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2400) }

  /* ── open article ── */
  const openArticle = (art: Article) => {
    setOpenArt(art); setReadPct(0); setInsight(null); setTextSel(null); setNoteText('')
    window.speechSynthesis?.cancel(); setTtsOn(false)
    // Mark as read after 10s
    markRef.current = setTimeout(() => {
      if (readSet.has(art.id)) return
      setReadSet(s => new Set([...s, art.id]))
      fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mark_read', user_id: getUserId(), article_id: art.id }) })
    }, 10000)
  }

  const closeArticle = () => {
    if (markRef.current) clearTimeout(markRef.current)
    window.speechSynthesis?.cancel(); setTtsOn(false)
    setOpenArt(null); setTextSel(null)
  }

  /* ── TTS ── */
  const toggleTts = () => {
    if (!openArt) return
    if (ttsOn) { window.speechSynthesis?.cancel(); setTtsOn(false) }
    else {
      const u = new SpeechSynthesisUtterance(`${openArt.title}. ${openArt.content}`)
      u.rate = 0.88; u.onend = () => setTtsOn(false)
      window.speechSynthesis?.speak(u); setTtsOn(true)
    }
  }

  /* ── Text selection ── */
  const onTextUp = () => {
    const sel = window.getSelection()
    if (sel && sel.toString().trim().length > 8) setTextSel(sel.toString().trim())
    else setTextSel(null)
  }

  /* ── Save annotation ── */
  const saveAnnot = async (color: string) => {
    if (!textSel || !openArt) return
    const uid = getUserId()
    const res = await fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'save_annotation', user_id: uid, article_id: openArt.id,
        article_title: openArt.title, text: textSel, note: noteText, color }) })
    const { annotation } = await res.json()
    if (annotation) setAnnots(s => [annotation, ...s])
    setTextSel(null); setNoteText(''); showToast('✦ Saved to notebook')
  }

  /* ── Delete annotation ── */
  const deleteAnnot = async (id: string) => {
    setAnnots(s => s.filter(a => a.id !== id))
    await fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'delete_annotation', id, user_id: getUserId() }) })
    showToast('Removed from notebook')
  }

  /* ── AI Insight ── */
  const fetchInsight = async () => {
    if (!openArt) return
    setInsightLoading(true)
    try {
      const res = await fetch('/api/articles/insight', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: openArt.title, category: openArt.category, content: openArt.content }) })
      setInsight(await res.json())
    } catch { setInsight({ coreInsight: 'Could not load. Please try again.', rabbitHole: { topic: '', why: '' }, question: '', connectedTo: '' }) }
    setInsightLoading(false)
  }

  /* ── Derived ── */
  const today = new Date().toISOString().split('T')[0]
  const todayRead = [...readSet].filter(id => articles.find(a => a.id === id && a.date === today)).length
  const goalPct = Math.min(100, Math.round(todayRead / goal * 100))

  const filtered = (view === 'archive' ? archiveArts : articles).filter(a => {
    const c = selCat === 'All' || a.category === selCat
    const s = !searchQ || a.title.toLowerCase().includes(searchQ.toLowerCase()) || a.category.toLowerCase().includes(searchQ.toLowerCase())
    return c && s
  })
  const grouped = grp(filtered, a => fmt(a.date))

  /* ═══════════════ JSX ═══════════════ */

  /* ── Article Card ── */
  const Card = ({ art, idx }: { art: Article; idx: number }) => {
    const isRead = readSet.has(art.id)
    const cc = CATEGORY_COLORS[art.category] || '#555'
    return (
      <div className="card fi" style={{ animationDelay: `${idx * 0.04}s` }} onClick={() => openArticle(art)}>
        {isRead && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--rule)' }} />}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: cc, opacity: isRead ? 0.3 : 0.8, lineHeight: 1, flexShrink: 0, minWidth: 30, textAlign: 'center', marginTop: 3 }}>{art.sym || '◈'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
              <span className="pill" style={{ color: cc, borderColor: cc + '40', background: cc + '0E' }}>{art.category}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)' }}>~{art.read_time} min</span>
              {isRead && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)', fontStyle: 'italic' }}>read</span>}
            </div>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: isRead ? 'var(--ink-m)' : 'var(--ink)', marginBottom: 7 }}>{art.title}</h3>
            <p style={{ fontFamily: 'var(--body)', fontSize: 14, color: 'var(--ink-m)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{art.excerpt}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)' }}>{art.source}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-f)' }}>{fmt(art.date)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Reader ── */
  const Reader = () => {
    if (!openArt) return null
    const cc = CATEGORY_COLORS[openArt.category] || '#555'
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--paper)', zIndex: 1000, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--rule)', flexShrink: 0 }}>
          <div style={{ height: '100%', background: readPct >= 100 ? 'var(--green)' : 'var(--gold)', width: `${readPct}%`, transition: 'width 0.12s' }} />
        </div>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0, background: 'var(--paper)' }}>
          <button onClick={closeArticle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-m)', padding: '4px 8px', borderRadius: 5 }}>← Back</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setRfs(s => Math.max(14, s - 2))} style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-m)' }}>A−</button>
          <button onClick={() => setRfs(s => Math.min(24, s + 2))} style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-m)' }}>A+</button>
          <button onClick={toggleTts} style={{ background: ttsOn ? 'var(--ink)' : 'none', border: '1px solid var(--rule)', borderRadius: 5, padding: '5px 9px', cursor: 'pointer', fontSize: 12, color: ttsOn ? 'var(--paper)' : 'var(--ink-m)', transition: 'all 0.12s' }}>
            {ttsOn ? '⏸ Pause' : '▶ Listen'}
          </button>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)' }}>{readPct}%</span>
        </div>
        {/* Scrollable content */}
        <div ref={readerRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }} onMouseUp={onTextUp} onTouchEnd={onTextUp}>
          <div style={{ padding: '30px 24px 60px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <span className="pill" style={{ color: cc, borderColor: cc + '40', background: cc + '0E' }}>{openArt.category}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)' }}>{openArt.source} · {fmt(openArt.date)}</span>
            </div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, lineHeight: 1.28, color: 'var(--ink)', marginBottom: 20 }}>{openArt.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
              <div style={{ height: 1, flex: 1, background: 'var(--rule)' }} />
              <span style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--gold)', fontStyle: 'italic' }}>~{openArt.read_time} min</span>
              <div style={{ height: 1, flex: 1, background: 'var(--rule)' }} />
            </div>
            {/* Drop-cap body */}
            <div className="rbody" style={{ fontSize: rfs }}>
              {openArt.content.split('\n\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '26px 0' }}>
              {(openArt.tags || []).map(t => <span key={t} style={{ background: 'var(--paper-w)', color: 'var(--ink-m)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--sans)' }}>#{t}</span>)}
            </div>
            {/* References */}
            {openArt.references?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 18 }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-f)', marginBottom: 10 }}>References</div>
                {openArt.references.map((r, i) => <div key={i} style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--ink-m)', marginBottom: 6, lineHeight: 1.5 }}>{r}</div>)}
              </div>
            )}
            <div style={{ marginTop: 18 }}>
              <a href={openArt.source_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--gold)', textDecoration: 'none' }}>Read at {openArt.source} →</a>
            </div>
            {/* AI Insight */}
            <div style={{ marginTop: 30, background: 'var(--paper-w)', borderRadius: 12, border: '1px solid var(--rule)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)' }}>✦ Intellectual Companion</div>
                {!insight && !insightLoading && <button onClick={fetchInsight} className="btn" style={{ fontSize: 11, padding: '6px 14px' }}>Deepen this</button>}
              </div>
              {insightLoading && <div className="pu" style={{ textAlign: 'center', padding: '16px 0', fontFamily: 'var(--body)', fontSize: 14, color: 'var(--ink-m)', fontStyle: 'italic' }}>Thinking deeply…</div>}
              {insight && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="fi">
                  <div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-f)', marginBottom: 4 }}>Core Insight</div>
                    <p style={{ fontFamily: 'var(--body)', fontSize: 15, lineHeight: 1.75, color: 'var(--ink)' }}>{insight.coreInsight}</p>
                  </div>
                  {insight.rabbitHole?.topic && (
                    <div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-f)', marginBottom: 4 }}>Rabbit Hole</div>
                      <p style={{ fontFamily: 'var(--body)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }}><strong style={{ fontFamily: 'var(--serif)' }}>{insight.rabbitHole.topic}</strong> — {insight.rabbitHole.why}</p>
                    </div>
                  )}
                  {insight.question && (
                    <div style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 14 }}>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-f)', marginBottom: 4 }}>Question to Sit With</div>
                      <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.75, color: 'var(--ink)', fontStyle: 'italic' }}>{insight.question}</p>
                    </div>
                  )}
                  {insight.connectedTo && (
                    <div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-f)', marginBottom: 4 }}>Read Next</div>
                      <p style={{ fontFamily: 'var(--body)', fontSize: 14, color: 'var(--ink-m)' }}>{insight.connectedTo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Annotation bar */}
        {textSel && (
          <div style={{ flexShrink: 0, borderTop: '2px solid var(--rule)', background: 'var(--paper)', padding: '12px 18px' }} className="su">
            <p style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--ink-s)', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>"{textSel.slice(0, 100)}{textSel.length > 100 ? '…' : ''}"</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)' }}>Colour:</span>
              {HIGHLIGHT_COLORS.map((c, i) => (
                <button key={c} onClick={() => setHiIdx(i)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: hiIdx === i ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} title={HIGHLIGHT_NAMES[i]} />
              ))}
              <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note… (optional)" style={{ flex: 1, minWidth: 70, border: '1px solid var(--rule)', borderRadius: 6, padding: '5px 9px', fontFamily: 'var(--body)', fontSize: 13, color: 'var(--ink)', background: 'var(--paper-w)', outline: 'none' }} />
              <button onClick={() => saveAnnot(HIGHLIGHT_COLORS[hiIdx])} className="btn" style={{ fontSize: 12, padding: '6px 12px' }}>Save</button>
              <button onClick={() => setTextSel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-f)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── Main render ── */
  return (
    <div style={{ fontFamily: 'var(--sans)', background: 'var(--paper)', minHeight: '100vh', color: 'var(--ink)', maxWidth: 480, margin: '0 auto', position: 'relative' }}>

      {/* Toast */}
      {toastMsg && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--paper)', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--sans)', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 18px rgba(0,0,0,0.22)' }} className="su">{toastMsg}</div>}

      {/* Reader overlay */}
      {openArt && <Reader />}

      {/* ── Header ── */}
      <div style={{ background: 'var(--paper)', borderBottom: '1px solid var(--rule)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '2.5px solid var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>Curiosa</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-m)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-m)', marginBottom: 4 }}>
                <span style={{ color: 'var(--red)', fontWeight: 500 }}>🔥 {streak}</span>
                <span style={{ color: 'var(--ink-f)' }}> day streak</span>
              </div>
              <div style={{ height: 4, width: 90, background: 'var(--rule)', borderRadius: 2, marginLeft: 'auto', marginBottom: 3 }}>
                <div style={{ height: '100%', background: goalPct >= 100 ? 'var(--green)' : 'var(--gold)', width: `${goalPct}%`, borderRadius: 2, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-f)' }}>{todayRead}/{goal} articles today</div>
            </div>
          </div>
          {searchOpen
            ? <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search articles…" style={{ width: '100%', border: '1px solid var(--rule)', borderRadius: 7, padding: '8px 12px', fontFamily: 'var(--body)', fontSize: 14, color: 'var(--ink)', background: 'var(--paper-w)', outline: 'none' }} onBlur={() => { if (!searchQ) setSearchOpen(false) }} />
            : <button onClick={() => setSearchOpen(true)} style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 7, padding: '7px 12px', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-m)' }}>🔍 Search articles</button>
          }
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
          {([['feed', 'Today'], ['archive', 'Archive'], ['notebook', `Notebook${annots.length ? ` (${annots.length})` : ''}`]] as const).map(([v, l]) => (
            <button key={v} className="ntab" onClick={() => setView(v as any)} style={{ color: view === v ? 'var(--ink)' : 'var(--ink-f)', borderBottomColor: view === v ? 'var(--ink)' : 'transparent', fontWeight: view === v ? 500 : 300 }}>{l}</button>
          ))}
        </div>

        {/* Category pills */}
        {view !== 'notebook' && (
          <div style={{ overflowX: 'auto', display: 'flex', gap: 6, padding: '10px 16px', scrollbarWidth: 'none' }}>
            {(['All', ...ALL_CATEGORIES] as const).map(c => {
              const a = selCat === c
              const cc = CATEGORY_COLORS[c as Category] || 'var(--ink)'
              return (
                <button key={c} className="pill" onClick={() => setSelCat(c as any)}
                  style={{ color: a ? c === 'All' ? 'var(--paper)' : cc : 'var(--ink-m)', borderColor: a ? c === 'All' ? 'var(--ink)' : cc + '55' : 'var(--rule)', background: a ? c === 'All' ? 'var(--ink)' : cc + '18' : 'transparent' }}>
                  {c}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Feed / Archive ── */}
      {(view === 'feed' || view === 'archive') && (
        <div style={{ paddingBottom: 60 }}>
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-m)', fontFamily: 'var(--body)', fontStyle: 'italic' }} className="pu">Loading…</div>
          )}
          {!loadingMore && Object.entries(grouped).length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--ink-m)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 36, opacity: 0.25, marginBottom: 14 }}>◈</div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 16, fontStyle: 'italic', marginBottom: 8 }}>
                {view === 'feed' ? "Today's articles are being curated…" : 'No archived articles found.'}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-f)' }}>Check back at 6 AM UTC daily.</div>
            </div>
          )}
          {Object.entries(grouped).map(([label, garticles]) => (
            <div key={label}>
              <div style={{ padding: '14px 22px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--ink-f)' }}>{label}</div>
                <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-f)' }}>{garticles.length}</div>
              </div>
              {garticles.map((a, i) => <Card key={a.id} art={a} idx={i} />)}
            </div>
          ))}
        </div>
      )}

      {/* ── Notebook ── */}
      {view === 'notebook' && (
        <div style={{ paddingBottom: 60 }}>
          {annots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--ink-m)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 36, opacity: 0.25, marginBottom: 14 }}>📓</div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 16, fontStyle: 'italic', marginBottom: 8 }}>Your notebook is empty</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-f)', lineHeight: 1.6 }}>Select any text while reading<br />to highlight and save it here.</div>
            </div>
          ) : (
            <div>
              <div style={{ padding: '16px 22px 4px', fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-f)' }}>
                {annots.length} saved {annots.length === 1 ? 'passage' : 'passages'}
              </div>
              {annots.map(ann => (
                <div key={ann.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--rule)' }} className="fi">
                  <div style={{ borderLeft: `3px solid ${ann.color}`, paddingLeft: 14, background: ann.color + '22', borderRadius: '0 8px 8px 0', padding: '12px 14px' }}>
                    <p style={{ fontFamily: 'var(--body)', fontSize: 15, lineHeight: 1.8, color: 'var(--ink)', fontStyle: 'italic', marginBottom: ann.note ? 8 : 4 }}>"{ann.text}"</p>
                    {ann.note && <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-s)', marginBottom: 8 }}>↳ {ann.note}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-f)' }}>from <em style={{ fontFamily: 'var(--body)' }}>{ann.article_title}</em></span>
                      <button onClick={() => deleteAnnot(ann.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-f)', padding: '2px 6px' }}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
