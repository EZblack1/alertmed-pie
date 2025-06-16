# 📚 **Documentação das APIs - AlertMed**

## 🏥 **APIs para Médicos**

### **Autenticação**
Todas as rotas requerem autenticação via Supabase Auth e perfil de usuário com `user_type = "doctor"`.

### **📅 Consultas**

#### **GET /api/doctor/appointments**
Lista consultas do médico autenticado.

**Parâmetros de Query:**
- `status` (opcional): Filtrar por status (`scheduled`, `completed`, `cancelled`, `rescheduled`)
- `date` (opcional): Filtrar por data específica (YYYY-MM-DD)
- `limit` (opcional): Número máximo de resultados (padrão: 50)
- `offset` (opcional): Offset para paginação (padrão: 0)

**Resposta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "appointment_date": "2024-01-15T10:00:00Z",
      "duration": 60,
      "status": "scheduled",
      "specialty": "Cardiologia",
      "appointment_type": "primeira-consulta",
      "notes": "Paciente com histórico de hipertensão",
      "location": "Consultório 101",
      "patient": {
        "id": "uuid",
        "full_name": "João Silva",
        "email": "joao@email.com",
        "phone": "(11) 99999-9999"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 25
  }
}
\`\`\`

#### **POST /api/doctor/appointments**
Agenda nova consulta como médico.

**Body:**
\`\`\`json
{
  "patient_id": "uuid",
  "appointment_date": "2024-01-15T10:00:00Z",
  "duration": 60,
  "specialty": "Cardiologia",
  "appointment_type": "primeira-consulta",
  "notes": "Consulta de rotina",
  "location": "Consultório 101"
}
\`\`\`

#### **GET /api/doctor/appointments/[id]**
Busca consulta específica.

#### **PUT /api/doctor/appointments/[id]**
Atualiza consulta existente.

#### **DELETE /api/doctor/appointments/[id]**
Cancela consulta (marca como `cancelled`).

### **🔬 Exames**

#### **GET /api/doctor/exams**
Lista exames do médico autenticado.

**Parâmetros de Query:**
- `status` (opcional): Filtrar por status
- `patient_id` (opcional): Filtrar por paciente
- `exam_type` (opcional): Filtrar por tipo de exame
- `limit` (opcional): Número máximo de resultados
- `offset` (opcional): Offset para paginação

#### **POST /api/doctor/exams**
Solicita novo exame como médico.

**Body:**
\`\`\`json
{
  "patient_id": "uuid",
  "exam_type": "Hemograma Completo",
  "exam_date": "2024-01-20T08:00:00Z",
  "urgency": "media",
  "notes": "Exame de rotina para acompanhamento"
}
\`\`\`

#### **GET /api/doctor/exams/[id]**
Busca exame específico.

#### **PUT /api/doctor/exams/[id]**
Atualiza exame (adiciona resultado).

**Body para adicionar resultado:**
\`\`\`json
{
  "result_details": "Hemograma dentro da normalidade",
  "result_file_url": "https://storage.url/resultado.pdf",
  "status": "completed"
}
\`\`\`

### **👥 Pacientes**

#### **GET /api/doctor/patients**
Lista pacientes do médico (que já tiveram consultas/exames).

**Parâmetros de Query:**
- `search` (opcional): Buscar por nome ou email
- `limit` (opcional): Número máximo de resultados
- `offset` (opcional): Offset para paginação

---

## 🏥 **APIs para Clínicas/Hospitais**

### **Autenticação**
Todas as rotas requerem autenticação via Supabase Auth e perfil de usuário com `user_type = "admin"`.

### **📊 Dashboard**

#### **GET /api/clinic/dashboard**
Retorna estatísticas completas da clínica.

**Resposta:**
\`\`\`json
{
  "success": true,
  "data": {
    "statistics": {
      "appointments": {
        "total": 1250,
        "scheduled": 45,
        "completed": 1180,
        "cancelled": 25,
        "today": 12,
        "today_completed": 8
      },
      "exams": {
        "total": 890,
        "pending": 23,
        "completed": 867,
        "requested": 15,
        "in_progress": 8
      },
      "patients": {
        "total": 456,
        "new_this_month": 23,
        "active": 234
      },
      "doctors": 8,
      "unread_notifications": 5
    },
    "charts": {
      "appointments_by_specialty": {
        "Cardiologia": 45,
        "Dermatologia": 32,
        "Clínica Geral": 78
      }
    },
    "upcoming_appointments": [...],
    "urgent_exams": [...],
    "alerts": [...]
  }
}
\`\`\`

### **📅 Consultas**

#### **GET /api/clinic/appointments**
Lista todas as consultas da clínica.

**Parâmetros de Query:**
- `status` (opcional): Filtrar por status
- `doctor_id` (opcional): Filtrar por médico
- `patient_id` (opcional): Filtrar por paciente
- `specialty` (opcional): Filtrar por especialidade
- `date_from` (opcional): Data inicial (YYYY-MM-DD)
- `date_to` (opcional): Data final (YYYY-MM-DD)
- `limit` (opcional): Número máximo de resultados
- `offset` (opcional): Offset para paginação

#### **POST /api/clinic/appointments**
Agenda consulta como clínica.

**Body:**
\`\`\`json
{
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "appointment_date": "2024-01-15T10:00:00Z",
  "duration": 60,
  "specialty": "Cardiologia",
  "appointment_type": "primeira-consulta",
  "notes": "Paciente encaminhado",
  "location": "Sala 201"
}
\`\`\`

### **👥 Pacientes**

#### **GET /api/clinic/patients**
Lista todos os pacientes da clínica.

**Parâmetros de Query:**
- `search` (opcional): Buscar por nome, email ou telefone
- `include_stats` (opcional): Incluir estatísticas (`true`/`false`)
- `limit` (opcional): Número máximo de resultados
- `offset` (opcional): Offset para paginação

#### **POST /api/clinic/patients**
Cadastra novo paciente.

**Body:**
\`\`\`json
{
  "full_name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "(11) 98765-4321",
  "date_of_birth": "1985-03-15"
}
\`\`\`

### **👨‍⚕️ Médicos**

#### **GET /api/clinic/doctors**
Lista médicos da clínica.

#### **POST /api/clinic/doctors**
Cadastra novo médico.

### **🔬 Exames**

#### **GET /api/clinic/exams**
Lista todos os exames da clínica.

#### **PUT /api/clinic/exams**
Atualiza status de exames em lote.

**Body:**
\`\`\`json
{
  "exam_ids": ["uuid1", "uuid2", "uuid3"],
  "updates": {
    "status": "scheduled",
    "exam_date": "2024-01-20T08:00:00Z"
  }
}
\`\`\`

### **📊 Relatórios**

#### **GET /api/clinic/reports**
Gera relatórios da clínica.

**Parâmetros de Query:**
- `type` (obrigatório): Tipo do relatório (`general`, `appointments`, `exams`, `financial`, `patients`)
- `date_from` (opcional): Data inicial
- `date_to` (opcional): Data final
- `doctor_id` (opcional): Filtrar por médico
- `specialty` (opcional): Filtrar por especialidade

**Tipos de Relatório:**

1. **`general`**: Relatório geral com todas as estatísticas
2. **`appointments`**: Relatório detalhado de consultas
3. **`exams`**: Relatório detalhado de exames
4. **`financial`**: Relatório financeiro (receita simulada)
5. **`patients`**: Relatório de pacientes

### **🔔 Notificações**

#### **GET /api/clinic/notifications**
Lista notificações da clínica.

#### **POST /api/clinic/notifications**
Cria notificações para pacientes.

**Body:**
\`\`\`json
{
  "user_ids": ["uuid1", "uuid2"],
  "type": "appointment_reminder",
  "content": "Lembrete: Sua consulta é amanhã às 10h",
  "related_id": "appointment_uuid"
}
\`\`\`

---

## 🔐 **Códigos de Status HTTP**

- **200**: Sucesso
- **201**: Criado com sucesso
- **400**: Dados inválidos
- **401**: Não autorizado (não autenticado)
- **403**: Acesso negado (sem permissão)
- **404**: Não encontrado
- **409**: Conflito (ex: horário já ocupado)
- **500**: Erro interno do servidor

---

## 🚀 **Exemplos de Uso**

### **Médico: Listar consultas do dia**
\`\`\`bash
GET /api/doctor/appointments?date=2024-01-15&status=scheduled
Authorization: Bearer <supabase_token>
\`\`\`

### **Clínica: Dashboard completo**
\`\`\`bash
GET /api/clinic/dashboard
Authorization: Bearer <supabase_token>
\`\`\`

### **Clínica: Relatório financeiro do mês**
\`\`\`bash
GET /api/clinic/reports?type=financial&date_from=2024-01-01&date_to=2024-01-31
Authorization: Bearer <supabase_token>
\`\`\`

### **Médico: Adicionar resultado de exame**
\`\`\`bash
PUT /api/doctor/exams/uuid-do-exame
Authorization: Bearer <supabase_token>
Content-Type: application/json

{
  "result_details": "Exame normal, sem alterações",
  "result_file_url": "https://storage.url/resultado.pdf"
}
