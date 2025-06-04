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

-- Remover políticas existentes se houver conflito
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;

-- Políticas de segurança para perfis
CREATE POLICY "Usuários podem ver seus próprios perfis" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seus próprios perfis" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Remover políticas existentes de exames
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios exames" ON exams;
DROP POLICY IF EXISTS "Médicos podem ver exames de seus pacientes" ON exams;
DROP POLICY IF EXISTS "Médicos podem inserir exames" ON exams;
DROP POLICY IF EXISTS "Médicos podem atualizar exames" ON exams;
DROP POLICY IF EXISTS "Pacientes podem inserir seus próprios exames" ON exams;

-- Políticas para exames
CREATE POLICY "Pacientes podem ver seus próprios exames" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver exames de seus pacientes" 
  ON exams FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Pacientes podem inserir seus próprios exames" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Médicos podem inserir exames" 
  ON exams FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar exames" 
  ON exams FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para medicamentos
CREATE POLICY "Pacientes podem ver seus próprios medicamentos" 
  ON medications FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver medicamentos de seus pacientes" 
  ON medications FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir medicamentos" 
  ON medications FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar medicamentos" 
  ON medications FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para horários de medicamentos
CREATE POLICY "Pacientes podem ver seus próprios horários de medicamentos" 
  ON medication_schedules FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

CREATE POLICY "Pacientes podem atualizar seus próprios horários de medicamentos" 
  ON medication_schedules FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

-- Remover políticas existentes de consultas
DROP POLICY IF EXISTS "Pacientes podem ver suas próprias consultas" ON appointments;
DROP POLICY IF EXISTS "Médicos podem ver consultas de seus pacientes" ON appointments;
DROP POLICY IF EXISTS "Médicos podem inserir consultas" ON appointments;
DROP POLICY IF EXISTS "Médicos podem atualizar consultas" ON appointments;
DROP POLICY IF EXISTS "Pacientes podem inserir suas próprias consultas" ON appointments;

-- Políticas para consultas
CREATE POLICY "Pacientes podem ver suas próprias consultas" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver consultas de seus pacientes" 
  ON appointments FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Pacientes podem inserir suas próprias consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Médicos podem inserir consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar consultas" 
  ON appointments FOR UPDATE 
  USING (auth.uid() = doctor_id);

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
