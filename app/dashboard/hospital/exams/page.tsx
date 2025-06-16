import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { FileText, CheckCircle, XCircle, AlertCircle, Calendar, Clock, Users } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { revalidatePath } from "next/cache"

export default async function HospitalExams() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Verificar se o usuário é hospital/admin
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  if (!profile || !["hospital", "admin"].includes(profile.user_type)) {
    redirect("/dashboard")
  }

  // Buscar exames pendentes de aprovação
  const { data: pendingExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(id, full_name, email, phone),
      doctor:profiles!exams_doctor_id_fkey(id, full_name, email, specialties)
    `)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false })

  // Buscar exames agendados
  const { data: scheduledExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(id, full_name, email, phone),
      doctor:profiles!exams_doctor_id_fkey(id, full_name, email, specialties)
    `)
    .eq("status", "scheduled")
    .order("exam_date")
    .limit(10)

  // Buscar exames em andamento
  const { data: inProgressExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(id, full_name, email, phone),
      doctor:profiles!exams_doctor_id_fkey(id, full_name, email, specialties)
    `)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(10)

  // Função para aprovar exame
  async function approveExam(id: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("exams")
        .update({
          approval_status: "approved",
          status: "scheduled",
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
          content: `Sua solicitação de exame ${exam.exam_type} foi aprovada!`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/hospital/exams")
    } catch (error) {
      console.error("Erro ao aprovar exame:", error)
    }
  }

  // Função para rejeitar exame
  async function rejectExam(id: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("exams")
        .update({
          approval_status: "rejected",
          status: "cancelled",
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
          content: `Sua solicitação de exame ${exam.exam_type} foi rejeitada.`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/hospital/exams")
    } catch (error) {
      console.error("Erro ao rejeitar exame:", error)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Exames</h1>
          <p className="text-gray-600">{profile.hospital_name || profile.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/hospital">
              <Calendar className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/hospital/exams/new">
              <FileText className="h-4 w-4 mr-2" />
              Novo Exame
            </Link>
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendados</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">exames agendados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">exames em processamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">exames aprovados</p>
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
          <TabsTrigger value="scheduled">Agendados</TabsTrigger>
          <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames Pendentes de Aprovação</CardTitle>
              <CardDescription>Solicitações que precisam de sua aprovação</CardDescription>
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
                            <Users className="h-4 w-4 mr-1" />
                            <span>Médico: {exam.doctor?.full_name || "Não especificado"}</span>
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
                        <form action={approveExam.bind(null, exam.id)}>
                          <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </form>
                        <form action={rejectExam.bind(null, exam.id)}>
                          <Button type="submit" variant="destructive" size="sm">
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                  <p>Não há exames pendentes de aprovação</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames Agendados</CardTitle>
              <CardDescription>Exames aprovados e agendados</CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledExams && scheduledExams.length > 0 ? (
                <div className="space-y-4">
                  {scheduledExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-blue-500 mr-2" />
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
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              {exam.exam_date
                                ? new Date(exam.exam_date).toLocaleDateString("pt-BR")
                                : "Data não definida"}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>Paciente: {exam.patient?.full_name}</span>
                          </div>
                        </div>
                        {exam.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {exam.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm">
                          <Clock className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há exames agendados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames em Andamento</CardTitle>
              <CardDescription>Exames que estão sendo processados</CardDescription>
            </CardHeader>
            <CardContent>
              {inProgressExams && inProgressExams.length > 0 ? (
                <div className="space-y-4">
                  {inProgressExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-purple-500 mr-2" />
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
                            <Users className="h-4 w-4 mr-1" />
                            <span>Médico: {exam.doctor?.full_name || "Não especificado"}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: "45%" }}></div>
                        </div>
                        <p className="text-xs text-gray-500 text-center">45% concluído</p>
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-1" />
                          Adicionar Resultado
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há exames em andamento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
