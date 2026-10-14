-- ============================================================================
-- BentoTrade AI - High-Performance Real-Time Support Ticketing & Live Chat Schema
-- Target: Supabase (PostgreSQL 15+)
-- Idempotent Migration Script
-- ============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enhance or Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('user', 'moderator', 'admin')) DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was previously created with fewer columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 3. Automatic User Profile Synchronization Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    display_name,
    email,
    avatar_url,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'Trader'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'Trader'
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    ),
    CASE 
      WHEN NEW.email = 'sifeddinoutbout97@gmail.com' THEN 'admin'
      ELSE 'user'
    END,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Helper Function: Is Current User Staff (Admin or Moderator)?
CREATE OR REPLACE FUNCTION public.is_staff(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_mail TEXT;
BEGIN
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role, email INTO user_role, user_mail
  FROM public.profiles
  WHERE id = user_uuid;

  IF user_role IN ('admin', 'moderator') OR user_mail = 'sifeddinoutbout97@gmail.com' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 5. Create support_tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  category TEXT CHECK (category IN ('billing', 'technical', 'general', 'feature')) DEFAULT 'general',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_updated_at ON public.support_tickets(updated_at DESC);

-- 6. Create ticket_messages Table (id, ticket_id, sender_id, content, created_at)
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for ticket conversation streams
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at ASC);

-- 7. Trigger to bump support_tickets.updated_at on new message
-- Staff authorization is evaluated via profiles.role
CREATE OR REPLACE FUNCTION public.handle_ticket_message_inserted()
RETURNS TRIGGER AS $$
DECLARE
  sender_role TEXT;
BEGIN
  -- Determine role of sender from profiles table
  SELECT role INTO sender_role FROM public.profiles WHERE id = NEW.sender_id;

  UPDATE public.support_tickets
  SET 
    updated_at = NOW(),
    -- If ticket was closed or resolved and user sends a message, reopen to 'in_progress'
    status = CASE 
      WHEN status IN ('resolved', 'closed') AND COALESCE(sender_role, 'user') NOT IN ('admin', 'moderator') THEN 'in_progress'
      ELSE status
    END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_message_inserted ON public.ticket_messages;
CREATE TRIGGER on_ticket_message_inserted
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_ticket_message_inserted();

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- 9. Profiles Policies
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- 10. Support Tickets Policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own tickets" ON public.support_tickets;
CREATE POLICY "Users can insert their own tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update any ticket" ON public.support_tickets;
CREATE POLICY "Staff can update any ticket"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

-- 11. Ticket Messages Policies
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.ticket_messages;
CREATE POLICY "Users can view messages for their tickets"
  ON public.ticket_messages FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE public.support_tickets.id = ticket_messages.ticket_id
      AND public.support_tickets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users and staff can insert messages" ON public.ticket_messages;
CREATE POLICY "Users and staff can insert messages"
  ON public.ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid()) OR
    (
      sender_id = auth.uid() AND
      is_staff = FALSE AND
      EXISTS (
        SELECT 1 FROM public.support_tickets
        WHERE public.support_tickets.id = ticket_messages.ticket_id
        AND public.support_tickets.user_id = auth.uid()
      )
    )
  );

-- 12. Realtime Publication Setup
DO $$
BEGIN
  -- Add support_tickets to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;

  -- Add ticket_messages to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication configuration note: %', SQLERRM;
END $$;

-- 13. Handy Role Management Snippets
-- Run this in SQL Editor to promote a user to moderator:
-- UPDATE public.profiles SET role = 'moderator' WHERE email = 'user@example.com';
--
-- Run this in SQL Editor to promote a user to admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'user@example.com';
