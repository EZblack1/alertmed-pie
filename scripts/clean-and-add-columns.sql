-- Script mais simples para apenas adicionar colunas faltantes sem recriar políticas

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

-- Adicionar política para email_logs se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'email_logs' 
    AND policyname = 'email_logs_select_own'
  ) THEN
    CREATE POLICY "email_logs_select_own" 
      ON email_logs FOR SELECT 
      USING (auth.uid() = user_id);
  END IF;
END $$;

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
    'created_at', 'user_type', 'status', 'urgency', 'preferred_date', 
    'specialty', 'appointment_type', 'confirmation_sent', 'confirmation_sent_at'
  )
ORDER BY table_name, column_name;
