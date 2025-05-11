-- Enable RLS
ALTER TABLE public.lobbyist_reactions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view all reactions
CREATE POLICY "Users can view all reactions"
    ON public.lobbyist_reactions FOR SELECT
    USING (true);

-- Policy to allow authenticated users to add reactions
CREATE POLICY "Users can add reactions"
    ON public.lobbyist_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own reactions
CREATE POLICY "Users can delete own reactions"
    ON public.lobbyist_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- Add foreign key constraint if not exists
ALTER TABLE public.lobbyist_reactions
DROP CONSTRAINT IF EXISTS lobbyist_reactions_user_id_fkey;

ALTER TABLE public.lobbyist_reactions
ADD CONSTRAINT lobbyist_reactions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE; 