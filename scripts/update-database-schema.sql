-- Atualizar schema do banco de dados para suportar agendamentos e solicitações

-- Adicionar campos para controle de solicitações de exames
ALTER TABLE exams ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS preferred_date DATE;

-- Adicionar campos para controle de consultas
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela para controle de emails enviados
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

-- Adicionar políticas RLS para email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios logs de email" 
  ON email_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Adicionar política para permitir inserção de consultas por pacientes
CREATE POLICY "Pacientes podem inserir suas próprias consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

-- Adicionar política para permitir inserção de exames por pacientes
CREATE POLICY "Pacientes podem inserir seus próprios exames" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

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
