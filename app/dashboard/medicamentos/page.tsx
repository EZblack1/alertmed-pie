import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Pill, Clock, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default async function MedicationsPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  const userId = session.user.id

  // Verificar se a tabela existe
  let tableExists = true
  let errorMessage = ""

  try {
    // Tentar buscar medicamentos
    const { data: medications, error } = await supabase
      .from("medications")
      .select("*")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.message.includes("does not exist")) {
        tableExists = false
        errorMessage = "A tabela 'medications' não existe no banco de dados."
      } else {
        throw error
      }
    }

    // Se a tabela existe, verificar a tabela de horários
    if (tableExists) {
      // Buscar horários de medicamentos
      const { error: schedulesError } = await supabase
        .from("medication_schedules")
        .select("count", { count: "exact", head: true })
        .in("medication_id", medications?.map((med) => med.id) || [])

      if (schedulesError && schedulesError.message.includes("does not exist")) {
        tableExists = false
        errorMessage = "A tabela 'medication_schedules' não existe no banco de dados."
      }

      if (tableExists) {
        const { data: schedules } = await supabase
          .from("medication_schedules")
          .select("*")
          .in("medication_id", medications?.map((med) => med.id) || [])
          .order("scheduled_time", { ascending: true })

        // Agrupar horários por medicamento
        const schedulesMap =
          schedules?.reduce(
            (acc, schedule) => {
              if (!acc[schedule.medication_id]) {
                acc[schedule.medication_id] = []
              }
              acc[schedule.medication_id].push(schedule)
              return acc
            },
            {} as Record<string, any[]>,
          ) || {}

        // Separar medicamentos por status
        const activeMedications = medications?.filter((med) => med.active) || []
        const inactiveMedications = medications?.filter((med) => !med.active) || []

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold tracking-tight">Meus Medicamentos</h1>
            </div>

            <Tabs defaultValue="active" className="space-y-4">
              <TabsList>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="inactive">Inativos</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {activeMedications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {activeMedications.map((medication) => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        schedules={schedulesMap[medication.id] || []}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </TabsContent>

              <TabsContent value="inactive" className="space-y-4">
                {inactiveMedications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {inactiveMedications.map((medication) => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        schedules={schedulesMap[medication.id] || []}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Nenhum medicamento inativo encontrado" />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )
      }
    }
  } catch (error: any) {
    console.error("Erro ao buscar medicamentos:", error)
    tableExists = false
    errorMessage = error.message || "Erro ao verificar a tabela de medicamentos no banco de dados."
  }

  // Se a tabela não existe, mostrar mensagem de erro
  if (!tableExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Medicamentos</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus medicamentos</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no banco de dados</AlertTitle>
          <AlertDescription>
            {errorMessage} Execute o script SQL para criar as tabelas necessárias.
            <div className="mt-4">
              <p className="font-medium">Para resolver este problema:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Acesse o painel do Supabase</li>
                <li>Vá para a seção "SQL Editor"</li>
                <li>Execute o script SQL fornecido para criar as tabelas necessárias</li>
                <li>Recarregue esta página</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Script SQL</CardTitle>
            <CardDescription>
              Execute este script no SQL Editor do Supabase para criar as tabelas necessárias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {`-- Habilitar a extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis (complementa a tabela auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')),
  date_of_birth DATE
);

-- Tabela de exames
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  exam_type TEXT NOT NULL,
  exam_date TIMESTAMP WITH TIME ZONE,
  result_available BOOLEAN DEFAULT FALSE,
  result_date TIMESTAMP WITH TIME ZONE,
  result_details TEXT,
  result_file_url TEXT,
  notes TEXT
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
  active BOOLEAN DEFAULT TRUE
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

-- Tabela de consultas
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- duração em minutos
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  notes TEXT,
  location TEXT
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('exam_result', 'medication_reminder', 'appointment_reminder')),
  content TEXT NOT NULL,
  related_id UUID, -- ID do exame, medicamento ou consulta relacionado
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Configurar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para perfis
CREATE POLICY "Usuários podem ver seus próprios perfis" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Políticas para exames
CREATE POLICY "Pacientes podem ver seus próprios exames" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver exames de seus pacientes" 
  ON exams FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir exames" 
  ON exams FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar exames" 
  ON exams FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para medicamentos
CREATE POLICY "Pacientes podem ver seus próprios medicamentos" 
  ON medications FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver medicamentos de seus pacientes" 
  ON medications FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir medicamentos" 
  ON medications FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar medicamentos" 
  ON medications FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para horários de medicamentos
CREATE POLICY "Pacientes podem ver seus próprios horários de medicamentos" 
  ON medication_schedules FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

CREATE POLICY "Pacientes podem atualizar seus próprios horários de medicamentos" 
  ON medication_schedules FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

-- Políticas para consultas
CREATE POLICY "Pacientes podem ver suas próprias consultas" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver consultas de seus pacientes" 
  ON appointments FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar consultas" 
  ON appointments FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para notificações
CREATE POLICY "Usuários podem ver suas próprias notificações" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias notificações" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trigger para criar perfil automaticamente após cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, user_type)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.email, 'patient');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`}
            </pre>
          </CardContent>
          <CardFooter>
            <form
              action={async () => {
                "use server"
                // Esta é uma Server Action que permite recarregar a página
                // Não faz nada além de forçar um recarregamento
              }}
            >
              <Button type="submit" className="w-full">
                Recarregar após executar o script
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    )
  }
}

function MedicationCard({ medication, schedules }: { medication: any; schedules: any[] }) {
  // Calcular progresso do tratamento
  let progress = 0

  if (medication.start_date && medication.end_date) {
    const start = new Date(medication.start_date).getTime()
    const end = new Date(medication.end_date).getTime()
    const now = new Date().getTime()

    if (now >= end) {
      progress = 100
    } else if (now <= start) {
      progress = 0
    } else {
      progress = Math.round(((now - start) / (end - start)) * 100)
    }
  }

  // Calcular próxima dose
  const now = new Date()
  const upcomingSchedules = schedules
    .filter((s) => !s.taken && new Date(s.scheduled_time) > now)
    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())

  const nextDose = upcomingSchedules.length > 0 ? upcomingSchedules[0] : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{medication.medication_name}</CardTitle>
            <CardDescription>
              {medication.dosage} - {medication.frequency}
            </CardDescription>
          </div>
          <Badge variant={medication.active ? "default" : "secondary"}>{medication.active ? "Ativo" : "Inativo"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {medication.instructions && (
          <div>
            <p className="text-sm font-medium">Instruções:</p>
            <p className="text-sm text-muted-foreground">{medication.instructions}</p>
          </div>
        )}

        {medication.start_date && medication.end_date && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Início: {new Date(medication.start_date).toLocaleDateString("pt-BR")}</span>
              <span>Fim: {new Date(medication.end_date).toLocaleDateString("pt-BR")}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-right text-muted-foreground">{progress}% concluído</p>
          </div>
        )}

        {nextDose && (
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              Próxima dose:{" "}
              {new Date(nextDose.scheduled_time).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/dashboard/medicamentos/${medication.id}`}>Ver Detalhes</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function EmptyState({ message = "Nenhum medicamento encontrado" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Pill className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
