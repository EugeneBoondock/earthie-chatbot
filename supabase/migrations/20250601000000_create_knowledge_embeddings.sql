-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store document sections and their embeddings
CREATE TABLE knowledge (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL
);

-- Create a function to search for relevant document sections
CREATE OR REPLACE FUNCTION match_knowledge (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  source_file TEXT,
  content TEXT,
  similarity FLOAT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge.id,
    knowledge.source_file,
    knowledge.content,
    1 - (knowledge.embedding <=> query_embedding) AS similarity
  FROM knowledge
  WHERE 1 - (knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$
LANGUAGE plpgsql; 