import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { FileText, CheckCircle, AlertCircle, Calendar, Users } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { revalidatePath } from "next/cache"

export default async function DoctorExams() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Verificar se o usuário é médico
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  if (!profile || profile.user_type !== "doctor") {
    redirect("/dashboard")
  }

  // Buscar exames pendentes de resultado
  const { data: pendingExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(id, full_name, email, phone)
    `)
    .eq("doctor_id", session.user.id)
    .eq("result_available", false)
    .in("status", ["scheduled", "in_progress"])
    .order("created_at", { ascending: false })

  // Buscar exames com resultados
  const { data: completedExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(id, full_name, email, phone)
    `)
    .eq("doctor_id", session.user.id)
    .eq("result_available", true)
    .order("updated_at", { ascending: false })
    .limit(10)

  // Buscar exames solicitados pelo médico
  const { data: requestedExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(id, full_name, email, phone)
    `)
    .eq("doctor_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  // Função para adicionar resultado ao exame
  async function addExamResult(id: string, result: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("exams")
        .update({
          result: result,
          result_available: true,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      // Enviar notificação ao paciente
      const { data: exam } = await supabase.from("exams").select("patient_id, exam_type").eq("id", id).single()

      if (exam) {
        await supabase.from("notifications").insert({
          user_id: exam.patient_id,
          type: "exam_result",
          content: `O resultado do seu exame ${exam.exam_type} está disponível!`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/doctor/exams")
    } catch (error) {
      console.error("Erro ao adicionar resultado:", error)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Exames</h1>
          <p className="text-gray-600">Dr(a). {profile.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/doctor">
              <Calendar className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/doctor/exams/new">
              <FileText className="h-4 w-4 mr-2" />
              Solicitar Exame
            </Link>
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">aguardando resultado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">com resultados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitados</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requestedExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">exames solicitados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pendentes
            {pendingExams && pendingExams.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingExams.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="requested">Solicitados</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames Pendentes de Resultado</CardTitle>
              <CardDescription>Exames que precisam de análise e resultado</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingExams && pendingExams.length > 0 ? (
                <div className="space-y-4">
                  {pendingExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 text-yellow-500 mr-2" />
                          <p className="font-medium">{exam.exam_type}</p>
                          <Badge
                            variant="outline"
                            className={`ml-2 ${
                              exam.urgency === "alta"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : exam.urgency === "media"
                                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {exam.urgency === "alta"
                              ? "Alta Urgência"
                              : exam.urgency === "media"
                                ? "Média Urgência"
                                : "Baixa Urgência"}
                          </Badge>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>Paciente: {exam.patient?.full_name}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              {exam.exam_date
                                ? new Date(exam.exam_date).toLocaleDateString("pt-BR")
                                : "Data não definida"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Solicitado{" "}
                          {formatDistanceToNow(new Date(exam.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                        {exam.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {exam.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Adicionar Resultado
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/doctor/patients/${exam.patient?.id}`}>
                            <FileText className="h-4 w-4 mr-1" />
                            Prontuário
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                  <p>Não há exames pendentes de resultado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames Concluídos</CardTitle>
              <CardDescription>Exames com resultados disponíveis</CardDescription>
            </CardHeader>
            <CardContent>
              {completedExams && completedExams.length > 0 ? (
                <div className="space-y-4">
                  {completedExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          <p className="font-medium">{exam.exam_type}</p>
                          <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                            Resultado Disponível
                          </Badge>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>Paciente: {exam.patient?.full_name}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              {exam.exam_date
                                ? new Date(exam.exam_date).toLocaleDateString("pt-BR")
                                : "Data não definida"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Resultado adicionado{" "}
                          {formatDistanceToNow(new Date(exam.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                        {exam.result && (
                          <p className="text-sm bg-green-50 p-2 rounded border border-green-100">
                            <span className="font-medium">Resultado:</span> {exam.result.substring(0, 100)}...
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-1" />
                          Ver Resultado
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/doctor/patients/${exam.patient?.id}`}>
                            <Users className="h-4 w-4 mr-1" />
                            Prontuário
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há exames concluídos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requested" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames Solicitados</CardTitle>
              <CardDescription>Todos os exames que você solicitou</CardDescription>
            </CardHeader>
            <CardContent>
              {requestedExams && requestedExams.length > 0 ? (
                <div className="space-y-4">
                  {requestedExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-blue-500 mr-2" />
                          <p className="font-medium">{exam.exam_type}</p>
                          <Badge
                            variant="outline"
                            className={`ml-2 ${
                              exam.status === "completed"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : exam.status === "in_progress"
                                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  : exam.status === "scheduled"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          >
                            {exam.status === "completed"
                              ? "Concluído"
                              : exam.status === "in_progress"
                                ? "Em Andamento"
                                : exam.status === "scheduled"
                                  ? "Agendado"
                                  : "Pendente"}
                          </Badge>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>Paciente: {exam.patient?.full_name}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              {exam.exam_date
                                ? new Date(exam.exam_date).toLocaleDateString("pt-BR")
                                : "Data não definida"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Solicitado{" "}
                          {formatDistanceToNow(new Date(exam.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                        {exam.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {exam.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/doctor/patients/${exam.patient?.id}`}>
                            <Users className="h-4 w-4 mr-1" />
                            Prontuário
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há exames solicitados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
