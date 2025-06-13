-- Migration: Add project archive and advanced management features
-- Version: 2.26C
-- Description: Adds archive functionality, project settings, and export/import support

-- Add archive fields to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archive_reason TEXT,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS export_metadata JSONB DEFAULT '{}';

-- Create project_exports table for storing export history
CREATE TABLE IF NOT EXISTS project_exports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    export_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    export_format VARCHAR(50) NOT NULL DEFAULT 'json',
    file_size BIGINT,
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_export_format CHECK (export_format IN ('json', 'zip', 'tar.gz'))
);

-- Create project_imports table for tracking imported projects
CREATE TABLE IF NOT EXISTS project_imports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    original_project_id UUID,
    new_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    import_source VARCHAR(255),
    import_format VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_import_format CHECK (import_format IN ('json', 'zip', 'tar.gz'))
);

-- Create project_settings table for project-specific configurations
CREATE TABLE IF NOT EXISTS project_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_project_setting UNIQUE (project_id, setting_key)
);

-- Create project_duplicates table to track duplicated projects
CREATE TABLE IF NOT EXISTS project_duplicates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    duplicate_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    duplicated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    include_sessions BOOLEAN DEFAULT FALSE,
    include_settings BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'
);

-- Add indexes for archive functionality
CREATE INDEX idx_projects_archived_at ON projects(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX idx_projects_status_archived ON projects(metadata->>'status', archived_at);

-- Add indexes for exports and imports
CREATE INDEX idx_project_exports_project_id ON project_exports(project_id);
CREATE INDEX idx_project_exports_date ON project_exports(export_date DESC);
CREATE INDEX idx_project_imports_new_project_id ON project_imports(new_project_id);
CREATE INDEX idx_project_imports_date ON project_imports(import_date DESC);

-- Add indexes for settings
CREATE INDEX idx_project_settings_project_id ON project_settings(project_id);
CREATE INDEX idx_project_settings_key ON project_settings(setting_key);

-- Create views for archived projects
CREATE OR REPLACE VIEW archived_projects AS
SELECT 
    p.*,
    pe.export_date as last_export_date,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT ps.id) as total_settings
FROM projects p
LEFT JOIN project_exports pe ON pe.project_id = p.id 
    AND pe.export_date = (SELECT MAX(export_date) FROM project_exports WHERE project_id = p.id)
LEFT JOIN sessions s ON s.project_id = p.id
LEFT JOIN project_settings ps ON ps.project_id = p.id
WHERE p.archived_at IS NOT NULL
GROUP BY p.id, pe.export_date;

-- Create view for active projects with enhanced metrics
CREATE OR REPLACE VIEW active_projects_enhanced AS
SELECT 
    p.*,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_sessions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') as completed_sessions,
    COUNT(DISTINCT ps.id) as total_settings,
    MAX(s.created_at) as last_session_date,
    pe.export_date as last_export_date
FROM projects p
LEFT JOIN sessions s ON s.project_id = p.id
LEFT JOIN project_settings ps ON ps.project_id = p.id
LEFT JOIN project_exports pe ON pe.project_id = p.id 
    AND pe.export_date = (SELECT MAX(export_date) FROM project_exports WHERE project_id = p.id)
WHERE p.archived_at IS NULL
GROUP BY p.id, pe.export_date;

-- Function to archive a project
CREATE OR REPLACE FUNCTION archive_project(
    p_project_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE projects 
    SET 
        archived_at = NOW(),
        archive_reason = p_reason,
        metadata = jsonb_set(metadata, '{archived}', 'true')
    WHERE id = p_project_id AND archived_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to restore an archived project
CREATE OR REPLACE FUNCTION restore_project(p_project_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE projects 
    SET 
        archived_at = NULL,
        archive_reason = NULL,
        metadata = jsonb_set(metadata, '{archived}', 'false')
    WHERE id = p_project_id AND archived_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to duplicate a project
CREATE OR REPLACE FUNCTION duplicate_project(
    p_source_project_id UUID,
    p_new_name VARCHAR(255),
    p_include_sessions BOOLEAN DEFAULT FALSE,
    p_include_settings BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
    v_new_project_id UUID;
    v_source_project RECORD;
BEGIN
    -- Get source project details
    SELECT * INTO v_source_project FROM projects WHERE id = p_source_project_id;
    
    -- Create new project
    INSERT INTO projects (name, path, type, metadata)
    VALUES (
        p_new_name,
        v_source_project.path || '-copy-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        v_source_project.type,
        jsonb_set(v_source_project.metadata, '{duplicated_from}', to_jsonb(p_source_project_id::TEXT))
    )
    RETURNING id INTO v_new_project_id;
    
    -- Copy settings if requested
    IF p_include_settings THEN
        INSERT INTO project_settings (project_id, setting_key, setting_value)
        SELECT v_new_project_id, setting_key, setting_value
        FROM project_settings
        WHERE project_id = p_source_project_id;
    END IF;
    
    -- Record duplication
    INSERT INTO project_duplicates (source_project_id, duplicate_project_id, include_sessions, include_settings)
    VALUES (p_source_project_id, v_new_project_id, p_include_sessions, p_include_settings);
    
    RETURN v_new_project_id;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk archive projects
CREATE OR REPLACE FUNCTION bulk_archive_projects(
    p_project_ids UUID[],
    p_reason TEXT DEFAULT 'Bulk archive operation'
) RETURNS INTEGER AS $$
DECLARE
    v_archived_count INTEGER;
BEGIN
    UPDATE projects 
    SET 
        archived_at = NOW(),
        archive_reason = p_reason,
        metadata = jsonb_set(metadata, '{archived}', 'true')
    WHERE id = ANY(p_project_ids) AND archived_at IS NULL;
    
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get project statistics
CREATE OR REPLACE FUNCTION get_project_statistics(p_project_id UUID)
RETURNS TABLE (
    total_sessions BIGINT,
    completed_sessions BIGINT,
    active_sessions BIGINT,
    total_instructions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    avg_session_duration INTERVAL,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') as completed_sessions,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as active_sessions,
        COUNT(DISTINCT i.id) as total_instructions,
        COUNT(DISTINCT er.id) FILTER (WHERE er.status = 'success') as successful_executions,
        COUNT(DISTINCT er.id) FILTER (WHERE er.status = 'failure') as failed_executions,
        AVG(s.total_duration) as avg_session_duration,
        MAX(GREATEST(s.updated_at, i.created_at, er.created_at)) as last_activity
    FROM projects p
    LEFT JOIN sessions s ON s.project_id = p.id
    LEFT JOIN instructions i ON i.session_id = s.id
    LEFT JOIN execution_results er ON er.instruction_id = i.id
    WHERE p.id = p_project_id
    GROUP BY p.id;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for new tables
ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_duplicates ENABLE ROW LEVEL SECURITY;

-- Project exports policies
CREATE POLICY "Users can view exports for their projects" ON project_exports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_exports.project_id
        )
    );

CREATE POLICY "Users can create exports for their projects" ON project_exports
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_exports.project_id
        )
    );

-- Project imports policies
CREATE POLICY "Users can view their imports" ON project_imports
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create imports" ON project_imports
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Project settings policies
CREATE POLICY "Users can view settings for their projects" ON project_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_settings.project_id
        )
    );

CREATE POLICY "Users can manage settings for their projects" ON project_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_settings.project_id
        )
    );

-- Project duplicates policies
CREATE POLICY "Users can view duplicates of their projects" ON project_duplicates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id IN (project_duplicates.source_project_id, project_duplicates.duplicate_project_id)
        )
    );

CREATE POLICY "Users can create duplicates of their projects" ON project_duplicates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_duplicates.source_project_id
        )
    );

-- Grant permissions
GRANT ALL ON project_exports TO authenticated;
GRANT ALL ON project_imports TO authenticated;
GRANT ALL ON project_settings TO authenticated;
GRANT ALL ON project_duplicates TO authenticated;
GRANT EXECUTE ON FUNCTION archive_project TO authenticated;
GRANT EXECUTE ON FUNCTION restore_project TO authenticated;
GRANT EXECUTE ON FUNCTION duplicate_project TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_archive_projects TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_statistics TO authenticated;