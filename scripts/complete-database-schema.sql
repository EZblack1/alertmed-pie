-- Script completo para garantir que todas as tabelas e colunas necessárias existem

-- Habilitar a extensão UUID se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar ou atualizar tabela de perfis
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

-- Criar ou atualizar tabela de exames
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

-- Criar ou atualizar tabela de medicamentos
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

-- Criar ou atualizar tabela de horários de medicamentos
CREATE TABLE IF NOT EXISTS medication_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMP WITH TIME ZONE
);

-- Criar ou atualizar tabela de consultas com TODAS as colunas necessárias
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  notes TEXT,
  location TEXT,
  specialty TEXT,
  appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta',
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('exam_result', 'medication_reminder', 'appointment_reminder')),
  content TEXT NOT NULL,
  related_id UUID,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela de logs de email
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
  related_id UUID
);

-- Configurar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para perfis
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;

CREATE POLICY "Usuários podem ver seus próprios perfis" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seus próprios perfis" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Políticas para exames
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios exames" ON exams;
DROP POLICY IF EXISTS "Pacientes podem inserir seus próprios exames" ON exams;

CREATE POLICY "Pacientes podem ver seus próprios exames" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Pacientes podem inserir seus próprios exames" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

-- Políticas para consultas
DROP POLICY IF EXISTS "Pacientes podem ver suas próprias consultas" ON appointments;
DROP POLICY IF EXISTS "Pacientes podem inserir suas próprias consultas" ON appointments;

CREATE POLICY "Pacientes podem ver suas próprias consultas" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Pacientes podem inserir suas próprias consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

-- Políticas para notificações
DROP POLICY IF EXISTS "Usuários podem ver suas próprias notificações" ON notifications;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias notificações" ON notifications;

CREATE POLICY "Usuários podem ver suas próprias notificações" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias notificações" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Políticas para logs de email
CREATE POLICY "Usuários podem ver seus próprios logs de email" 
  ON email_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Função para criar perfil automaticamente
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

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para notificação automática de consulta
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

-- Trigger para notificação automática de consulta
DROP TRIGGER IF EXISTS on_appointment_created ON appointments;
CREATE TRIGGER on_appointment_created
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION notify_appointment_scheduled();

-- Função para notificação automática de exame
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

-- Verificar estrutura final das tabelas
SELECT 'appointments' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
UNION ALL
SELECT 'exams' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'exams'
ORDER BY table_name, ordinal_position;
