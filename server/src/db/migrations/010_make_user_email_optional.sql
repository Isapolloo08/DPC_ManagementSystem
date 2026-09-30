-- Migration 010: Make user email column optional (nullable)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
