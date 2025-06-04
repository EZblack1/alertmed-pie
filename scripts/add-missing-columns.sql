-- Script para adicionar apenas as colunas que estão faltando nas tabelas existentes

-- Adicionar colunas na tabela profiles se não existirem
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')) DEFAULT 'patient';

-- Adicionar colunas na tabela exams se não existirem
ALTER TABLE exams ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS preferred_date DATE;

-- Adicionar colunas na tabela appointments se não existirem
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela email_logs se não existir
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

-- Habilitar RLS na tabela email_logs se não estiver habilitado
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Atualizar registros existentes com valores padrão
UPDATE profiles SET user_type = 'patient' WHERE user_type IS NULL;
UPDATE exams SET status = 'requested' WHERE status IS NULL;
UPDATE exams SET urgency = 'media' WHERE urgency IS NULL;
UPDATE appointments SET appointment_type = 'primeira-consulta' WHERE appointment_type IS NULL;
UPDATE appointments SET confirmation_sent = FALSE WHERE confirmation_sent IS NULL;

-- Verificar se as colunas foram adicionadas corretamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'exams', 'appointments', 'email_logs')
  AND table_schema = 'public'
  AND column_name IN (
    'user_type', 'status', 'urgency', 'preferred_date', 
    'specialty', 'appointment_type', 'confirmation_sent', 'confirmation_sent_at'
  )
ORDER BY table_name, column_name;
