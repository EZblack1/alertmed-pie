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
  user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin', 'hospital')) DEFAULT 'patient',
  date_of_birth DATE,
  -- Campos para médicos
  doctor_license TEXT,
  specialties TEXT[],
  hospital_id UUID,
  -- Campos para hospitais
  hospital_name TEXT,
  hospital_address TEXT,
  hospital_phone TEXT,
  hospital_email TEXT,
  hospital_website TEXT,
  hospital_registration TEXT
);

-- Tabela de exames (com colunas adicionais necessárias)
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  hospital_id UUID,
  exam_type TEXT NOT NULL,
  exam_date TIMESTAMP WITH TIME ZONE,
  result_available BOOLEAN DEFAULT FALSE,
  result_date TIMESTAMP WITH TIME ZONE,
  result_details TEXT,
  result_file_url TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('requested', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested',
  urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  preferred_date DATE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  scheduled_by UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE
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
  active BOOLEAN DEFAULT TRUE,
  prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  prescription_id TEXT
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
  hospital_id UUID,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60, -- duração em minutos
  status TEXT CHECK (status IN ('requested', 'approved', 'scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  notes TEXT,
  location TEXT,
  specialty TEXT,
  appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta',
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT CHECK (created_by IN ('patient', 'doctor', 'hospital', 'admin')) DEFAULT 'patient',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('exam_result', 'medication_reminder', 'appointment_reminder', 'appointment_request', 'exam_request', 'system')),
  content TEXT NOT NULL,
  related_id UUID, -- ID do exame, medicamento ou consulta relacionado
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  priority TEXT CHECK (priority IN ('baixa', 'normal', 'alta')) DEFAULT 'normal'
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

-- Tabela de relacionamento médico-paciente
CREATE TABLE IF NOT EXISTS doctor_patients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  last_appointment TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(doctor_id, patient_id)
);

-- Tabela de relacionamento hospital-médico
CREATE TABLE IF NOT EXISTS hospital_doctors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  hospital_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  role TEXT,
  department TEXT,
  UNIQUE(hospital_id, doctor_id)
);

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
    ALTER TABLE profiles ADD COLUMN user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin', 'hospital')) DEFAULT 'patient';
  ELSE
    -- Atualizar constraint existente para incluir 'hospital'
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check CHECK (user_type IN ('patient', 'doctor', 'admin', 'hospital'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'doctor_license') THEN
    ALTER TABLE profiles ADD COLUMN doctor_license TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'specialties') THEN
    ALTER TABLE profiles ADD COLUMN specialties TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_id') THEN
    ALTER TABLE profiles ADD COLUMN hospital_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_name') THEN
    ALTER TABLE profiles ADD COLUMN hospital_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_address') THEN
    ALTER TABLE profiles ADD COLUMN hospital_address TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_phone') THEN
    ALTER TABLE profiles ADD COLUMN hospital_phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_email') THEN
    ALTER TABLE profiles ADD COLUMN hospital_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_website') THEN
    ALTER TABLE profiles ADD COLUMN hospital_website TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hospital_registration') THEN
    ALTER TABLE profiles ADD COLUMN hospital_registration TEXT;
  END IF;
END $$;

-- Adicionar colunas na tabela exams se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'status') THEN
    ALTER TABLE exams ADD COLUMN status TEXT CHECK (status IN ('requested', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested';
  ELSE
    -- Atualizar constraint existente para incluir 'approved'
    ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_status_check;
    ALTER TABLE exams ADD CONSTRAINT exams_status_check CHECK (status IN ('requested', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'urgency') THEN
    ALTER TABLE exams ADD COLUMN urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'preferred_date') THEN
    ALTER TABLE exams ADD COLUMN preferred_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'hospital_id') THEN
    ALTER TABLE exams ADD COLUMN hospital_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'approved_by') THEN
    ALTER TABLE exams ADD COLUMN approved_by UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'approved_at') THEN
    ALTER TABLE exams ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'scheduled_by') THEN
    ALTER TABLE exams ADD COLUMN scheduled_by UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'scheduled_at') THEN
    ALTER TABLE exams ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE;
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
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'hospital_id') THEN
    ALTER TABLE appointments ADD COLUMN hospital_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'created_by') THEN
    ALTER TABLE appointments ADD COLUMN created_by TEXT CHECK (created_by IN ('patient', 'doctor', 'hospital', 'admin')) DEFAULT 'patient';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'approved_by') THEN
    ALTER TABLE appointments ADD COLUMN approved_by UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'approved_at') THEN
    ALTER TABLE appointments ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Atualizar o tipo de status para incluir 'requested' e 'approved'
  ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('requested', 'approved', 'scheduled', 'completed', 'cancelled', 'rescheduled'));
END $$;

-- Adicionar colunas na tabela notifications se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT CHECK (priority IN ('baixa', 'normal', 'alta')) DEFAULT 'normal';
  END IF;
  
  -- Atualizar o tipo de notificação para incluir novos tipos
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('exam_result', 'medication_reminder', 'appointment_reminder', 'appointment_request', 'exam_request', 'system'));
END $$;

-- Adicionar colunas na tabela medications se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'prescribed_at') THEN
    ALTER TABLE medications ADD COLUMN prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'prescription_id') THEN
    ALTER TABLE medications ADD COLUMN prescription_id TEXT;
  END IF;
END $$;

-- Agora adicionar as foreign keys após as colunas existirem
DO $$
BEGIN
  -- Adicionar foreign key para hospital_id em exams se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'exams_hospital_id_fkey' 
    AND table_name = 'exams'
  ) THEN
    ALTER TABLE exams ADD CONSTRAINT exams_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES profiles(id);
  END IF;
  
  -- Adicionar foreign key para approved_by em exams se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'exams_approved_by_fkey' 
    AND table_name = 'exams'
  ) THEN
    ALTER TABLE exams ADD CONSTRAINT exams_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id);
  END IF;
  
  -- Adicionar foreign key para scheduled_by em exams se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'exams_scheduled_by_fkey' 
    AND table_name = 'exams'
  ) THEN
    ALTER TABLE exams ADD CONSTRAINT exams_scheduled_by_fkey FOREIGN KEY (scheduled_by) REFERENCES profiles(id);
  END IF;
  
  -- Adicionar foreign key para hospital_id em appointments se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'appointments_hospital_id_fkey' 
    AND table_name = 'appointments'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES profiles(id);
  END IF;
  
  -- Adicionar foreign key para approved_by em appointments se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'appointments_approved_by_fkey' 
    AND table_name = 'appointments'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id);
  END IF;
  
  -- Adicionar foreign key para hospital_id em profiles se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_hospital_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Configurar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_doctors ENABLE ROW LEVEL SECURITY;

-- ========================================
-- REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ========================================

-- Remover políticas de profiles
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_select_doctor_patients" ON profiles;
DROP POLICY IF EXISTS "profiles_select_hospital_doctors" ON profiles;
DROP POLICY IF EXISTS "profiles_select_hospital_patients" ON profiles;

-- Remover políticas de exams
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios exames" ON exams;
DROP POLICY IF EXISTS "Médicos podem ver exames de seus pacientes" ON exams;
DROP POLICY IF EXISTS "Médicos podem inserir exames" ON exams;
DROP POLICY IF EXISTS "Médicos podem atualizar exames" ON exams;
DROP POLICY IF EXISTS "Pacientes podem inserir seus próprios exames" ON exams;
DROP POLICY IF EXISTS "exams_select_patient" ON exams;
DROP POLICY IF EXISTS "exams_select_doctor" ON exams;
DROP POLICY IF EXISTS "exams_select_hospital" ON exams;
DROP POLICY IF EXISTS "exams_insert_patient" ON exams;
DROP POLICY IF EXISTS "exams_insert_doctor" ON exams;
DROP POLICY IF EXISTS "exams_insert_hospital" ON exams;
DROP POLICY IF EXISTS "exams_update_doctor" ON exams;
DROP POLICY IF EXISTS "exams_update_hospital" ON exams;

-- Remover políticas de medications
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios medicamentos" ON medications;
DROP POLICY IF EXISTS "Médicos podem ver medicamentos de seus pacientes" ON medications;
DROP POLICY IF EXISTS "Médicos podem inserir medicamentos" ON medications;
DROP POLICY IF EXISTS "Médicos podem atualizar medicamentos" ON medications;
DROP POLICY IF EXISTS "medications_select_patient" ON medications;
DROP POLICY IF EXISTS "medications_select_doctor" ON medications;
DROP POLICY IF EXISTS "medications_insert_doctor" ON medications;
DROP POLICY IF EXISTS "medications_update_doctor" ON medications;

-- Remover políticas de medication_schedules
DROP POLICY IF EXISTS "Pacientes podem ver seus próprios horários de medicamentos" ON medication_schedules;
DROP POLICY IF EXISTS "Pacientes podem atualizar seus próprios horários de medicamentos" ON medication_schedules;
DROP POLICY IF EXISTS "medication_schedules_select_patient" ON medication_schedules;
DROP POLICY IF EXISTS "medication_schedules_select_doctor" ON medication_schedules;
DROP POLICY IF EXISTS "medication_schedules_update_patient" ON medication_schedules;
DROP POLICY IF EXISTS "medication_schedules_update_doctor" ON medication_schedules;

-- Remover políticas de appointments
DROP POLICY IF EXISTS "Pacientes podem ver suas próprias consultas" ON appointments;
DROP POLICY IF EXISTS "Médicos podem ver consultas de seus pacientes" ON appointments;
DROP POLICY IF EXISTS "Médicos podem inserir consultas" ON appointments;
DROP POLICY IF EXISTS "Médicos podem atualizar consultas" ON appointments;
DROP POLICY IF EXISTS "Pacientes podem inserir suas próprias consultas" ON appointments;
DROP POLICY IF EXISTS "appointments_select_patient" ON appointments;
DROP POLICY IF EXISTS "appointments_select_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_select_hospital" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_patient" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_hospital" ON appointments;
DROP POLICY IF EXISTS "appointments_update_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_update_hospital" ON appointments;

-- Remover políticas de notifications
DROP POLICY IF EXISTS "Usuários podem ver suas próprias notificações" ON notifications;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias notificações" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

-- Remover políticas de email_logs
DROP POLICY IF EXISTS "Usuários podem ver seus próprios logs de email" ON email_logs;
DROP POLICY IF EXISTS "email_logs_select_own" ON email_logs;

-- Remover políticas de doctor_patients
DROP POLICY IF EXISTS "doctor_patients_select_doctor" ON doctor_patients;
DROP POLICY IF EXISTS "doctor_patients_select_patient" ON doctor_patients;
DROP POLICY IF EXISTS "doctor_patients_insert_doctor" ON doctor_patients;
DROP POLICY IF EXISTS "doctor_patients_update_doctor" ON doctor_patients;

-- Remover políticas de hospital_doctors
DROP POLICY IF EXISTS "hospital_doctors_select_hospital" ON hospital_doctors;
DROP POLICY IF EXISTS "hospital_doctors_select_doctor" ON hospital_doctors;
DROP POLICY IF EXISTS "hospital_doctors_insert_hospital" ON hospital_doctors;
DROP POLICY IF EXISTS "hospital_doctors_update_hospital" ON hospital_doctors;

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

-- Médicos podem ver perfis de seus pacientes
CREATE POLICY "profiles_select_doctor_patients" 
  ON profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = profiles.id
    )
    AND 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.user_type = 'doctor'
    )
  );

-- Hospitais podem ver perfis de seus médicos
CREATE POLICY "profiles_select_hospital_doctors" 
  ON profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM hospital_doctors 
      WHERE hospital_doctors.hospital_id = auth.uid() 
      AND hospital_doctors.doctor_id = profiles.id
    )
    AND 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.user_type = 'hospital'
    )
  );

-- Hospitais podem ver perfis de pacientes de seus médicos
CREATE POLICY "profiles_select_hospital_patients" 
  ON profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients 
      JOIN hospital_doctors ON doctor_patients.doctor_id = hospital_doctors.doctor_id
      WHERE hospital_doctors.hospital_id = auth.uid() 
      AND doctor_patients.patient_id = profiles.id
    )
    AND 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.user_type = 'hospital'
    )
  );

-- Políticas para exames
CREATE POLICY "exams_select_patient" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "exams_select_doctor" 
  ON exams FOR SELECT 
  USING (
    auth.uid() = doctor_id 
    OR 
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = exams.patient_id
    )
  );

CREATE POLICY "exams_select_hospital" 
  ON exams FOR SELECT 
  USING (
    auth.uid() = hospital_id 
    OR 
    EXISTS (
      SELECT 1 FROM hospital_doctors 
      WHERE hospital_doctors.hospital_id = auth.uid() 
      AND hospital_doctors.doctor_id = exams.doctor_id
    )
  );

CREATE POLICY "exams_insert_patient" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "exams_insert_doctor" 
  ON exams FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'doctor'
    )
  );

CREATE POLICY "exams_insert_hospital" 
  ON exams FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'hospital'
    )
  );

CREATE POLICY "exams_update_doctor" 
  ON exams FOR UPDATE 
  USING (
    auth.uid() = doctor_id 
    OR 
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = exams.patient_id
    )
  );

CREATE POLICY "exams_update_hospital" 
  ON exams FOR UPDATE 
  USING (
    auth.uid() = hospital_id 
    OR 
    EXISTS (
      SELECT 1 FROM hospital_doctors 
      WHERE hospital_doctors.hospital_id = auth.uid() 
      AND (
        hospital_doctors.doctor_id = exams.doctor_id 
        OR 
        exams.hospital_id = auth.uid()
      )
    )
  );

-- Políticas para medicamentos
CREATE POLICY "medications_select_patient" 
  ON medications FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "medications_select_doctor" 
  ON medications FOR SELECT 
  USING (
    auth.uid() = doctor_id 
    OR 
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = medications.patient_id
    )
  );

CREATE POLICY "medications_insert_doctor" 
  ON medications FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'doctor'
    )
  );

CREATE POLICY "medications_update_doctor" 
  ON medications FOR UPDATE 
  USING (
    auth.uid() = doctor_id 
    OR 
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = medications.patient_id
    )
  );

-- Políticas para horários de medicamentos
CREATE POLICY "medication_schedules_select_patient" 
  ON medication_schedules FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.patient_id = auth.uid()
    )
  );

CREATE POLICY "medication_schedules_select_doctor" 
  ON medication_schedules FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND (
        medications.doctor_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM doctor_patients 
          WHERE doctor_patients.doctor_id = auth.uid() 
          AND doctor_patients.patient_id = medications.patient_id
        )
      )
    )
  );

CREATE POLICY "medication_schedules_update_patient" 
  ON medication_schedules FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.patient_id = auth.uid()
    )
  );

CREATE POLICY "medication_schedules_update_doctor" 
  ON medication_schedules FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.doctor_id = auth.uid()
    )
  );

-- Políticas para consultas
CREATE POLICY "appointments_select_patient" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "appointments_select_doctor" 
  ON appointments FOR SELECT 
  USING (
    auth.uid() = doctor_id 
    OR 
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = appointments.patient_id
    )
  );

CREATE POLICY "appointments_select_hospital" 
  ON appointments FOR SELECT 
  USING (
    auth.uid() = hospital_id 
    OR 
    EXISTS (
      SELECT 1 FROM hospital_doctors 
      WHERE hospital_doctors.hospital_id = auth.uid() 
      AND hospital_doctors.doctor_id = appointments.doctor_id
    )
  );

CREATE POLICY "appointments_insert_patient" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "appointments_insert_doctor" 
  ON appointments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'doctor'
    )
  );

CREATE POLICY "appointments_insert_hospital" 
  ON appointments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'hospital'
    )
  );

CREATE POLICY "appointments_update_doctor" 
  ON appointments FOR UPDATE 
  USING (
    auth.uid() = doctor_id 
    OR 
    EXISTS (
      SELECT 1 FROM doctor_patients 
      WHERE doctor_patients.doctor_id = auth.uid() 
      AND doctor_patients.patient_id = appointments.patient_id
    )
  );

CREATE POLICY "appointments_update_hospital" 
  ON appointments FOR UPDATE 
  USING (
    auth.uid() = hospital_id 
    OR 
    EXISTS (
      SELECT 1 FROM hospital_doctors 
      WHERE hospital_doctors.hospital_id = auth.uid() 
      AND (
        hospital_doctors.doctor_id = appointments.doctor_id 
        OR 
        appointments.hospital_id = auth.uid()
      )
    )
  );

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

-- Políticas para relacionamento médico-paciente
CREATE POLICY "doctor_patients_select_doctor" 
  ON doctor_patients FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "doctor_patients_select_patient" 
  ON doctor_patients FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "doctor_patients_insert_doctor" 
  ON doctor_patients FOR INSERT 
  WITH CHECK (
    auth.uid() = doctor_id 
    AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'doctor'
    )
  );

CREATE POLICY "doctor_patients_update_doctor" 
  ON doctor_patients FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para relacionamento hospital-médico
CREATE POLICY "hospital_doctors_select_hospital" 
  ON hospital_doctors FOR SELECT 
  USING (auth.uid() = hospital_id);

CREATE POLICY "hospital_doctors_select_doctor" 
  ON hospital_doctors FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "hospital_doctors_insert_hospital" 
  ON hospital_doctors FOR INSERT 
  WITH CHECK (
    auth.uid() = hospital_id 
    AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'hospital'
    )
  );

CREATE POLICY "hospital_doctors_update_hospital" 
  ON hospital_doctors FOR UPDATE 
  USING (auth.uid() = hospital_id);

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
    COALESCE(new.raw_user_meta_data->>'user_type', 'patient')
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
  -- Notificação para o paciente
  INSERT INTO notifications (user_id, type, content, related_id)
  VALUES (
    NEW.patient_id,
    'appointment_reminder',
    'Sua consulta foi agendada para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI'),
    NEW.id
  );
  
  -- Notificação para o médico se a consulta foi agendada pelo paciente
  IF NEW.created_by = 'patient' AND NEW.doctor_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, content, related_id)
    VALUES (
      NEW.doctor_id,
      'appointment_request',
      'Nova solicitação de consulta para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI'),
      NEW.id
    );
  END IF;
  
  -- Notificação para o hospital se especificado
  IF NEW.hospital_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, content, related_id)
    VALUES (
      NEW.hospital_id,
      'appointment_request',
      'Nova consulta agendada para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI'),
      NEW.id
    );
  END IF;
  
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
  -- Notificação para o paciente
  INSERT INTO notifications (user_id, type, content, related_id)
  VALUES (
    NEW.patient_id,
    'exam_result',
    'Sua solicitação de exame (' || NEW.exam_type || ') foi recebida e está sendo processada',
    NEW.id
  );
  
  -- Notificação para o médico se o exame foi solicitado pelo paciente
  IF NEW.doctor_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, content, related_id)
    VALUES (
      NEW.doctor_id,
      'exam_request',
      'Nova solicitação de exame (' || NEW.exam_type || ') do paciente',
      NEW.id
    );
  END IF;
  
  -- Notificação para o hospital se especificado
  IF NEW.hospital_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, content, related_id)
    VALUES (
      NEW.hospital_id,
      'exam_request',
      'Nova solicitação de exame (' || NEW.exam_type || ')',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificação automática de exame
DROP TRIGGER IF EXISTS on_exam_requested ON exams;
CREATE TRIGGER on_exam_requested
  AFTER INSERT ON exams
  FOR EACH ROW EXECUTE FUNCTION notify_exam_requested();

-- Função para notificar quando um exame é aprovado
CREATE OR REPLACE FUNCTION notify_exam_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'requested' AND NEW.status = 'approved' THEN
    -- Notificação para o paciente
    INSERT INTO notifications (user_id, type, content, related_id, priority)
    VALUES (
      NEW.patient_id,
      'exam_result',
      'Seu exame (' || NEW.exam_type || ') foi aprovado e está pronto para agendamento',
      NEW.id,
      'alta'
    );
    
    -- Notificação para o médico solicitante
    IF NEW.doctor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, content, related_id)
      VALUES (
        NEW.doctor_id,
        'exam_result',
        'O exame (' || NEW.exam_type || ') que você solicitou foi aprovado',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificação de aprovação de exame
DROP TRIGGER IF EXISTS on_exam_approved ON exams;
CREATE TRIGGER on_exam_approved
  AFTER UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION notify_exam_approved();

-- Função para notificar quando uma consulta é aprovada
CREATE OR REPLACE FUNCTION notify_appointment_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'requested' AND NEW.status = 'approved' THEN
    -- Notificação para o paciente
    INSERT INTO notifications (user_id, type, content, related_id, priority)
    VALUES (
      NEW.patient_id,
      'appointment_reminder',
      'Sua solicitação de consulta para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI') || ' foi aprovada',
      NEW.id,
      'alta'
    );
    
    -- Notificação para o médico
    IF NEW.doctor_id IS NOT NULL AND NEW.doctor_id != NEW.approved_by THEN
      INSERT INTO notifications (user_id, type, content, related_id)
      VALUES (
        NEW.doctor_id,
        'appointment_reminder',
        'Uma consulta foi aprovada para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI'),
        NEW.id
      );
    END IF;
    
    -- Notificação para o hospital
    IF NEW.hospital_id IS NOT NULL AND NEW.hospital_id != NEW.approved_by THEN
      INSERT INTO notifications (user_id, type, content, related_id)
      VALUES (
        NEW.hospital_id,
        'appointment_reminder',
        'Uma consulta foi aprovada para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI'),
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificação de aprovação de consulta
DROP TRIGGER IF EXISTS on_appointment_approved ON appointments;
CREATE TRIGGER on_appointment_approved
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION notify_appointment_approved();

-- Atualizar registros existentes com valores padrão
UPDATE profiles SET user_type = 'patient' WHERE user_type IS NULL;
UPDATE exams SET status = 'requested' WHERE status IS NULL;
UPDATE exams SET urgency = 'media' WHERE urgency IS NULL;
UPDATE appointments SET appointment_type = 'primeira-consulta' WHERE appointment_type IS NULL;
UPDATE appointments SET confirmation_sent = FALSE WHERE confirmation_sent IS NULL;
UPDATE appointments SET created_by = 'patient' WHERE created_by IS NULL;
UPDATE notifications SET priority = 'normal' WHERE priority IS NULL;

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
WHERE tablename IN ('profiles', 'exams', 'medications', 'medication_schedules', 'appointments', 'notifications', 'email_logs', 'doctor_patients', 'hospital_doctors')
ORDER BY tablename, policyname;

-- Mostrar mensagem de sucesso
SELECT 'Schema criado com sucesso! Estrutura pronta para uso.' as status;
