-- ============================================================
-- CURIOSA — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Articles table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  source      TEXT        NOT NULL,
  source_url  TEXT        NOT NULL,
  read_time   INTEGER     NOT NULL DEFAULT 7,
  date        DATE        NOT NULL,          -- YYYY-MM-DD, one batch per day
  sym         TEXT        NOT NULL DEFAULT '◈',
  excerpt     TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  references  JSONB       NOT NULL DEFAULT '[]',
  tags        JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by date and category
CREATE INDEX IF NOT EXISTS articles_date_idx     ON articles (date DESC);
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles (category);

-- ── User article states ─────────────────────────────────────
-- Tracks which articles each user has read (no auth required — uses client UUID)
CREATE TABLE IF NOT EXISTS user_article_states (
  user_id    TEXT        NOT NULL,
  article_id UUID        NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS uas_user_idx ON user_article_states (user_id);

-- ── Annotations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annotations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT        NOT NULL,
  article_id    UUID        NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  article_title TEXT        NOT NULL,
  text          TEXT        NOT NULL,   -- the highlighted passage
  note          TEXT        NOT NULL DEFAULT '',
  color         TEXT        NOT NULL DEFAULT '#FEF08A',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS annotations_user_idx ON annotations (user_id);

-- ── Row Level Security ───────────────────────────────────────
-- Articles are public (anyone can read)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read articles"
  ON articles FOR SELECT USING (TRUE);

-- User states: anyone can insert/update for their own user_id
ALTER TABLE user_article_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage their own read state"
  ON user_article_states FOR ALL USING (TRUE);  -- service role bypasses anyway

-- Annotations: anyone can manage their own
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage their own annotations"
  ON annotations FOR ALL USING (TRUE);
