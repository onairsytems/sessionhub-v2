-- Additional schema for Pattern Recognition Service
-- This extends the base Supabase schema with tables needed for advanced pattern recognition

-- Code patterns table for storing detailed pattern information
CREATE TABLE IF NOT EXISTS code_patterns (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('success', 'error', 'workflow', 'optimization')),
    pattern TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    examples JSONB DEFAULT '[]',
    solutions JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    score DECIMAL(10,2) DEFAULT 0.00,
    project_types JSONB DEFAULT '["all"]',
    language VARCHAR(50),
    framework VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_frequency CHECK (frequency >= 0),
    CONSTRAINT valid_success_rate CHECK (success_rate >= 0 AND success_rate <= 1),
    CONSTRAINT valid_score CHECK (score >= 0)
);

-- Workflow patterns table
CREATE TABLE IF NOT EXISTS workflow_patterns (
    id VARCHAR(255) PRIMARY KEY,
    steps JSONB NOT NULL DEFAULT '[]',
    average_duration DECIMAL(10,2) DEFAULT 0.00,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    optimization_potential DECIMAL(5,2) DEFAULT 0.00,
    bottlenecks JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_avg_duration CHECK (average_duration >= 0),
    CONSTRAINT valid_success_rate CHECK (success_rate >= 0 AND success_rate <= 1),
    CONSTRAINT valid_optimization CHECK (optimization_potential >= 0 AND optimization_potential <= 1)
);

-- Pattern usage history for tracking pattern effectiveness
CREATE TABLE IF NOT EXISTS pattern_usage_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pattern_id VARCHAR(255) NOT NULL REFERENCES code_patterns(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    outcome VARCHAR(20) CHECK (outcome IN ('success', 'failure', 'partial')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    time_saved_seconds INTEGER,
    errors_prevented INTEGER,
    metadata JSONB DEFAULT '{}'
);

-- Pattern relationships for tracking pattern combinations
CREATE TABLE IF NOT EXISTS pattern_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pattern_a_id VARCHAR(255) NOT NULL REFERENCES code_patterns(id) ON DELETE CASCADE,
    pattern_b_id VARCHAR(255) NOT NULL REFERENCES code_patterns(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) CHECK (relationship_type IN ('complements', 'conflicts', 'requires', 'enhances')),
    strength DECIMAL(5,2) DEFAULT 0.50,
    co_occurrence_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_patterns CHECK (pattern_a_id != pattern_b_id),
    CONSTRAINT valid_strength CHECK (strength >= 0 AND strength <= 1),
    CONSTRAINT unique_relationship UNIQUE (pattern_a_id, pattern_b_id, relationship_type)
);

-- Create indexes for pattern tables
CREATE INDEX idx_code_patterns_type ON code_patterns(type);
CREATE INDEX idx_code_patterns_score ON code_patterns(score DESC);
CREATE INDEX idx_code_patterns_success_rate ON code_patterns(success_rate DESC);
CREATE INDEX idx_code_patterns_frequency ON code_patterns(frequency DESC);
CREATE INDEX idx_code_patterns_last_seen ON code_patterns(last_seen DESC);
CREATE INDEX idx_code_patterns_language ON code_patterns(language);
CREATE INDEX idx_code_patterns_framework ON code_patterns(framework);

CREATE INDEX idx_workflow_patterns_success_rate ON workflow_patterns(success_rate DESC);
CREATE INDEX idx_workflow_patterns_optimization ON workflow_patterns(optimization_potential DESC);

CREATE INDEX idx_pattern_usage_session ON pattern_usage_history(session_id);
CREATE INDEX idx_pattern_usage_project ON pattern_usage_history(project_id);
CREATE INDEX idx_pattern_usage_pattern ON pattern_usage_history(pattern_id);
CREATE INDEX idx_pattern_usage_applied ON pattern_usage_history(applied_at DESC);

CREATE INDEX idx_pattern_relationships_a ON pattern_relationships(pattern_a_id);
CREATE INDEX idx_pattern_relationships_b ON pattern_relationships(pattern_b_id);
CREATE INDEX idx_pattern_relationships_type ON pattern_relationships(relationship_type);

-- Enable RLS on new tables
ALTER TABLE code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for code_patterns (public read, authenticated write)
CREATE POLICY "Anyone can view code patterns" ON code_patterns
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create code patterns" ON code_patterns
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update code patterns" ON code_patterns
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for workflow_patterns
CREATE POLICY "Anyone can view workflow patterns" ON workflow_patterns
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage workflow patterns" ON workflow_patterns
    FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for pattern_usage_history
CREATE POLICY "Users can view their own pattern usage" ON pattern_usage_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = pattern_usage_history.session_id 
            AND sessions.user_id = auth.uid()
        )
        OR auth.uid() IS NOT NULL  -- Authenticated users can see aggregate data
    );

CREATE POLICY "Users can create pattern usage records" ON pattern_usage_history
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for pattern_relationships
CREATE POLICY "Anyone can view pattern relationships" ON pattern_relationships
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage pattern relationships" ON pattern_relationships
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Create update triggers for updated_at
CREATE TRIGGER update_code_patterns_updated_at BEFORE UPDATE ON code_patterns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_patterns_updated_at BEFORE UPDATE ON workflow_patterns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for pattern analytics
CREATE OR REPLACE VIEW pattern_effectiveness AS
SELECT 
    cp.id,
    cp.type,
    cp.description,
    cp.success_rate as pattern_success_rate,
    COUNT(DISTINCT puh.id) as usage_count,
    COUNT(DISTINCT CASE WHEN puh.outcome = 'success' THEN puh.id END) as successful_uses,
    AVG(puh.time_saved_seconds) as avg_time_saved,
    SUM(puh.errors_prevented) as total_errors_prevented,
    cp.score
FROM code_patterns cp
LEFT JOIN pattern_usage_history puh ON puh.pattern_id = cp.id
GROUP BY cp.id, cp.type, cp.description, cp.success_rate, cp.score;

CREATE OR REPLACE VIEW top_patterns_by_project_type AS
SELECT 
    cp.id,
    cp.description,
    cp.type,
    cp.success_rate,
    cp.score,
    jsonb_array_elements_text(cp.project_types) as project_type,
    cp.language,
    cp.framework
FROM code_patterns cp
WHERE cp.score > 50
ORDER BY cp.score DESC, cp.success_rate DESC;

-- Function to decay pattern scores over time
CREATE OR REPLACE FUNCTION decay_pattern_scores(decay_rate DECIMAL DEFAULT 0.95)
RETURNS VOID AS $$
BEGIN
    UPDATE code_patterns
    SET score = score * decay_rate
    WHERE last_seen < NOW() - INTERVAL '30 days'
    AND score > 10;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate pattern co-occurrence
CREATE OR REPLACE FUNCTION update_pattern_relationship(
    p_pattern_a VARCHAR(255),
    p_pattern_b VARCHAR(255),
    p_relationship_type VARCHAR(50),
    p_strength_delta DECIMAL DEFAULT 0.1
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO pattern_relationships (
        pattern_a_id, 
        pattern_b_id, 
        relationship_type, 
        strength,
        co_occurrence_count
    )
    VALUES (
        p_pattern_a, 
        p_pattern_b, 
        p_relationship_type, 
        p_strength_delta,
        1
    )
    ON CONFLICT (pattern_a_id, pattern_b_id, relationship_type) 
    DO UPDATE SET
        strength = LEAST(1.0, pattern_relationships.strength + p_strength_delta),
        co_occurrence_count = pattern_relationships.co_occurrence_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;