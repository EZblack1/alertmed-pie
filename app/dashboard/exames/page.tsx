import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileText, Download, Eye, AlertTriangle, Plus } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ExamRequestModal } from "@/components/modals/exam-request-modal"

export default async function ExamsPage() {
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
    // Tentar buscar exames
    const { data: exams, error } = await supabase
      .from("exams")
      .select("*")
      .eq("patient_id", userId)
      .order("exam_date", { ascending: false })

    if (error) {
      if (error.message.includes("does not exist")) {
        tableExists = false
        errorMessage = "A tabela 'exams' não existe no banco de dados."
      } else {
        throw error
      }
    }

    // Se a tabela existe, mostrar os exames
    if (tableExists) {
      // Separar exames por status
      const pendingExams = exams?.filter((exam) => !exam.result_available) || []
      const completedExams = exams?.filter((exam) => exam.result_available) || []

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tight">Meus Exames</h1>
            <ExamRequestModal>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Solicitar Exame
              </Button>
            </ExamRequestModal>
          </div>

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="completed">Concluídos</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {exams && exams.length > 0 ? exams.map((exam) => <ExamCard key={exam.id} exam={exam} />) : <EmptyState />}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              {pendingExams.length > 0 ? (
                pendingExams.map((exam) => <ExamCard key={exam.id} exam={exam} />)
              ) : (
                <EmptyState message="Nenhum exame pendente encontrado" />
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedExams.length > 0 ? (
                completedExams.map((exam) => <ExamCard key={exam.id} exam={exam} />)
              ) : (
                <EmptyState message="Nenhum exame concluído encontrado" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )
    }
  } catch (error: any) {
    console.error("Erro ao buscar exames:", error)
    tableExists = false
    errorMessage = error.message || "Erro ao verificar a tabela de exames no banco de dados."
  }

  // Se a tabela não existe, mostrar mensagem de erro
  if (!tableExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Exames</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus exames</p>
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

function ExamCard({ exam }: { exam: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{exam.exam_type}</CardTitle>
            <CardDescription>
              {exam.exam_date
                ? `Realizado em: ${new Date(exam.exam_date).toLocaleDateString("pt-BR")}`
                : "Data não agendada"}
            </CardDescription>
          </div>
          <Badge variant={exam.result_available ? "success" : "secondary"}>
            {exam.result_available ? "Resultado Disponível" : "Pendente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {exam.notes && <p className="text-sm text-muted-foreground">{exam.notes}</p>}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/exames/${exam.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                Detalhes
              </Link>
            </Button>

            {exam.result_available && exam.result_file_url && (
              <Button size="sm" asChild>
                <Link href={exam.result_file_url} target="_blank">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Resultado
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message = "Nenhum exame encontrado" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <FileText className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">{message}</p>
        <ExamRequestModal>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Solicitar Exame
          </Button>
        </ExamRequestModal>
      </CardContent>
    </Card>
  )
}
