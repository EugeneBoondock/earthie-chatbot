-- Drop existing constraint if it exists
ALTER TABLE lobbyist_posts
DROP CONSTRAINT IF EXISTS lobbyist_posts_user_id_fkey;

-- Add foreign key relationship between lobbyist_posts and profiles
ALTER TABLE lobbyist_posts
ADD CONSTRAINT lobbyist_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id)
ON DELETE CASCADE;

-- Drop existing index if it exists
DROP INDEX IF EXISTS lobbyist_posts_user_id_profiles_idx;

-- Add index to improve join performance
CREATE INDEX IF NOT EXISTS lobbyist_posts_user_id_profiles_idx ON lobbyist_posts(user_id); 