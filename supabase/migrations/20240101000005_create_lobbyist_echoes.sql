-- Create the lobbyist_echoes table
CREATE TABLE public.lobbyist_echoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    post_id uuid REFERENCES public.lobbyist_posts(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, post_id)
);

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

-- Add index to improve join performance
CREATE INDEX IF NOT EXISTS lobbyist_echoes_user_id_idx ON public.lobbyist_echoes(user_id);
CREATE INDEX IF NOT EXISTS lobbyist_echoes_post_id_idx ON public.lobbyist_echoes(post_id); 