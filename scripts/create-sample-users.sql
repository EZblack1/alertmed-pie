-- Script separado para criar usuários de exemplo
-- Este script deve ser executado APÓS o schema principal

-- Função para criar usuários de exemplo (apenas para desenvolvimento)
-- ATENÇÃO: Este script é apenas para desenvolvimento/teste
-- NÃO execute em produção

DO $$
DECLARE
  doctor_id1 UUID;
  doctor_id2 UUID;
  hospital_id1 UUID;
  patient_id1 UUID;
  patient_id2 UUID;
BEGIN
  -- Verificar se já existem usuários de exemplo
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'joao.silva@example.com') THEN
    
    -- Criar IDs fixos para os usuários de exemplo
    doctor_id1 := '11111111-1111-1111-1111-111111111111'::UUID;
    doctor_id2 := '22222222-2222-2222-2222-222222222222'::UUID;
    hospital_id1 := '33333333-3333-3333-3333-333333333333'::UUID;
    patient_id1 := '44444444-4444-4444-4444-444444444444'::UUID;
    patient_id2 := '55555555-5555-5555-5555-555555555555'::UUID;
    
    -- Inserir usuários na tabela auth.users (simulando cadastro)
    -- NOTA: Em produção, isso seria feito através do sistema de autenticação
    INSERT INTO auth.users (
      id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
      created_at, 
      updated_at,
      raw_user_meta_data
    ) VALUES 
      (
        doctor_id1, 
        'joao.silva@example.com', 
        crypt('123456', gen_salt('bf')), 
        now(), 
        now(), 
        now(),
        '{"full_name": "Dr. João Silva", "user_type": "doctor"}'::jsonb
      ),
      (
        doctor_id2, 
        'maria.santos@example.com', 
        crypt('123456', gen_salt('bf')), 
        now(), 
        now(), 
        now(),
        '{"full_name": "Dra. Maria Santos", "user_type": "doctor"}'::jsonb
      ),
      (
        hospital_id1, 
        'contato@hospitalsp.com', 
        crypt('123456', gen_salt('bf')), 
        now(), 
        now(), 
        now(),
        '{"full_name": "Hospital São Paulo", "user_type": "hospital"}'::jsonb
      ),
      (
        patient_id1, 
        'carlos@example.com', 
        crypt('123456', gen_salt('bf')), 
        now(), 
        now(), 
        now(),
        '{"full_name": "Carlos Oliveira", "user_type": "patient"}'::jsonb
      ),
      (
        patient_id2, 
        'ana@example.com', 
        crypt('123456', gen_salt('bf')), 
        now(), 
        now(), 
        now(),
        '{"full_name": "Ana Pereira", "user_type": "patient"}'::jsonb
      )
    ON CONFLICT (id) DO NOTHING;
    
    -- Inserir perfis correspondentes
    INSERT INTO profiles (
      id, 
      full_name, 
      email, 
      user_type, 
      doctor_license, 
      specialties,
      hospital_name,
      hospital_address,
      hospital_registration,
      date_of_birth
    ) VALUES 
      (
        doctor_id1, 
        'Dr. João Silva', 
        'joao.silva@example.com', 
        'doctor', 
        'CRM-12345', 
        ARRAY['Cardiologia', 'Clínica Geral'],
        NULL, NULL, NULL, NULL
      ),
      (
        doctor_id2, 
        'Dra. Maria Santos', 
        'maria.santos@example.com', 
        'doctor', 
        'CRM-54321', 
        ARRAY['Pediatria', 'Alergologia'],
        NULL, NULL, NULL, NULL
      ),
      (
        hospital_id1, 
        'Hospital São Paulo', 
        'contato@hospitalsp.com', 
        'hospital', 
        NULL, 
        NULL,
        'Hospital São Paulo',
        'Av. Paulista, 1000, São Paulo - SP',
        'CNPJ-12345678901234',
        NULL
      ),
      (
        patient_id1, 
        'Carlos Oliveira', 
        'carlos@example.com', 
        'patient', 
        NULL, 
        NULL,
        NULL, NULL, NULL,
        '1980-05-15'
      ),
      (
        patient_id2, 
        'Ana Pereira', 
        'ana@example.com', 
        'patient', 
        NULL, 
        NULL,
        NULL, NULL, NULL,
        '1992-10-20'
      )
    ON CONFLICT (id) DO NOTHING;
    
    -- Criar relacionamentos médico-paciente
    INSERT INTO doctor_patients (doctor_id, patient_id, active)
    VALUES 
      (doctor_id1, patient_id1, true),
      (doctor_id1, patient_id2, true),
      (doctor_id2, patient_id2, true)
    ON CONFLICT (doctor_id, patient_id) DO NOTHING;
    
    -- Criar relacionamentos hospital-médico
    INSERT INTO hospital_doctors (hospital_id, doctor_id, department, active)
    VALUES 
      (hospital_id1, doctor_id1, 'Cardiologia', true),
      (hospital_id1, doctor_id2, 'Pediatria', true)
    ON CONFLICT (hospital_id, doctor_id) DO NOTHING;
    
    -- Criar consultas de exemplo
    INSERT INTO appointments (
      patient_id, 
      doctor_id, 
      hospital_id, 
      appointment_date, 
      status, 
      specialty, 
      appointment_type, 
      created_by,
      notes
    ) VALUES 
      (
        patient_id1, 
        doctor_id1, 
        hospital_id1, 
        NOW() + INTERVAL '2 days', 
        'scheduled', 
        'Cardiologia', 
        'primeira-consulta', 
        'patient',
        'Consulta de rotina para check-up cardíaco'
      ),
      (
        patient_id2, 
        doctor_id2, 
        hospital_id1, 
        NOW() + INTERVAL '3 days', 
        'scheduled', 
        'Pediatria', 
        'retorno', 
        'doctor',
        'Acompanhamento do desenvolvimento infantil'
      )
    ON CONFLICT DO NOTHING;
    
    -- Criar exames de exemplo
    INSERT INTO exams (
      patient_id, 
      doctor_id, 
      hospital_id, 
      exam_type, 
      status, 
      urgency,
      notes
    ) VALUES 
      (
        patient_id1, 
        doctor_id1, 
        hospital_id1, 
        'Eletrocardiograma', 
        'requested', 
        'media',
        'Exame solicitado para avaliação cardíaca'
      ),
      (
        patient_id2, 
        doctor_id2, 
        hospital_id1, 
        'Hemograma Completo', 
        'scheduled', 
        'baixa',
        'Exame de rotina para acompanhamento'
      )
    ON CONFLICT DO NOTHING;
    
    -- Criar algumas notificações de exemplo
    INSERT INTO notifications (
      user_id, 
      type, 
      content, 
      priority,
      read
    ) VALUES 
      (
        patient_id1, 
        'appointment_reminder', 
        'Lembrete: Você tem uma consulta agendada para amanhã às 14:00', 
        'alta',
        false
      ),
      (
        patient_id2, 
        'exam_result', 
        'Resultado do seu exame está disponível', 
        'normal',
        false
      ),
      (
        doctor_id1, 
        'appointment_request', 
        'Nova solicitação de consulta recebida', 
        'normal',
        false
      )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Usuários de exemplo criados com sucesso!';
    RAISE NOTICE 'Credenciais de teste:';
    RAISE NOTICE 'Médico: joao.silva@example.com / 123456';
    RAISE NOTICE 'Médico: maria.santos@example.com / 123456';
    RAISE NOTICE 'Hospital: contato@hospitalsp.com / 123456';
    RAISE NOTICE 'Paciente: carlos@example.com / 123456';
    RAISE NOTICE 'Paciente: ana@example.com / 123456';
    
  ELSE
    RAISE NOTICE 'Usuários de exemplo já existem no sistema.';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao criar usuários de exemplo: %', SQLERRM;
    RAISE NOTICE 'Isso é normal se você não tiver acesso à tabela auth.users';
    RAISE NOTICE 'Os usuários devem ser criados através do sistema de autenticação normal.';
END $$;
