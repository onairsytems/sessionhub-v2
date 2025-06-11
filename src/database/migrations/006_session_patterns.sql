-- Migration: Add session patterns table for pattern learning system
-- Version: 006
-- Description: Creates tables for storing learned session patterns and optimization insights

-- Session patterns table
CREATE TABLE IF NOT EXISTS session_patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('success', 'failure', 'optimization', 'splitting')),
  pattern TEXT NOT NULL,
  description TEXT NOT NULL,
  complexity TEXT NOT NULL, -- JSON object with overall and components
  execution_metrics TEXT NOT NULL, -- JSON object with duration, memory, success rate
  optimization_strategy TEXT, -- JSON object with applied strategies and effectiveness
  splitting_strategy TEXT, -- JSON object with split count and success rate
  frequency INTEGER NOT NULL DEFAULT 1,
  last_seen TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_session_patterns_type ON session_patterns(type);
CREATE INDEX IF NOT EXISTS idx_session_patterns_confidence ON session_patterns(confidence);
CREATE INDEX IF NOT EXISTS idx_session_patterns_last_seen ON session_patterns(last_seen);

-- Session learning insights table
CREATE TABLE IF NOT EXISTS session_learning_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('complexity', 'memory', 'splitting', 'success', 'failure')),
  insight TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence REAL NOT NULL,
  based_on_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session optimization history
CREATE TABLE IF NOT EXISTS session_optimization_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  original_complexity REAL NOT NULL,
  optimized_complexity REAL NOT NULL,
  memory_reduction REAL NOT NULL,
  strategies_applied TEXT NOT NULL, -- JSON array
  success BOOLEAN NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_session_patterns_timestamp 
AFTER UPDATE ON session_patterns
BEGIN
  UPDATE session_patterns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;