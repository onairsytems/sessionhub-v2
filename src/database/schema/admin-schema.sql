-- Admin Mode Architecture Schema
-- Session 1.13: Admin authentication and role-based access control

-- Create user role enum
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

-- Create user profiles table to extend Supabase auth
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES user_profiles(id) NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT, -- 'user', 'project', 'session', 'system', etc.
    target_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_admin_audit_admin_id (admin_id),
    INDEX idx_admin_audit_created_at (created_at),
    INDEX idx_admin_audit_action (action)
);

-- Create system health metrics table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    metric_type TEXT NOT NULL, -- 'cpu', 'memory', 'disk', 'api_response_time', etc.
    value NUMERIC NOT NULL,
    unit TEXT,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_system_health_type (metric_type),
    INDEX idx_system_health_recorded_at (recorded_at)
);

-- Create admin sessions table for tracking admin-specific sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES user_profiles(id) NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    INDEX idx_admin_sessions_admin_id (admin_id),
    INDEX idx_admin_sessions_token (session_token),
    INDEX idx_admin_sessions_expires_at (expires_at)
);

-- Create emergency access logs
CREATE TABLE IF NOT EXISTS emergency_access_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES user_profiles(id) NOT NULL,
    action TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    reason TEXT NOT NULL,
    affected_resources JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_access_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Only super admins can update user roles" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'super_admin'
        )
    );

-- Admin Audit Logs Policies
CREATE POLICY "Only admins can view audit logs" ON admin_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "System can insert audit logs" ON admin_audit_logs
    FOR INSERT WITH CHECK (true);

-- System Health Metrics Policies
CREATE POLICY "Admins can view system metrics" ON system_health_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "System can insert metrics" ON system_health_metrics
    FOR INSERT WITH CHECK (true);

-- Admin Sessions Policies
CREATE POLICY "Admins can view their own sessions" ON admin_sessions
    FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "Super admins can view all sessions" ON admin_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'super_admin'
        )
    );

-- Emergency Access Logs Policies
CREATE POLICY "Only super admins can view emergency logs" ON emergency_access_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'super_admin'
        )
    );

-- Update existing tables with admin access policies
-- Projects table
CREATE POLICY "Admins can view all projects" ON projects
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role IN ('admin', 'super_admin')
        )
    );

-- Sessions table
CREATE POLICY "Admins can view all sessions" ON sessions
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role IN ('admin', 'super_admin')
        )
    );

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, role)
    VALUES (new.id, new.email, 'user')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action TEXT,
    p_target_type TEXT DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_role user_role;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    SELECT role INTO v_role
    FROM user_profiles
    WHERE id = v_user_id;
    
    RETURN v_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_role user_role;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    SELECT role INTO v_role
    FROM user_profiles
    WHERE id = v_user_id;
    
    RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;