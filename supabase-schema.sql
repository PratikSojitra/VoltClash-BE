-- Supabase Database Schema Migration Script for VoltClash
-- This file defines the tables, enums, indices, and constraints matching the previous MongoDB schema.

-- -------------------------------------------------------------
-- 1. Game Data
-- -------------------------------------------------------------

-- Create an enum for game data categories
CREATE TYPE game_data_type AS ENUM ('building', 'troop', 'hero', 'spell');

-- Create table for game configurations and levels metadata
CREATE TABLE IF NOT EXISTS game_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type game_data_type NOT NULL,
    name TEXT NOT NULL UNIQUE,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for querying game data by category/type
CREATE INDEX IF NOT EXISTS idx_game_data_type ON game_data(type);

-- -------------------------------------------------------------
-- 2. Player Profile
-- -------------------------------------------------------------

-- Create table for player profiles
CREATE TABLE IF NOT EXISTS player_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- References authenticated user if integration is added later
    player_tag TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    town_hall_level INT NOT NULL DEFAULT 1,
    builder_hall_level INT NOT NULL DEFAULT 0,
    last_api_sync TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{"builderCount": 5, "hasGoldPass": false, "apprenticeBuilderLevel": 0}'::jsonb,
    stats JSONB NOT NULL DEFAULT '{"heroes": [], "troops": [], "spells": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on user_id and player_tag for high performance queries
CREATE INDEX IF NOT EXISTS idx_player_profile_user_id ON player_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_player_profile_player_tag ON player_profile(player_tag);

-- -------------------------------------------------------------
-- 3. Upgrade Timer
-- -------------------------------------------------------------

-- Create table for running upgrades per player
CREATE TABLE IF NOT EXISTS upgrade_timer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_tag TEXT NOT NULL REFERENCES player_profile(player_tag) ON DELETE CASCADE,
    building_key TEXT NOT NULL,
    current_level INT NOT NULL,
    target_level INT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    builder_slot INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for searching and resolving active timers per player
CREATE INDEX IF NOT EXISTS idx_upgrade_timer_player_tag ON upgrade_timer(player_tag);
CREATE INDEX IF NOT EXISTS idx_upgrade_timer_end_time ON upgrade_timer(end_time);

-- -------------------------------------------------------------
-- 4. Triggers to automatically update updated_at timestamp
-- -------------------------------------------------------------

-- Helper function to update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_game_data_modtime
    BEFORE UPDATE ON game_data
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_player_profile_modtime
    BEFORE UPDATE ON player_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_upgrade_timer_modtime
    BEFORE UPDATE ON upgrade_timer
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
