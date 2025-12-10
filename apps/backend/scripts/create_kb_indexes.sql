-- KB Full-Text Search Index
-- Run: type apps\backend\scripts\create_kb_indexes.sql | docker exec -i idesk-postgres psql -U postgres -d idesk_db

CREATE INDEX IF NOT EXISTS idx_articles_search_vector 
ON articles USING GIN (
    to_tsvector('indonesian', COALESCE(title, '') || ' ' || COALESCE(content, ''))
);

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);

-- Verify
SELECT indexname FROM pg_indexes WHERE tablename = 'articles' AND indexname LIKE 'idx_%';
