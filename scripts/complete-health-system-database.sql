-- ========================================
-- SISTEMA COMPLETO DE GESTÃO DE SAÚDE
-- Script único para Supabase
-- ========================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 1. REMOVER ESTRUTURAS EXISTENTES
-- ========================================

-- Remover triggers existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_appointment_created ON appointments;
DROP TRIGGER IF EXISTS on_exam_requested ON exams;
DROP TRIGGER IF EXISTS on_exam_approved ON exams;
DROP TRIGGER IF EXISTS on_appointment_approved ON appointments;
DROP TRIGGER IF EXISTS on_medication_reminder ON medications;

-- Remover funções existentes
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS notify_appointment_scheduled() CASCADE;
DROP FUNCTION IF EXISTS notify_exam_requested() CASCADE;
DROP FUNCTION IF EXISTS notify_exam_approved() CASCADE;
DROP FUNCTION IF EXISTS notify_appointment_approved() CASCADE;
DROP FUNCTION IF EXISTS create_medication_reminders() CASCADE;

-- Remover tabelas existentes (em ordem de dependência)
DROP TABLE IF EXISTS medication_schedules CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS exam_notifications CASCADE;
DROP TABLE IF EXISTS doctor_patients CASCADE;
DROP TABLE IF EXISTS hospital_doctors CASCADE;
DROP TABLE IF EXISTS medications CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ========================================
-- 2. CRIAR TABELAS PRINCIPAIS
-- ========================================

-- Tabela de perfis (complementa auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Dados básicos
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  
  -- Tipo de usuário
  user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin', 'hospital')) DEFAULT 'patient',
  
  -- Endereço
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'Brasil',
  
  -- Campos para médicos
  doctor_license TEXT,
  specialties TEXT[],
  hospital_id UUID,
  consultation_fee DECIMAL(10,2),
  
  -- Campos para hospitais
  hospital_name TEXT,
  hospital_address TEXT,
  hospital_phone TEXT,
  hospital_email TEXT,
  hospital_website TEXT,
  hospital_registration TEXT,
  hospital_type TEXT CHECK (hospital_type IN ('public', 'private', 'mixed')),
  
  -- Campos para pacientes
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  allergies TEXT[],
  chronic_conditions TEXT[],
  
  -- Configurações
  notifications_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Tabela de exames
CREATE TABLE exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Relacionamentos (sem foreign keys para evitar recursão)
  patient_id UUID NOT NULL,
  doctor_id UUID,
  hospital_id UUID,
  
  -- Dados do paciente (cache para performance)
  patient_email TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  
  -- Dados do exame
  exam_type TEXT NOT NULL,
  exam_category TEXT CHECK (exam_category IN ('laboratorio', 'imagem', 'cardiologia', 'neurologia', 'outros')),
  exam_date TIMESTAMP WITH TIME ZONE,
  exam_location TEXT,
  
  -- Resultados
  result_available BOOLEAN DEFAULT FALSE,
  result_date TIMESTAMP WITH TIME ZONE,
  result_details TEXT,
  result_file_url TEXT,
  result_summary TEXT,
  
  -- Observações
  notes TEXT,
  preparation_instructions TEXT,
  
  -- Status e controle
  status TEXT CHECK (status IN ('requested', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rejected')) DEFAULT 'requested',
  urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta', 'urgente')) DEFAULT 'media',
  preferred_date DATE,
  preferred_time TIME,
  
  -- Aprovação e agendamento
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  scheduled_by UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  
  -- Custos
  estimated_cost DECIMAL(10,2),
  final_cost DECIMAL(10,2),
  insurance_covered BOOLEAN DEFAULT FALSE,
  
  -- Lembretes
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de consultas
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Relacionamentos
  patient_id UUID NOT NULL,
  doctor_id UUID,
  hospital_id UUID,
  
  -- Dados da consulta
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60, -- em minutos
  location TEXT,
  room_number TEXT,
  
  -- Tipo e especialidade
  specialty TEXT,
  appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up', 'teleconsulta')) DEFAULT 'primeira-consulta',
  consultation_mode TEXT CHECK (consultation_mode IN ('presencial', 'online', 'telefone')) DEFAULT 'presencial',
  
  -- Status
  status TEXT CHECK (status IN ('requested', 'approved', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show')) DEFAULT 'scheduled',
  
  -- Observações
  notes TEXT,
  patient_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  
  -- Controle
  created_by TEXT CHECK (created_by IN ('patient', 'doctor', 'hospital', 'admin')) DEFAULT 'patient',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Confirmação
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  confirmed_by_patient BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Lembretes
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_2h_sent BOOLEAN DEFAULT FALSE,
  
  -- Custos
  consultation_fee DECIMAL(10,2),
  insurance_covered BOOLEAN DEFAULT FALSE,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded')) DEFAULT 'pending',
  
  -- Avaliação
  patient_rating INTEGER CHECK (patient_rating >= 1 AND patient_rating <= 5),
  patient_feedback TEXT,
  doctor_notes TEXT
);

-- Tabela de medicamentos
CREATE TABLE medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Relacionamentos
  patient_id UUID NOT NULL,
  doctor_id UUID,
  appointment_id UUID,
  
  -- Dados do medicamento
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT NOT NULL,
  unit TEXT, -- mg, ml, comprimidos, etc.
  frequency TEXT NOT NULL,
  frequency_times_per_day INTEGER,
  
  -- Período de uso
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  duration_days INTEGER,
  
  -- Instruções
  instructions TEXT,
  administration_route TEXT CHECK (administration_route IN ('oral', 'intravenosa', 'intramuscular', 'topica', 'inalacao', 'outros')),
  take_with_food BOOLEAN DEFAULT FALSE,
  
  -- Controle
  active BOOLEAN DEFAULT TRUE,
  prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  prescription_id TEXT,
  
  -- Alertas
  side_effects TEXT[],
  contraindications TEXT[],
  interactions TEXT[],
  
  -- Estoque
  quantity_prescribed INTEGER,
  quantity_remaining INTEGER,
  refills_allowed INTEGER DEFAULT 0,
  refills_used INTEGER DEFAULT 0,
  
  -- Lembretes
  reminder_enabled BOOLEAN DEFAULT TRUE,
  last_reminder_sent TIMESTAMP WITH TIME ZONE
);

-- Tabela de horários de medicamentos
CREATE TABLE medication_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Relacionamento
  medication_id UUID NOT NULL,
  
  -- Agendamento
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Controle de tomada
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMP WITH TIME ZONE,
  taken_quantity DECIMAL(5,2),
  
  -- Observações
  notes TEXT,
  side_effects_reported TEXT,
  
  -- Lembretes
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT CHECK (status IN ('scheduled', 'taken', 'missed', 'skipped')) DEFAULT 'scheduled'
);

-- Tabela de notificações
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Destinatário
  user_id UUID NOT NULL,
  user_email TEXT,
  
  -- Tipo e conteúdo
  type TEXT CHECK (type IN ('exam_result', 'exam_request', 'exam_approved', 'exam_scheduled', 'medication_reminder', 'appointment_reminder', 'appointment_request', 'appointment_approved', 'appointment_confirmed', 'system', 'payment', 'emergency')) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Relacionamentos
  related_id UUID, -- ID do exame, medicamento ou consulta relacionado
  related_type TEXT CHECK (related_type IN ('exam', 'appointment', 'medication', 'payment', 'system')),
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Prioridade
  priority TEXT CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')) DEFAULT 'normal',
  
  -- Canais de envio
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sent_at TIMESTAMP WITH TIME ZONE,
  push_sent BOOLEAN DEFAULT FALSE,
  push_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Ações
  action_url TEXT,
  action_label TEXT,
  
  -- Expiração
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de logs de email
CREATE TABLE email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Destinatário
  user_id UUID,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Conteúdo
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  template_used TEXT,
  
  -- Status de envio
  sent_successfully BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Relacionamentos
  related_id UUID,
  related_type TEXT,
  notification_id UUID,
  
  -- Tracking
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de relacionamento médico-paciente
CREATE TABLE doctor_patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Relacionamento
  doctor_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  relationship_type TEXT CHECK (relationship_type IN ('primary', 'specialist', 'consultant', 'emergency')) DEFAULT 'primary',
  
  -- Histórico
  first_appointment TIMESTAMP WITH TIME ZONE,
  last_appointment TIMESTAMP WITH TIME ZONE,
  total_appointments INTEGER DEFAULT 0,
  
  -- Observações
  notes TEXT,
  patient_preferences TEXT,
  
  -- Permissões
  can_prescribe BOOLEAN DEFAULT TRUE,
  can_order_exams BOOLEAN DEFAULT TRUE,
  can_access_history BOOLEAN DEFAULT TRUE,
  
  UNIQUE(doctor_id, patient_id)
);

-- Tabela de relacionamento hospital-médico
CREATE TABLE hospital_doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Relacionamento
  hospital_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  employment_type TEXT CHECK (employment_type IN ('employee', 'contractor', 'volunteer', 'resident')) DEFAULT 'employee',
  
  -- Cargo e departamento
  role TEXT,
  department TEXT,
  specialties TEXT[],
  
  -- Horários
  work_schedule JSONB, -- Horários de trabalho
  available_hours TEXT,
  
  -- Datas
  start_date DATE,
  end_date DATE,
  
  -- Permissões
  can_approve_exams BOOLEAN DEFAULT FALSE,
  can_schedule_appointments BOOLEAN DEFAULT TRUE,
  can_access_all_patients BOOLEAN DEFAULT FALSE,
  
  UNIQUE(hospital_id, doctor_id)
);

-- Tabela de configurações do sistema
CREATE TABLE system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Chave e valor
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT CHECK (setting_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  
  -- Metadados
  description TEXT,
  category TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Controle
  updated_by UUID,
  version INTEGER DEFAULT 1
);

-- ========================================
-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índices para profiles
CREATE INDEX idx_profiles_user_type ON profiles(user_type);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_active ON profiles(active);
CREATE INDEX idx_profiles_hospital_id ON profiles(hospital_id);

-- Índices para exams
CREATE INDEX idx_exams_patient_id ON exams(patient_id);
CREATE INDEX idx_exams_doctor_id ON exams(doctor_id);
CREATE INDEX idx_exams_hospital_id ON exams(hospital_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_exam_date ON exams(exam_date);
CREATE INDEX idx_exams_created_at ON exams(created_at);
CREATE INDEX idx_exams_urgency ON exams(urgency);

-- Índices para appointments
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_hospital_id ON appointments(hospital_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_created_at ON appointments(created_at);

-- Índices para medications
CREATE INDEX idx_medications_patient_id ON medications(patient_id);
CREATE INDEX idx_medications_doctor_id ON medications(doctor_id);
CREATE INDEX idx_medications_active ON medications(active);
CREATE INDEX idx_medications_start_date ON medications(start_date);
CREATE INDEX idx_medications_end_date ON medications(end_date);

-- Índices para medication_schedules
CREATE INDEX idx_medication_schedules_medication_id ON medication_schedules(medication_id);
CREATE INDEX idx_medication_schedules_date ON medication_schedules(scheduled_date);
CREATE INDEX idx_medication_schedules_datetime ON medication_schedules(scheduled_datetime);
CREATE INDEX idx_medication_schedules_taken ON medication_schedules(taken);

-- Índices para notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_related ON notifications(related_id, related_type);

-- Índices para email_logs
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_sent ON email_logs(sent_successfully);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);

-- Índices para relacionamentos
CREATE INDEX idx_doctor_patients_doctor ON doctor_patients(doctor_id);
CREATE INDEX idx_doctor_patients_patient ON doctor_patients(patient_id);
CREATE INDEX idx_doctor_patients_active ON doctor_patients(active);
CREATE INDEX idx_hospital_doctors_hospital ON hospital_doctors(hospital_id);
CREATE INDEX idx_hospital_doctors_doctor ON hospital_doctors(doctor_id);
CREATE INDEX idx_hospital_doctors_active ON hospital_doctors(active);

-- ========================================
-- 4. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 5. CRIAR POLÍTICAS RLS SEGURAS
-- ========================================

-- Políticas para profiles (simples para evitar recursão)
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para exams (sem referência a profiles para evitar recursão)
CREATE POLICY "exams_select_patient" ON exams FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "exams_insert_patient" ON exams FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "exams_select_doctor" ON exams FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "exams_update_doctor" ON exams FOR UPDATE USING (auth.uid() = doctor_id);
CREATE POLICY "exams_select_hospital" ON exams FOR SELECT USING (auth.uid() = hospital_id);
CREATE POLICY "exams_update_hospital" ON exams FOR UPDATE USING (auth.uid() = hospital_id);

-- Políticas para appointments
CREATE POLICY "appointments_select_patient" ON appointments FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "appointments_insert_patient" ON appointments FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "appointments_select_doctor" ON appointments FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "appointments_update_doctor" ON appointments FOR UPDATE USING (auth.uid() = doctor_id);
CREATE POLICY "appointments_select_hospital" ON appointments FOR SELECT USING (auth.uid() = hospital_id);
CREATE POLICY "appointments_update_hospital" ON appointments FOR UPDATE USING (auth.uid() = hospital_id);

-- Políticas para medications
CREATE POLICY "medications_select_patient" ON medications FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "medications_select_doctor" ON medications FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "medications_insert_doctor" ON medications FOR INSERT WITH CHECK (auth.uid() = doctor_id);
CREATE POLICY "medications_update_doctor" ON medications FOR UPDATE USING (auth.uid() = doctor_id);

-- Políticas para medication_schedules
CREATE POLICY "medication_schedules_select_patient" ON medication_schedules FOR SELECT 
USING (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.patient_id = auth.uid()));
CREATE POLICY "medication_schedules_update_patient" ON medication_schedules FOR UPDATE 
USING (EXISTS (SELECT 1 FROM medications WHERE medications.id = medication_schedules.medication_id AND medications.patient_id = auth.uid()));

-- Políticas para notifications
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT WITH CHECK (true); -- Permite inserção pelo sistema

-- Políticas para email_logs
CREATE POLICY "email_logs_select_own" ON email_logs FOR SELECT USING (auth.uid() = user_id);

-- Políticas para relacionamentos
CREATE POLICY "doctor_patients_select_doctor" ON doctor_patients FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "doctor_patients_select_patient" ON doctor_patients FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "doctor_patients_insert_doctor" ON doctor_patients FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "hospital_doctors_select_hospital" ON hospital_doctors FOR SELECT USING (auth.uid() = hospital_id);
CREATE POLICY "hospital_doctors_select_doctor" ON hospital_doctors FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "hospital_doctors_insert_hospital" ON hospital_doctors FOR INSERT WITH CHECK (auth.uid() = hospital_id);

-- Políticas para system_settings (apenas admins)
CREATE POLICY "system_settings_select_public" ON system_settings FOR SELECT USING (is_public = true);

-- ========================================
-- 6. CRIAR FUNÇÕES UTILITÁRIAS
-- ========================================

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
    COALESCE(new.raw_user_meta_data->>'user_type', 'patient')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar notificação
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_content TEXT,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, related_id, related_type, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_content, p_related_id, p_related_type, p_priority
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar horários de medicamento
CREATE OR REPLACE FUNCTION create_medication_schedules(
  p_medication_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_times_per_day INTEGER,
  p_schedule_times TIME[]
) RETURNS INTEGER AS $$
DECLARE
  current_date DATE;
  schedule_time TIME;
  schedules_created INTEGER := 0;
BEGIN
  current_date := p_start_date;
  
  WHILE current_date <= p_end_date LOOP
    FOREACH schedule_time IN ARRAY p_schedule_times LOOP
      INSERT INTO medication_schedules (
        medication_id,
        scheduled_date,
        scheduled_time,
        scheduled_datetime
      ) VALUES (
        p_medication_id,
        current_date,
        schedule_time,
        current_date + schedule_time
      );
      schedules_created := schedules_created + 1;
    END LOOP;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN schedules_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular próxima consulta disponível
CREATE OR REPLACE FUNCTION get_next_available_slot(
  p_doctor_id UUID,
  p_duration INTEGER DEFAULT 60,
  p_start_date DATE DEFAULT CURRENT_DATE
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  next_slot TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Lógica simplificada - retorna próximo horário comercial disponível
  SELECT 
    CASE 
      WHEN EXTRACT(DOW FROM p_start_date) IN (0, 6) THEN -- Weekend
        (p_start_date + INTERVAL '1 day' * (8 - EXTRACT(DOW FROM p_start_date))) + TIME '09:00:00'
      ELSE -- Weekday
        p_start_date + TIME '09:00:00'
    END
  INTO next_slot;
  
  -- Verificar se horário está ocupado (simplificado)
  WHILE EXISTS (
    SELECT 1 FROM appointments 
    WHERE doctor_id = p_doctor_id 
    AND appointment_date = next_slot
    AND status NOT IN ('cancelled', 'completed')
  ) LOOP
    next_slot := next_slot + INTERVAL '1 hour';
  END LOOP;
  
  RETURN next_slot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 7. CRIAR TRIGGERS
-- ========================================

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para notificação de novo exame
CREATE OR REPLACE FUNCTION notify_new_exam() RETURNS TRIGGER AS $$
BEGIN
  -- Notificar paciente
  PERFORM create_notification(
    NEW.patient_id,
    'exam_request',
    'Solicitação de Exame Recebida',
    'Sua solicitação de exame (' || NEW.exam_type || ') foi recebida e está sendo processada.',
    NEW.id,
    'exam',
    CASE NEW.urgency 
      WHEN 'urgente' THEN 'urgente'
      WHEN 'alta' THEN 'alta'
      ELSE 'normal'
    END
  );
  
  -- Notificar médico se especificado
  IF NEW.doctor_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.doctor_id,
      'exam_request',
      'Nova Solicitação de Exame',
      'Nova solicitação de exame (' || NEW.exam_type || ') de um paciente.',
      NEW.id,
      'exam',
      'normal'
    );
  END IF;
  
  -- Notificar hospital se especificado
  IF NEW.hospital_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.hospital_id,
      'exam_request',
      'Nova Solicitação de Exame',
      'Nova solicitação de exame (' || NEW.exam_type || ') recebida.',
      NEW.id,
      'exam',
      'normal'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_exam_created
  AFTER INSERT ON exams
  FOR EACH ROW EXECUTE FUNCTION notify_new_exam();

-- Trigger para notificação de status de exame
CREATE OR REPLACE FUNCTION notify_exam_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        PERFORM create_notification(
          NEW.patient_id,
          'exam_approved',
          'Exame Aprovado',
          'Seu exame (' || NEW.exam_type || ') foi aprovado e está pronto para agendamento.',
          NEW.id,
          'exam',
          'alta'
        );
      WHEN 'scheduled' THEN
        PERFORM create_notification(
          NEW.patient_id,
          'exam_scheduled',
          'Exame Agendado',
          'Seu exame (' || NEW.exam_type || ') foi agendado para ' || 
          TO_CHAR(NEW.exam_date, 'DD/MM/YYYY às HH24:MI') || '.',
          NEW.id,
          'exam',
          'alta'
        );
      WHEN 'completed' THEN
        PERFORM create_notification(
          NEW.patient_id,
          'exam_result',
          'Resultado de Exame Disponível',
          'O resultado do seu exame (' || NEW.exam_type || ') está disponível.',
          NEW.id,
          'exam',
          'alta'
        );
      WHEN 'cancelled' THEN
        PERFORM create_notification(
          NEW.patient_id,
          'exam_result',
          'Exame Cancelado',
          'Seu exame (' || NEW.exam_type || ') foi cancelado.',
          NEW.id,
          'exam',
          'normal'
        );
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_exam_status_changed
  AFTER UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION notify_exam_status_change();

-- Trigger para notificação de nova consulta
CREATE OR REPLACE FUNCTION notify_new_appointment() RETURNS TRIGGER AS $$
BEGIN
  -- Notificar paciente
  PERFORM create_notification(
    NEW.patient_id,
    'appointment_request',
    'Consulta Agendada',
    'Sua consulta foi agendada para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI') || '.',
    NEW.id,
    'appointment',
    'normal'
  );
  
  -- Notificar médico
  IF NEW.doctor_id IS NOT NULL AND NEW.created_by = 'patient' THEN
    PERFORM create_notification(
      NEW.doctor_id,
      'appointment_request',
      'Nova Solicitação de Consulta',
      'Nova solicitação de consulta para ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY às HH24:MI') || '.',
      NEW.id,
      'appointment',
      'normal'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_appointment_created
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION notify_new_appointment();

-- Trigger para criar horários de medicamento
CREATE OR REPLACE FUNCTION auto_create_medication_schedules() RETURNS TRIGGER AS $$
DECLARE
  schedule_times TIME[];
  days_duration INTEGER;
BEGIN
  -- Calcular duração em dias
  days_duration := COALESCE(NEW.duration_days, 
    EXTRACT(DAYS FROM (NEW.end_date - NEW.start_date))::INTEGER + 1
  );
  
  -- Definir horários baseado na frequência
  CASE NEW.frequency_times_per_day
    WHEN 1 THEN schedule_times := ARRAY['08:00:00'::TIME];
    WHEN 2 THEN schedule_times := ARRAY['08:00:00'::TIME, '20:00:00'::TIME];
    WHEN 3 THEN schedule_times := ARRAY['08:00:00'::TIME, '14:00:00'::TIME, '20:00:00'::TIME];
    WHEN 4 THEN schedule_times := ARRAY['08:00:00'::TIME, '12:00:00'::TIME, '16:00:00'::TIME, '20:00:00'::TIME];
    ELSE schedule_times := ARRAY['08:00:00'::TIME]; -- Default
  END CASE;
  
  -- Criar horários se temos as informações necessárias
  IF NEW.frequency_times_per_day > 0 AND days_duration > 0 THEN
    PERFORM create_medication_schedules(
      NEW.id,
      NEW.start_date::DATE,
      (NEW.start_date::DATE + (days_duration - 1)),
      NEW.frequency_times_per_day,
      schedule_times
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_medication_created
  AFTER INSERT ON medications
  FOR EACH ROW EXECUTE FUNCTION auto_create_medication_schedules();

-- ========================================
-- 8. INSERIR CONFIGURAÇÕES PADRÃO
-- ========================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, is_public) VALUES
('app_name', 'Sistema de Gestão de Saúde', 'string', 'Nome da aplicação', 'general', true),
('app_version', '1.0.0', 'string', 'Versão da aplicação', 'general', true),
('maintenance_mode', 'false', 'boolean', 'Modo de manutenção', 'general', false),
('max_appointments_per_day', '20', 'number', 'Máximo de consultas por dia por médico', 'appointments', false),
('appointment_reminder_hours', '24,2', 'string', 'Horas antes da consulta para enviar lembretes', 'notifications', false),
('medication_reminder_enabled', 'true', 'boolean', 'Habilitar lembretes de medicamento', 'medications', false),
('exam_approval_required', 'true', 'boolean', 'Exames precisam de aprovação', 'exams', false),
('email_notifications_enabled', 'true', 'boolean', 'Habilitar notificações por email', 'notifications', false),
('sms_notifications_enabled', 'false', 'boolean', 'Habilitar notificações por SMS', 'notifications', false),
('default_appointment_duration', '60', 'number', 'Duração padrão da consulta em minutos', 'appointments', false);

-- ========================================
-- 9. INSERIR DADOS DE EXEMPLO
-- ========================================

-- Inserir tipos de exames comuns
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, is_public) VALUES
('exam_types', '["Hemograma Completo", "Glicemia", "Colesterol Total", "Raio-X Tórax", "Ultrassom Abdominal", "Eletrocardiograma", "Ressonância Magnética", "Tomografia Computadorizada", "Mamografia", "Colonoscopia", "Endoscopia", "Ecocardiograma"]', 'json', 'Tipos de exames disponíveis', 'exams', true),
('specialties', '["Cardiologia", "Dermatologia", "Endocrinologia", "Gastroenterologia", "Ginecologia", "Neurologia", "Oftalmologia", "Ortopedia", "Pediatria", "Psiquiatria", "Urologia", "Clínica Geral"]', 'json', 'Especialidades médicas', 'doctors', true),
('blood_types', '["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]', 'json', 'Tipos sanguíneos', 'patients', true);

-- ========================================
-- 10. CRIAR VIEWS ÚTEIS
-- ========================================

-- View para dashboard do paciente
CREATE OR REPLACE VIEW patient_dashboard AS
SELECT 
  p.id,
  p.full_name,
  p.email,
  -- Próximas consultas
  (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id AND a.appointment_date > now() AND a.status IN ('scheduled', 'confirmed')) as upcoming_appointments,
  -- Exames pendentes
  (SELECT COUNT(*) FROM exams e WHERE e.patient_id = p.id AND e.status IN ('requested', 'approved', 'scheduled')) as pending_exams,
  -- Medicamentos ativos
  (SELECT COUNT(*) FROM medications m WHERE m.patient_id = p.id AND m.active = true AND (m.end_date IS NULL OR m.end_date > now())) as active_medications,
  -- Notificações não lidas
  (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p.id AND n.read = false) as unread_notifications,
  -- Última consulta
  (SELECT MAX(a.appointment_date) FROM appointments a WHERE a.patient_id = p.id AND a.status = 'completed') as last_appointment,
  -- Próxima consulta
  (SELECT MIN(a.appointment_date) FROM appointments a WHERE a.patient_id = p.id AND a.appointment_date > now() AND a.status IN ('scheduled', 'confirmed')) as next_appointment
FROM profiles p
WHERE p.user_type = 'patient';

-- View para dashboard do médico
CREATE OR REPLACE VIEW doctor_dashboard AS
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.specialties,
  -- Consultas hoje
  (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = p.id AND DATE(a.appointment_date) = CURRENT_DATE AND a.status IN ('scheduled', 'confirmed')) as appointments_today,
  -- Consultas esta semana
  (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = p.id AND a.appointment_date >= date_trunc('week', now()) AND a.appointment_date < date_trunc('week', now()) + interval '1 week' AND a.status IN ('scheduled', 'confirmed')) as appointments_this_week,
  -- Pacientes ativos
  (SELECT COUNT(*) FROM doctor_patients dp WHERE dp.doctor_id = p.id AND dp.active = true) as active_patients,
  -- Exames para aprovar
  (SELECT COUNT(*) FROM exams e WHERE e.doctor_id = p.id AND e.status = 'requested') as exams_to_approve,
  -- Próxima consulta
  (SELECT MIN(a.appointment_date) FROM appointments a WHERE a.doctor_id = p.id AND a.appointment_date > now() AND a.status IN ('scheduled', 'confirmed')) as next_appointment
FROM profiles p
WHERE p.user_type = 'doctor';

-- View para relatórios
CREATE OR REPLACE VIEW appointment_stats AS
SELECT 
  DATE(appointment_date) as date,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_appointments,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_appointments,
  COUNT(*) FILTER (WHERE status = 'no_show') as no_show_appointments,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_booking_to_appointment_hours
FROM appointments
WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(appointment_date)
ORDER BY date DESC;

-- ========================================
-- 11. VERIFICAÇÕES FINAIS
-- ========================================

-- Verificar se todas as tabelas foram criadas
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN ('profiles', 'exams', 'appointments', 'medications', 'medication_schedules', 'notifications', 'email_logs', 'doctor_patients', 'hospital_doctors', 'system_settings')
ORDER BY table_name;

-- Verificar políticas RLS
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Verificar índices
SELECT 
  tablename,
  COUNT(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'exams', 'appointments', 'medications', 'medication_schedules', 'notifications', 'email_logs', 'doctor_patients', 'hospital_doctors')
GROUP BY tablename
ORDER BY tablename;

-- Verificar triggers
SELECT 
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verificar funções criadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'create_notification', 'create_medication_schedules', 'get_next_available_slot')
ORDER BY routine_name;

-- Mensagem de sucesso
SELECT 
  '🎉 SISTEMA DE GESTÃO DE SAÚDE INSTALADO COM SUCESSO!' as status,
  'Todas as tabelas, índices, políticas RLS, triggers e funções foram criados.' as details,
  'O sistema está pronto para uso!' as ready;

-- Estatísticas finais
SELECT 
  'Tabelas criadas: ' || COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 
  'Políticas RLS criadas: ' || COUNT(*) as policies_created
FROM pg_policies 
WHERE schemaname = 'public';

SELECT 
  'Índices criados: ' || COUNT(*) as indexes_created
FROM pg_indexes 
WHERE schemaname = 'public';

SELECT 
  'Triggers criados: ' || COUNT(*) as triggers_created
FROM information_schema.triggers
WHERE event_object_schema = 'public';

SELECT 
  'Funções criadas: ' || COUNT(*) as functions_created
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
