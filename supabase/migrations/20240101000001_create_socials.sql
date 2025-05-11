-- First create the enum type
create type public.relationship_type as enum ('follow', 'block', 'mute');

-- Then create the complete table
create table public.socials (
    id uuid default gen_random_uuid() primary key,
    follower_id uuid references public.profiles(id) on delete cascade not null,
    following_id uuid references public.profiles(id) on delete cascade not null,
    relationship_type relationship_type not null default 'follow',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone,
    unique(follower_id, following_id, relationship_type)
);

-- Create index for faster lookups
create index socials_follower_idx on public.socials(follower_id);
create index socials_following_idx on public.socials(following_id);
create index socials_relationship_type_idx on public.socials(relationship_type);

-- Enable RLS
alter table public.socials enable row level security;

-- Policies
create policy "Users can view all social relationships"
    on public.socials for select
    using (true);

create policy "Users can manage their own social relationships"
    on public.socials for insert
    with check (auth.uid() = follower_id);

create policy "Users can remove their own social relationships"
    on public.socials for delete
    using (auth.uid() = follower_id);

-- Functions

-- Get follower count for a user
create or replace function get_follower_count(user_id uuid)
returns bigint
language sql
security definer
as $$
    select count(*)
    from public.socials
    where following_id = user_id
    and relationship_type = 'follow';
$$;

-- Get following count for a user
create or replace function get_following_count(user_id uuid)
returns bigint
language sql
security definer
as $$
    select count(*)
    from public.socials
    where follower_id = user_id
    and relationship_type = 'follow';
$$;

-- Check if user is following another user
create or replace function is_following(follower uuid, following uuid)
returns boolean
language sql
security definer
as $$
    select exists (
        select 1
        from public.socials
        where follower_id = follower
        and following_id = following
        and relationship_type = 'follow'
    );
$$;

-- Make sure moddatetime extension exists
create extension if not exists moddatetime;

-- Add updated_at trigger
create trigger handle_updated_at before update
    on public.socials
    for each row
    execute procedure moddatetime('updated_at'); 