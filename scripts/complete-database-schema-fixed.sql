-- Habilitar a extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis (complementa a tabela auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  phone TEXT,
  user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')) DEFAULT 'patient',
  date_of_birth DATE
);

-- Tabela de exames (com colunas adicionais necessárias)
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  exam_type TEXT NOT NULL,
  exam_date TIMESTAMP WITH TIME ZONE,
  result_available BOOLEAN DEFAULT FALSE,
  result_date TIMESTAMP WITH TIME ZONE,
  result_details TEXT,
  result_file_url TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested',
  urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  preferred_date DATE
);

-- Tabela de medicamentos
CREATE TABLE IF NOT EXISTS medications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  instructions TEXT,
  active BOOLEAN DEFAULT TRUE
);

-- Tabela de horários de medicamentos
CREATE TABLE IF NOT EXISTS medication_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de consultas (com todas as colunas necessárias)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60, -- duração em minutos
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  notes TEXT,
  location TEXT,
  specialty TEXT,
  appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta',
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('exam_result', 'medication_reminder', 'appointment_reminder')),
  content TEXT NOT NULL,
  related_id UUID, -- ID do exame, medicamento ou consulta relacionado
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de logs de email
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_successfully BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  related_id UUID -- ID do exame, consulta, etc.
);

-- Configurar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ========================================

-- Remover políticas de profiles
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;

-- Remover políticas de exams
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios exames" ON exams;
DROP POLICY IF EXISTS "Médicos podem ver exames de seus pacientes" ON exams;
DROP POLICY IF EXISTS "Médicos podem inserir exames" ON exams;
DROP POLICY IF EXISTS "Médicos podem atualizar exames" ON exams;
DROP POLICY IF EXISTS "Pacientes podem inserir seus próprios exames" ON exams;

-- Remover políticas de medications
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios medicamentos" ON medications;
DROP POLICY IF EXISTS "Médicos podem ver medicamentos de seus pacientes" ON medications;
DROP POLICY IF EXISTS "Médicos podem inserir medicamentos" ON medications;
DROP POLICY IF EXISTS "Médicos podem atualizar medicamentos" ON medications;

-- Remover políticas de medication_schedules
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios horários de medicamentos" ON medication_schedules;
DROP POLICY IF EXISTS "Pacientes podem atualizar seus próprios horários de medicamentos" ON medication_schedules;

-- Remover políticas de appointments
DROP POLICY IF EXISTS "Pacientes podem ver suas próprias consultas" ON appointments;
DROP POLICY IF EXISTS "Médicos podem ver consultas de seus pacientes" ON appointments;
DROP POLICY IF EXISTS "Médicos podem inserir consultas" ON appointments;
DROP POLICY IF EXISTS "Médicos podem atualizar consultas" ON appointments;
DROP POLICY IF EXISTS "Pacientes podem inserir suas próprias consultas" ON appointments;

-- Remover políticas de notifications
DROP POLICY IF EXISTS "Usuários podem ver suas próprias notificações" ON notifications;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias notificações" ON notifications;

-- Remover políticas de email_logs
DROP POLICY IF EXISTS "Usuários podem ver seus próprios logs de email" ON email_logs;

-- ========================================
-- CRIAR NOVAS POLÍTICAS
-- ========================================

-- Políticas de segurança para perfis
CREATE POLICY "profiles_select_own" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Políticas para exames
CREATE POLICY "exams_select_patient" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "exams_select_doctor" 
  ON exams FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "exams_insert_patient" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "exams_insert_doctor" 
  ON exams FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "exams_update_doctor" 
  ON exams FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para medicamentos
CREATE POLICY "medications_select_patient" 
  ON medications FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "medications_select_doctor" 
  ON medications FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "medications_insert_doctor" 
  ON medications FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "medications_update_doctor" 
  ON medications FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para horários de medicamentos
CREATE POLICY "medication_schedules_select_patient" 
  ON medication_schedules FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

CREATE POLICY "medication_schedules_update_patient" 
  ON medication_schedules FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

-- Políticas para consultas
CREATE POLICY "appointments_select_patient" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "appointments_select_doctor" 
  ON appointments FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "appointments_insert_patient" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "appointments_insert_doctor" 
  ON appointments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "appointments_update_doctor" 
  ON appointments FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para notificações
CREATE POLICY "notifications_select_own" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Políticas para logs de email
CREATE POLICY "email_logs_select_own" 
  ON email_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- ========================================
-- FUNÇÕES E TRIGGERS
-- ========================================

-- Trigger para criar perfil automaticamente após cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, user_type)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url', 
    new.email, 
    'patient'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para enviar notificação automática quando consulta é agendada
CREATE OR REPLACE FUNCTION notify_appointment_scheduled()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, related_id)
  VALUES (
    NEW.patient_id,
    'appointment_reminder',
    'Sua consulta foi agendada para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI'),
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificação automática
DROP TRIGGER IF EXISTS on_appointment_created ON appointments;
CREATE TRIGGER on_appointment_created
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION notify_appointment_scheduled();

-- Função para enviar notificação automática quando exame é solicitado
CREATE OR REPLACE FUNCTION notify_exam_requested()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, related_id)
  VALUES (
    NEW.patient_id,
    'exam_result',
    'Sua solicitação de exame (' || NEW.exam_type || ') foi recebida e está sendo processada',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificação automática de exame
DROP TRIGGER IF EXISTS on_exam_requested ON exams;
CREATE TRIGGER on_exam_requested
  AFTER INSERT ON exams
  FOR EACH ROW EXECUTE FUNCTION notify_exam_requested();

-- ========================================
-- ADICIONAR COLUNAS FALTANTES EM TABELAS EXISTENTES
-- ========================================

-- Adicionar colunas na tabela profiles se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_type') THEN
    ALTER TABLE profiles ADD COLUMN user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')) DEFAULT 'patient';
  END IF;
END $$;

-- Adicionar colunas na tabela exams se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'status') THEN
    ALTER TABLE exams ADD COLUMN status TEXT CHECK (status IN ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'urgency') THEN
    ALTER TABLE exams ADD COLUMN urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'preferred_date') THEN
    ALTER TABLE exams ADD COLUMN preferred_date DATE;
  END IF;
END $$;

-- Adicionar colunas na tabela appointments se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'specialty') THEN
    ALTER TABLE appointments ADD COLUMN specialty TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'appointment_type') THEN
    ALTER TABLE appointments ADD COLUMN appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmation_sent') THEN
    ALTER TABLE appointments ADD COLUMN confirmation_sent BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmation_sent_at') THEN
    ALTER TABLE appointments ADD COLUMN confirmation_sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Atualizar registros existentes com valores padrão
UPDATE profiles SET user_type = 'patient' WHERE user_type IS NULL;
UPDATE exams SET status = 'requested' WHERE status IS NULL;
UPDATE exams SET urgency = 'media' WHERE urgency IS NULL;
UPDATE appointments SET appointment_type = 'primeira-consulta' WHERE appointment_type IS NULL;
UPDATE appointments SET confirmation_sent = FALSE WHERE confirmation_sent IS NULL;

-- ========================================
-- VERIFICAÇÃO FINAL
-- ========================================

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
ORDER BY table_name, column_name;

-- Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'exams', 'medications', 'medication_schedules', 'appointments', 'notifications', 'email_logs')
ORDER BY tablename, policyname;
