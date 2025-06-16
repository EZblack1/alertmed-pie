-- Desabilitar completamente RLS da tabela profiles para resolver recursão
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas que podem causar recursão
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_system_insert" ON profiles;
DROP POLICY IF EXISTS "exams_medical_access" ON exams;

-- Criar uma política muito simples para profiles (sem recursão)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política simples que não causa recursão
CREATE POLICY "profiles_basic_access" ON profiles
  FOR ALL USING (true);

-- Verificar se a tabela exams tem as políticas corretas
DROP POLICY IF EXISTS "exams_select_policy" ON exams;
DROP POLICY IF EXISTS "exams_insert_policy" ON exams;
DROP POLICY IF EXISTS "exams_update_policy" ON exams;

-- Políticas simples para exams
CREATE POLICY "exams_patient_access" ON exams
  FOR ALL USING (auth.uid() = patient_id);

-- Garantir que a tabela exams existe
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  exam_type TEXT NOT NULL,
  status TEXT DEFAULT 'requested',
  urgency TEXT DEFAULT 'media',
  preferred_date DATE,
  result_available BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
