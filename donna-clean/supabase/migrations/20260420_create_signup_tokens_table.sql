-- Migration: Create signup_tokens table
-- Date: 2026-04-20
--
-- Powers the magic-link signup flow. Admins generate a token tied to an email;
-- the recipient uses the link to set their own password + business details.
--
-- Tokens expire after 24 hours and are single-use.

CREATE TABLE IF NOT EXISTS signup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_signup_tokens_token ON signup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_signup_tokens_email ON signup_tokens(email);

ALTER TABLE signup_tokens ENABLE ROW LEVEL SECURITY;

-- No client-side access; only service-role (server actions) reads/writes.
-- RLS enabled with no permissive policies = deny all for anon/authenticated roles.
