import { notFound } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import ExamActions from "./exam-actions"
import PatientInfo from "../../../doctor/appointments/[id]/patient-info"
import ExamResults from "./exam-results"
import ExamHistory from "./exam-history"

export default async function ExamDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  // Verificar autenticação
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return notFound()
  }

  // Buscar detalhes do exame
  const { data: exam, error } = await supabase
    .from("exams")
    .select(`
      *,
      profiles:profile_id(id, full_name, email, phone, birth_date, gender, blood_type, allergies, chronic_conditions),
      doctors:doctor_id(id, name, specialty, crm)
    `)
    .eq("id", params.id)
    .single()

  if (error || !exam) {
    console.error("Erro ao buscar exame:", error)
    return notFound()
  }

  // Verificar se o médico tem acesso a este exame
  if (session.user.id !== exam.doctor_id && session.user.user_metadata?.role !== "hospital") {
    return notFound()
  }

  // Buscar histórico de alterações
  const { data: history } = await supabase
    .from("exam_history")
    .select("*")
    .eq("exam_id", params.id)
    .order("created_at", { ascending: false })

  // Buscar resultados do exame
  const { data: results } = await supabase
    .from("exam_results")
    .select("*")
    .eq("exam_id", params.id)
    .order("created_at", { ascending: false })

  // Formatar datas
  const requestDate = new Date(exam.request_date)
  const formattedRequestDate = format(requestDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  let formattedScheduledDate = "Não agendado"
  if (exam.scheduled_date) {
    const scheduledDate = new Date(exam.scheduled_date)
    formattedScheduledDate = format(scheduledDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
  }

  // Mapear status para cores de badge
  const statusColors: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    approved: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    scheduled: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    completed: "bg-green-100 text-green-800 hover:bg-green-100",
    cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
  }

  // Mapear status para texto em português
  const statusText: Record<string, string> = {
    requested: "Solicitado",
    approved: "Aprovado",
    scheduled: "Agendado",
    completed: "Concluído",
    cancelled: "Cancelado",
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detalhes do Exame</h1>
          <p className="text-muted-foreground">
            {exam.exam_type} para {exam.profiles.full_name}
          </p>
        </div>
        <Badge className={statusColors[exam.status]}>{statusText[exam.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="patient">Paciente</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Exame</CardTitle>
                  <CardDescription>Detalhes completos sobre este exame</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tipo de Exame</p>
                      <p>{exam.exam_type}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data da Solicitação</p>
                      <p>{formattedRequestDate}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Agendada</p>
                      <p>{formattedScheduledDate}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Médico Solicitante</p>
                      <p>{exam.doctors?.name || "Não especificado"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Prioridade</p>
                      <p>{exam.priority === "high" ? "Alta" : exam.priority === "medium" ? "Média" : "Normal"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Local</p>
                      <p>{exam.location || "Não especificado"}</p>
                    </div>
                  </div>

                  {exam.instructions && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Instruções</p>
                        <p>{exam.instructions}</p>
                      </div>
                    </>
                  )}

                  {exam.clinical_indication && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Indicação Clínica</p>
                        <p>{exam.clinical_indication}</p>
                      </div>
                    </>
                  )}

                  {exam.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Observações</p>
                        <p>{exam.notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patient">
              <PatientInfo patient={exam.profiles} />
            </TabsContent>

            <TabsContent value="results">
              <ExamResults examId={params.id} results={results || []} />
            </TabsContent>

            <TabsContent value="history">
              <ExamHistory history={history || []} />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
              <CardDescription>Gerencie este exame</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ExamActions
                examId={params.id}
                currentStatus={exam.status}
                userRole={session.user.user_metadata?.role || "patient"}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="outline">Voltar</Button>
              {exam.status === "completed" && results && results.length > 0 && <Button>Imprimir Resultados</Button>}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
