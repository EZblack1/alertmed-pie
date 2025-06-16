-- Atualizar schema para suporte a acesso profissional
-- Executar este script para configurar o acesso de médicos e hospitais

-- Adicionar campos para identificação profissional
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id),
ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id),
ADD COLUMN IF NOT EXISTS professional_license VARCHAR(50),
ADD COLUMN IF NOT EXISTS specialization TEXT,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_doctor_id ON profiles(doctor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hospital_id ON profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);

-- Atualizar políticas RLS para médicos
CREATE POLICY "doctors_can_read_own_patients" ON appointments
FOR SELECT USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p 
    WHERE p.doctor_id = appointments.doctor_id
  )
);

CREATE POLICY "doctors_can_update_own_appointments" ON appointments
FOR UPDATE USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p 
    WHERE p.doctor_id = appointments.doctor_id
  )
);

-- Políticas para hospitais/clínicas
CREATE POLICY "hospital_admins_can_manage_appointments" ON appointments
FOR ALL USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p 
    WHERE p.user_type = 'admin' AND p.hospital_id IS NOT NULL
  )
);

-- Políticas para exames
CREATE POLICY "doctors_can_manage_exams" ON exams
FOR ALL USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p 
    WHERE p.doctor_id IS NOT NULL
  )
);

CREATE POLICY "hospital_admins_can_manage_exams" ON exams
FOR ALL USING (
  auth.uid() IN (
    SELECT p.id FROM profiles p 
    WHERE p.user_type = 'admin' AND p.hospital_id IS NOT NULL
  )
);

-- Função para verificar se usuário é médico
CREATE OR REPLACE FUNCTION is_doctor(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND doctor_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é admin hospitalar
CREATE OR REPLACE FUNCTION is_hospital_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND user_type = 'admin' AND hospital_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserir dados de exemplo para médicos
INSERT INTO doctors (id, name, specialty, crm, email, phone) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Dr. João Silva', 'Cardiologia', 'CRM-SP 123456', 'joao.silva@hospital.com', '(11) 99999-0001'),
('550e8400-e29b-41d4-a716-446655440002', 'Dra. Maria Santos', 'Pediatria', 'CRM-SP 123457', 'maria.santos@hospital.com', '(11) 99999-0002'),
('550e8400-e29b-41d4-a716-446655440003', 'Dr. Carlos Oliveira', 'Ortopedia', 'CRM-SP 123458', 'carlos.oliveira@hospital.com', '(11) 99999-0003')
ON CONFLICT (id) DO NOTHING;

-- Inserir dados de exemplo para hospitais
INSERT INTO hospitals (id, name, address, phone, email) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Hospital São Paulo', 'Rua das Flores, 123 - São Paulo, SP', '(11) 3333-0001', 'contato@hospitalsaopaulo.com'),
('660e8400-e29b-41d4-a716-446655440002', 'Clínica Vida Nova', 'Av. Paulista, 456 - São Paulo, SP', '(11) 3333-0002', 'contato@clinicavidanova.com')
ON CONFLICT (id) DO NOTHING;

-- Criar usuários de exemplo para médicos (senha: 123456)
-- Nota: Em produção, use senhas mais seguras
DO $$
DECLARE
    doctor_user_id UUID;
    hospital_user_id UUID;
BEGIN
    -- Criar perfil para médico (será vinculado após criação do usuário)
    INSERT INTO profiles (id, full_name, phone, user_type, doctor_id, professional_license, specialization, is_verified)
    VALUES 
    ('770e8400-e29b-41d4-a716-446655440001', 'Dr. João Silva', '(11) 99999-0001', 'doctor', '550e8400-e29b-41d4-a716-446655440001', 'CRM-SP 123456', 'Cardiologia', true),
    ('770e8400-e29b-41d4-a716-446655440002', 'Dra. Maria Santos', '(11) 99999-0002', 'doctor', '550e8400-e29b-41d4-a716-446655440002', 'CRM-SP 123457', 'Pediatria', true)
    ON CONFLICT (id) DO NOTHING;

    -- Criar perfil para admin hospitalar
    INSERT INTO profiles (id, full_name, phone, user_type, hospital_id, is_verified)
    VALUES 
    ('880e8400-e29b-41d4-a716-446655440001', 'Admin Hospital São Paulo', '(11) 3333-0001', 'admin', '660e8400-e29b-41d4-a716-446655440001', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Comentários para orientação
COMMENT ON COLUMN profiles.doctor_id IS 'Referência ao médico se o usuário for um médico';
COMMENT ON COLUMN profiles.hospital_id IS 'Referência ao hospital se o usuário for admin hospitalar';
COMMENT ON COLUMN profiles.professional_license IS 'Número da licença profissional (CRM, etc.)';
COMMENT ON COLUMN profiles.specialization IS 'Especialização médica';
COMMENT ON COLUMN profiles.is_verified IS 'Se o profissional foi verificado pelo sistema';
