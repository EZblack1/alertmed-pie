-- Verificar e corrigir estrutura da tabela exams

-- Garantir que a tabela exams existe com todas as colunas necessárias
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  status TEXT CHECK (status IN ('requested', 'scheduled', 'completed', 'cancelled')) DEFAULT 'requested',
  urgency TEXT CHECK (urgency IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  preferred_date DATE,
  scheduled_date TIMESTAMPTZ,
  result_available BOOLEAN DEFAULT FALSE,
  result_file_url TEXT,
  notes TEXT,
  doctor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para exams
DROP POLICY IF EXISTS "exams_select_policy" ON exams;
DROP POLICY IF EXISTS "exams_insert_policy" ON exams;
DROP POLICY IF EXISTS "exams_update_policy" ON exams;

CREATE POLICY "exams_select_policy" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "exams_insert_policy" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "exams_update_policy" 
  ON exams FOR UPDATE 
  USING (auth.uid() = patient_id);

-- Política para médicos e hospitais verem todos os exames
CREATE POLICY "exams_medical_access" 
  ON exams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type IN ('doctor', 'admin')
    )
  );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS exams_patient_id_idx ON exams(patient_id);
CREATE INDEX IF NOT EXISTS exams_status_idx ON exams(status);
CREATE INDEX IF NOT EXISTS exams_created_at_idx ON exams(created_at);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_exams_updated_at ON exams;
CREATE TRIGGER update_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
