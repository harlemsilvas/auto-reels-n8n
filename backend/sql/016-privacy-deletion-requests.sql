\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS public.socialbot_deletion_requests (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  account_id UUID NOT NULL,
  instagram_user_id TEXT NOT NULL CHECK (length(instagram_user_id) BETWEEN 1 AND 100),
  state TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (state IN ('pending_verification', 'verified', 'rejected', 'completed')),
  created_by_user_id UUID NOT NULL REFERENCES public.socialbot_users(id),
  verified_by_user_id UUID REFERENCES public.socialbot_users(id),
  verification_method TEXT CHECK (verification_method IN ('instagram_confirmation', 'verified_email', 'documented_review')),
  verification_reference TEXT CHECK (verification_reference ~ '^[A-Za-z0-9._-]{1,64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  CHECK ((state = 'pending_verification' AND verified_at IS NULL)
    OR state IN ('rejected','completed')
    OR (state = 'verified' AND verified_at IS NOT NULL AND verified_by_user_id IS NOT NULL
      AND verification_method IS NOT NULL AND verification_reference IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_socialbot_deletion_requests_open_scope
  ON public.socialbot_deletion_requests(account_id, instagram_user_id)
  WHERE state IN ('pending_verification','verified');
CREATE TABLE IF NOT EXISTS public.socialbot_deletion_tasks (
  request_id UUID NOT NULL REFERENCES public.socialbot_deletion_requests(id),
  kind TEXT NOT NULL CHECK (kind IN ('database','files','cache','backups')),
  state TEXT NOT NULL CHECK (state IN ('pending','blocked','completed')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(request_id, kind)
);
COMMIT;
