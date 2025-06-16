-- CRIAR TABELA DE EXAMES COMPLETAMENTE INDEPENDENTE
-- Esta tabela não terá nenhuma dependência da tabela profiles

-- 1. Remover tabela exams existente se houver problemas
DROP TABLE IF EXISTS exams CASCADE;

-- 2. Criar nova tabela exams sem foreign keys problemáticas
CREATE TABLE exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Dados do paciente (sem foreign key)
  patient_id UUID NOT NULL,
  patient_email TEXT,
  patient_name TEXT,
  
  -- Dados do exame
  exam_type TEXT NOT NULL,
  exam_date TIMESTAMP WITH TIME ZONE,
  result_available BOOLEAN DEFAULT FALSE,
  result_date TIMESTAMP WITH TIME ZONE,
  result_details TEXT,
  result_file_url TEXT,
  notes TEXT,
  
  -- Status e controle
  status TEXT CHECK (status IN ('requested', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested',
  urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  preferred_date DATE,
  
  -- Campos de aprovação (sem foreign keys)
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  scheduled_by UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  
  -- IDs opcionais (sem foreign keys)
  doctor_id UUID,
  hospital_id UUID
);

-- 3. Desabilitar RLS completamente
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;

-- 4. Criar índices para performance
CREATE INDEX idx_exams_patient_id ON exams(patient_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_created_at ON exams(created_at);

-- 5. Criar tabela de notificações independente
DROP TABLE IF EXISTS exam_notifications CASCADE;

CREATE TABLE exam_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Dados do usuário (sem foreign key)
  user_id UUID NOT NULL,
  user_email TEXT,
  
  -- Dados da notificação
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Referência ao exame (sem foreign key)
  exam_id UUID,
  
  -- Prioridade
  priority TEXT CHECK (priority IN ('baixa', 'normal', 'alta')) DEFAULT 'normal'
);

-- 6. Desabilitar RLS na tabela de notificações
ALTER TABLE exam_notifications DISABLE ROW LEVEL SECURITY;

-- 7. Criar índices
CREATE INDEX idx_exam_notifications_user_id ON exam_notifications(user_id);
CREATE INDEX idx_exam_notifications_read ON exam_notifications(read);

-- 8. Verificar se as tabelas foram criadas
SELECT 'Tabelas independentes criadas com sucesso!' as status;

-- Verificar estrutura
\d exams;
\d exam_notifications;
