ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_completed_tutorial BOOLEAN DEFAULT FALSE;

-- The existing RLS policy "Users can update their own profile" should already cover this,
-- but let's double check if we need to add anything specific.
-- Based on example_3 in the migration tool docs, profiles usually have:
-- CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
