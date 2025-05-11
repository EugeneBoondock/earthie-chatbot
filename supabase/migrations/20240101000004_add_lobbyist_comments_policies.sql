-- Enable RLS
ALTER TABLE public.lobbyist_comments ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint if not exists
ALTER TABLE public.lobbyist_comments
DROP CONSTRAINT IF EXISTS lobbyist_comments_user_id_fkey;

ALTER TABLE public.lobbyist_comments
ADD CONSTRAINT lobbyist_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Policy to allow users to view all comments
CREATE POLICY "Users can view all comments"
    ON public.lobbyist_comments FOR SELECT
    USING (true);

-- Policy to allow authenticated users to add comments
CREATE POLICY "Users can add comments"
    ON public.lobbyist_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own comments
CREATE POLICY "Users can delete own comments"
    ON public.lobbyist_comments FOR DELETE
    USING (auth.uid() = user_id);

-- Add index to improve join performance
CREATE INDEX IF NOT EXISTS lobbyist_comments_user_id_idx ON public.lobbyist_comments(user_id); 