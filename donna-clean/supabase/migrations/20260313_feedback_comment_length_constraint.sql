-- Add a hard DB-level length constraint on feedback_responses.comment
-- Enforces the 500-char limit even if validation is bypassed upstream.
ALTER TABLE feedback_responses
  ADD CONSTRAINT comment_length CHECK (char_length(comment) <= 500);
