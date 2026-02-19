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

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = id);

-- Resolutions
CREATE POLICY "resolutions_select" ON resolutions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resolutions_insert" ON resolutions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resolutions_update" ON resolutions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resolutions_delete" ON resolutions FOR DELETE USING (auth.uid() = user_id);

-- Progress logs
CREATE POLICY "progress_logs_select" ON progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_logs_insert" ON progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_logs_update" ON progress_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_logs_delete" ON progress_logs FOR DELETE USING (auth.uid() = user_id);

-- Check-in records
CREATE POLICY "check_in_records_select" ON check_in_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "check_in_records_insert" ON check_in_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "check_in_records_update" ON check_in_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "check_in_records_delete" ON check_in_records FOR DELETE USING (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX idx_resolutions_user_id ON resolutions(user_id);
CREATE INDEX idx_progress_logs_resolution_created ON progress_logs(resolution_id, created_at DESC);
CREATE INDEX idx_progress_logs_user_created ON progress_logs(user_id, created_at DESC);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
