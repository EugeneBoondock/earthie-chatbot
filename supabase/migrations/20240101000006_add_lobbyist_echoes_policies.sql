-- Enable RLS
ALTER TABLE public.lobbyist_echoes ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view all echoes
CREATE POLICY "Users can view all echoes"
    ON public.lobbyist_echoes FOR SELECT
    USING (true);

-- Policy to allow authenticated users to add echoes
CREATE POLICY "Users can add echoes"
    ON public.lobbyist_echoes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own echoes
CREATE POLICY "Users can delete own echoes"
    ON public.lobbyist_echoes FOR DELETE
    USING (auth.uid() = user_id);

-- Add foreign key constraint if not exists
ALTER TABLE public.lobbyist_echoes
DROP CONSTRAINT IF EXISTS lobbyist_echoes_user_id_fkey;

ALTER TABLE public.lobbyist_echoes
ADD CONSTRAINT lobbyist_echoes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE; 