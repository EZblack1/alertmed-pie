-- Adicionar tipo de usuário 'hospital' na tabela profiles
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_user_type_check 
  CHECK (user_type IN ('patient', 'doctor', 'admin', 'hospital'));

-- Adicionar campos necessários para hospitais
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hospital_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hospital_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hospital_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hospital_license TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hospital_specialties TEXT[];

-- Adicionar campo hospital_id nas tabelas de consultas e exames
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES profiles(id);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES profiles(id);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Adicionar campo para rastreamento de solicitações
ALTER TABLE exams ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id);

-- Adicionar campo para status de aprovação
ALTER TABLE exams ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved';

-- Adicionar campo para motivo de rejeição
ALTER TABLE exams ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Criar tabela de relacionamento médico-hospital
CREATE TABLE IF NOT EXISTS doctor_hospital (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'inactive', 'pending')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  specialty TEXT,
  schedule JSONB,
  UNIQUE(doctor_id, hospital_id)
);

-- Habilitar RLS na nova tabela
ALTER TABLE doctor_hospital ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para doctor_hospital
CREATE POLICY "Médicos podem ver seus próprios relacionamentos" 
  ON doctor_hospital FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Hospitais podem ver seus próprios relacionamentos" 
  ON doctor_hospital FOR SELECT 
  USING (auth.uid() = hospital_id);

CREATE POLICY "Hospitais podem inserir relacionamentos" 
  ON doctor_hospital FOR INSERT 
  WITH CHECK (auth.uid() = hospital_id);

CREATE POLICY "Hospitais podem atualizar relacionamentos" 
  ON doctor_hospital FOR UPDATE 
  USING (auth.uid() = hospital_id);

-- Atualizar políticas RLS para exames
DROP POLICY IF EXISTS "Hospitais podem ver exames de seus pacientes" ON exams;
CREATE POLICY "Hospitais podem ver exames de seus pacientes" 
  ON exams FOR SELECT 
  USING (auth.uid() = hospital_id);

DROP POLICY IF EXISTS "Hospitais podem inserir exames" ON exams;
CREATE POLICY "Hospitais podem inserir exames" 
  ON exams FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'hospital'));

DROP POLICY IF EXISTS "Hospitais podem atualizar exames" ON exams;
CREATE POLICY "Hospitais podem atualizar exames" 
  ON exams FOR UPDATE 
  USING (auth.uid() = hospital_id);

-- Atualizar políticas RLS para consultas
DROP POLICY IF EXISTS "Hospitais podem ver consultas de seus pacientes" ON appointments;
CREATE POLICY "Hospitais podem ver consultas de seus pacientes" 
  ON appointments FOR SELECT 
  USING (auth.uid() = hospital_id);

DROP POLICY IF EXISTS "Hospitais podem inserir consultas" ON appointments;
CREATE POLICY "Hospitais podem inserir consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'hospital'));

DROP POLICY IF EXISTS "Hospitais podem atualizar consultas" ON appointments;
CREATE POLICY "Hospitais podem atualizar consultas" 
  ON appointments FOR UPDATE 
  USING (auth.uid() = hospital_id);

-- Verificar estrutura final das tabelas
SELECT 
  'appointments' as table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
  AND table_schema = 'public'
  AND column_name IN ('hospital_id', 'requested_by', 'approval_status', 'rejection_reason')
UNION ALL
SELECT 
  'exams' as table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'exams'
  AND table_schema = 'public'
  AND column_name IN ('hospital_id', 'requested_by', 'approval_status', 'rejection_reason', 'approved_by', 'approved_at')
UNION ALL
SELECT 
  'profiles' as table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles'
  AND table_schema = 'public'
  AND column_name IN ('hospital_name', 'hospital_address', 'hospital_phone', 'hospital_license', 'hospital_specialties')
UNION ALL
SELECT 
  'doctor_hospital' as table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'doctor_hospital'
  AND table_schema = 'public'
ORDER BY table_name, column_name;
