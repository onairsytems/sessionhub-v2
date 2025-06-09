-- Project Context Management Schema
-- Session 1.16: Enhanced Project Context Management

-- Create project_contexts table
CREATE TABLE IF NOT EXISTS project_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  context_data JSONB NOT NULL,
  embeddings REAL[] DEFAULT NULL,
  summary TEXT NOT NULL,
  version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_project_contexts_project_id ON project_contexts(project_id);
CREATE INDEX idx_project_contexts_embeddings ON project_contexts USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX idx_project_contexts_type ON project_contexts((context_data->>'projectType'));
CREATE INDEX idx_project_contexts_language ON project_contexts((context_data->>'language'));
CREATE INDEX idx_project_contexts_updated ON project_contexts(updated_at DESC);

-- Create context_versions table for tracking changes
CREATE TABLE IF NOT EXISTS context_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  version VARCHAR(20) NOT NULL,
  changes JSONB NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (project_id) REFERENCES project_contexts(project_id) ON DELETE CASCADE
);

-- Create indexes for version tracking
CREATE INDEX idx_context_versions_project_id ON context_versions(project_id);
CREATE INDEX idx_context_versions_created ON context_versions(created_at DESC);

-- Create context_similarities table for caching similar project relationships
CREATE TABLE IF NOT EXISTS context_similarities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_project_id TEXT NOT NULL,
  target_project_id TEXT NOT NULL,
  similarity_score REAL NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  similarity_type VARCHAR(50) NOT NULL, -- 'embedding', 'type', 'framework', 'pattern'
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (source_project_id) REFERENCES project_contexts(project_id) ON DELETE CASCADE,
  FOREIGN KEY (target_project_id) REFERENCES project_contexts(project_id) ON DELETE CASCADE,
  UNIQUE(source_project_id, target_project_id, similarity_type)
);

-- Create indexes for similarity queries
CREATE INDEX idx_context_similarities_source ON context_similarities(source_project_id);
CREATE INDEX idx_context_similarities_target ON context_similarities(target_project_id);
CREATE INDEX idx_context_similarities_score ON context_similarities(similarity_score DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for project_contexts
CREATE TRIGGER update_project_contexts_updated_at BEFORE UPDATE
  ON project_contexts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate context similarity
CREATE OR REPLACE FUNCTION calculate_context_similarity(
  context1 JSONB,
  context2 JSONB
) RETURNS REAL AS $$
DECLARE
  similarity REAL := 0;
  weight_type REAL := 0.3;
  weight_language REAL := 0.2;
  weight_frameworks REAL := 0.3;
  weight_patterns REAL := 0.2;
BEGIN
  -- Compare project types
  IF context1->>'projectType' = context2->>'projectType' THEN
    similarity := similarity + weight_type;
  END IF;
  
  -- Compare languages
  IF context1->>'language' = context2->>'language' THEN
    similarity := similarity + weight_language;
  END IF;
  
  -- Compare frameworks (simplified - would need more complex logic)
  IF context1->'frameworks' IS NOT NULL AND context2->'frameworks' IS NOT NULL THEN
    -- Check if any frameworks match
    IF jsonb_array_length(context1->'frameworks') > 0 AND 
       jsonb_array_length(context2->'frameworks') > 0 THEN
      similarity := similarity + weight_frameworks * 0.5; -- Partial credit
    END IF;
  END IF;
  
  -- Compare architecture patterns
  IF context1->'architecturePatterns' IS NOT NULL AND context2->'architecturePatterns' IS NOT NULL THEN
    IF jsonb_array_length(context1->'architecturePatterns') > 0 AND 
       jsonb_array_length(context2->'architecturePatterns') > 0 THEN
      similarity := similarity + weight_patterns * 0.5; -- Partial credit
    END IF;
  END IF;
  
  RETURN similarity;
END;
$$ LANGUAGE plpgsql;

-- Create view for context analysis
CREATE OR REPLACE VIEW project_context_analytics AS
SELECT 
  pc.project_id,
  pc.context_data->>'projectType' as project_type,
  pc.context_data->>'language' as language,
  jsonb_array_length(COALESCE(pc.context_data->'frameworks', '[]'::jsonb)) as framework_count,
  jsonb_array_length(COALESCE(pc.context_data->'libraries', '[]'::jsonb)) as library_count,
  jsonb_array_length(COALESCE(pc.context_data->'architecturePatterns', '[]'::jsonb)) as pattern_count,
  pc.context_data->'metrics'->>'testCoverage' as test_coverage,
  pc.context_data->'metrics'->>'codeComplexity' as code_complexity,
  pc.summary,
  pc.version,
  pc.updated_at
FROM project_contexts pc;

-- Create materialized view for fast pattern queries
CREATE MATERIALIZED VIEW project_patterns_mv AS
SELECT 
  pc.project_id,
  pattern->>'pattern' as pattern_name,
  (pattern->>'confidence')::REAL as confidence,
  pc.context_data->>'projectType' as project_type,
  pc.context_data->>'language' as language
FROM 
  project_contexts pc,
  jsonb_array_elements(pc.context_data->'architecturePatterns') as pattern
WHERE pattern->>'confidence' IS NOT NULL;

-- Create index on materialized view
CREATE INDEX idx_project_patterns_mv_pattern ON project_patterns_mv(pattern_name);
CREATE INDEX idx_project_patterns_mv_confidence ON project_patterns_mv(confidence DESC);

-- Row Level Security policies
ALTER TABLE project_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_similarities ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth setup)
CREATE POLICY "Users can view all project contexts"
  ON project_contexts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert project contexts"
  ON project_contexts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update project contexts"
  ON project_contexts FOR UPDATE
  TO authenticated
  USING (true);

-- Grant permissions
GRANT ALL ON project_contexts TO authenticated;
GRANT ALL ON context_versions TO authenticated;
GRANT ALL ON context_similarities TO authenticated;
GRANT SELECT ON project_context_analytics TO authenticated;
GRANT SELECT ON project_patterns_mv TO authenticated;