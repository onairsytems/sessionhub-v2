-- Supabase Schema for SessionHub
-- This schema defines the database structure for storing SessionHub data
-- including sessions, instructions, execution results, patterns, and projects

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE session_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
CREATE TYPE instruction_type AS ENUM ('code_generation', 'code_review', 'refactoring', 'debugging', 'architecture', 'documentation', 'testing', 'other');
CREATE TYPE execution_status AS ENUM ('pending', 'running', 'success', 'failure', 'cancelled');
CREATE TYPE pattern_type AS ENUM ('command', 'workflow', 'error_resolution', 'code_pattern', 'optimization');
CREATE TYPE project_type AS ENUM ('nextjs', 'react', 'node', 'python', 'java', 'other');

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    type project_type DEFAULT 'other',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT unique_project_path UNIQUE (path),
    CONSTRAINT valid_project_name CHECK (name != '')
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status session_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Additional session fields
    title VARCHAR(255),
    description TEXT,
    total_duration INTERVAL,
    
    -- Constraints
    CONSTRAINT valid_user_id CHECK (user_id IS NOT NULL)
);

-- Instructions table
CREATE TABLE IF NOT EXISTS instructions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type instruction_type NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Additional instruction fields
    sequence_number INTEGER,
    parent_instruction_id UUID REFERENCES instructions(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT valid_content CHECK (content != ''),
    CONSTRAINT unique_sequence_per_session UNIQUE (session_id, sequence_number)
);

-- Execution results table
CREATE TABLE IF NOT EXISTS execution_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instruction_id UUID NOT NULL REFERENCES instructions(id) ON DELETE CASCADE,
    status execution_status NOT NULL DEFAULT 'pending',
    outputs JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',
    duration INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional execution fields
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    resources_used JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_duration CHECK (duration >= INTERVAL '0 seconds' OR duration IS NULL)
);

-- Patterns table
CREATE TABLE IF NOT EXISTS patterns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pattern_type pattern_type NOT NULL,
    description TEXT NOT NULL,
    frequency INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    metadata JSONB DEFAULT '{}',
    
    -- Additional pattern fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT valid_frequency CHECK (frequency >= 0),
    CONSTRAINT valid_success_rate CHECK (success_rate >= 0 AND success_rate <= 100)
);

-- Create indexes for better query performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

CREATE INDEX idx_instructions_session_id ON instructions(session_id);
CREATE INDEX idx_instructions_type ON instructions(type);
CREATE INDEX idx_instructions_created_at ON instructions(created_at DESC);
CREATE INDEX idx_instructions_parent ON instructions(parent_instruction_id);

CREATE INDEX idx_execution_results_instruction_id ON execution_results(instruction_id);
CREATE INDEX idx_execution_results_status ON execution_results(status);
CREATE INDEX idx_execution_results_created_at ON execution_results(created_at DESC);

CREATE INDEX idx_patterns_type ON patterns(pattern_type);
CREATE INDEX idx_patterns_frequency ON patterns(frequency DESC);
CREATE INDEX idx_patterns_success_rate ON patterns(success_rate DESC);
CREATE INDEX idx_patterns_project_id ON patterns(project_id);

CREATE INDEX idx_projects_last_accessed ON projects(last_accessed DESC);
CREATE INDEX idx_projects_type ON projects(type);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON patterns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own projects" ON projects
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Sessions policies
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Instructions policies (inherit from sessions)
CREATE POLICY "Users can view instructions from their sessions" ON instructions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = instructions.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create instructions in their sessions" ON instructions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = instructions.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update instructions in their sessions" ON instructions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = instructions.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete instructions from their sessions" ON instructions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = instructions.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- Execution results policies (inherit from instructions)
CREATE POLICY "Users can view execution results from their instructions" ON execution_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM instructions 
            JOIN sessions ON sessions.id = instructions.session_id
            WHERE instructions.id = execution_results.instruction_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create execution results for their instructions" ON execution_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM instructions 
            JOIN sessions ON sessions.id = instructions.session_id
            WHERE instructions.id = execution_results.instruction_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update execution results for their instructions" ON execution_results
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM instructions 
            JOIN sessions ON sessions.id = instructions.session_id
            WHERE instructions.id = execution_results.instruction_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete execution results from their instructions" ON execution_results
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM instructions 
            JOIN sessions ON sessions.id = instructions.session_id
            WHERE instructions.id = execution_results.instruction_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- Patterns policies (public read, authenticated write)
CREATE POLICY "Anyone can view patterns" ON patterns
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create patterns" ON patterns
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update patterns" ON patterns
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete patterns" ON patterns
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create views for common queries
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.*,
    p.name as project_name,
    p.path as project_path,
    p.type as project_type,
    COUNT(DISTINCT i.id) as instruction_count,
    MAX(i.created_at) as last_instruction_at
FROM sessions s
JOIN projects p ON p.id = s.project_id
LEFT JOIN instructions i ON i.session_id = s.id
WHERE s.status = 'active'
GROUP BY s.id, p.id, p.name, p.path, p.type;

CREATE OR REPLACE VIEW session_statistics AS
SELECT 
    s.id as session_id,
    s.user_id,
    s.project_id,
    COUNT(DISTINCT i.id) as total_instructions,
    COUNT(DISTINCT er.id) as total_executions,
    COUNT(DISTINCT CASE WHEN er.status = 'success' THEN er.id END) as successful_executions,
    COUNT(DISTINCT CASE WHEN er.status = 'failure' THEN er.id END) as failed_executions,
    AVG(EXTRACT(EPOCH FROM er.duration)) as avg_execution_duration_seconds,
    SUM(EXTRACT(EPOCH FROM er.duration)) as total_execution_duration_seconds
FROM sessions s
LEFT JOIN instructions i ON i.session_id = s.id
LEFT JOIN execution_results er ON er.instruction_id = i.id
GROUP BY s.id, s.user_id, s.project_id;

-- Create function to update project last_accessed
CREATE OR REPLACE FUNCTION update_project_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects 
    SET last_accessed = NOW() 
    WHERE id = NEW.project_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_access_on_session_create
AFTER INSERT ON sessions
FOR EACH ROW EXECUTE FUNCTION update_project_last_accessed();

-- Create function to calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration(session_id UUID)
RETURNS INTERVAL AS $$
DECLARE
    duration INTERVAL;
BEGIN
    SELECT MAX(er.created_at) - MIN(i.created_at)
    INTO duration
    FROM instructions i
    LEFT JOIN execution_results er ON er.instruction_id = i.id
    WHERE i.session_id = calculate_session_duration.session_id;
    
    RETURN COALESCE(duration, INTERVAL '0 seconds');
END;
$$ LANGUAGE plpgsql;

-- Create function to update pattern statistics
CREATE OR REPLACE FUNCTION update_pattern_statistics(pattern_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE patterns
    SET 
        frequency = frequency + 1,
        last_used_at = NOW()
    WHERE id = pattern_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;