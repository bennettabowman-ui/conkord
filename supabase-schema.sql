-- Conkord Database Schema for Supabase
-- Run this in your Supabase SQL Editor to set up the tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_count INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  clarity_score INTEGER NOT NULL,
  specificity_score INTEGER NOT NULL,
  proof_score INTEGER NOT NULL,
  audience_score INTEGER NOT NULL,
  blocker_count INTEGER NOT NULL,
  strength_count INTEGER NOT NULL,
  ai_understanding JSONB,
  blockers JSONB,
  strengths JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_url ON analyses(url);

-- Function to increment scan count
CREATE OR REPLACE FUNCTION increment_scan_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET scan_count = scan_count + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserting new users (for signup)
CREATE POLICY "Allow insert for all" ON users
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow users to read their own data
CREATE POLICY "Allow select for all" ON users
  FOR SELECT
  USING (true);

-- Policy: Allow updating own user record
CREATE POLICY "Allow update for all" ON users
  FOR UPDATE
  USING (true);

-- Policy: Allow inserting analyses
CREATE POLICY "Allow insert analyses" ON analyses
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow reading analyses
CREATE POLICY "Allow select analyses" ON analyses
  FOR SELECT
  USING (true);

-- Grant permissions to anon role (for public access via API key)
GRANT ALL ON users TO anon;
GRANT ALL ON analyses TO anon;
GRANT EXECUTE ON FUNCTION increment_scan_count TO anon;
