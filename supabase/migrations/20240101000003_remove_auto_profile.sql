-- Drop the automatic profile creation trigger
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user(); 