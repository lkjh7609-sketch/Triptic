-- Drop the NOT NULL constraint on destination_id
ALTER TABLE public.posts ALTER COLUMN destination_id DROP NOT NULL;
