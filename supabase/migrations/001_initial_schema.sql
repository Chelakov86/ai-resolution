-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles (one per auth user)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  check_in_frequency TEXT NOT NULL DEFAULT 'every_3_days'
    CHECK (check_in_frequency IN ('daily', 'every_3_days', 'weekly')),
  email_checkins_enabled BOOLEAN NOT NULL DEFAULT true,
  email_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resolutions
CREATE TABLE resolutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('Health','Finance','Learning','Relationships','Career','Personal')),
  ai_framing TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Progress logs
CREATE TABLE progress_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resolution_id UUID REFERENCES resolutions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
  ai_progress_estimate INTEGER CHECK (ai_progress_estimate BETWEEN 0 AND 100),
  ai_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-in records (tracks last nudge per resolution)
CREATE TABLE check_in_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resolution_id UUID REFERENCES resolutions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_prompted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resolution_id)
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_records ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own
CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Resolutions: users can only access their own
CREATE POLICY "resolutions_self" ON resolutions
  FOR ALL USING (auth.uid() = user_id);

-- Progress logs: users can only access their own
CREATE POLICY "progress_logs_self" ON progress_logs
  FOR ALL USING (auth.uid() = user_id);

-- Check-in records: users can only access their own
CREATE POLICY "check_in_records_self" ON check_in_records
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
