import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, FileText, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { ExamRequestModal } from "@/components/modals/exam-request-modal"

async function getExams() {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return []
    }

    console.log("🔍 Buscando exames para usuário:", session.user.id)

    // Buscar na tabela independente de exames
    const { data: exams, error } = await supabase
      .from("exams")
      .select("*")
      .eq("patient_id", session.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("❌ Erro ao buscar exames:", error)
      return []
    }

    console.log("✅ Exames encontrados:", exams?.length || 0)
    return exams || []
  } catch (error) {
    console.error("❌ Erro ao buscar exames:", error)
    return []
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "requested":
      return <Clock className="h-4 w-4" />
    case "approved":
      return <CheckCircle className="h-4 w-4" />
    case "scheduled":
      return <Calendar className="h-4 w-4" />
    case "completed":
      return <CheckCircle className="h-4 w-4" />
    case "cancelled":
      return <XCircle className="h-4 w-4" />
    default:
      return <AlertCircle className="h-4 w-4" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "requested":
      return "bg-yellow-100 text-yellow-800"
    case "approved":
      return "bg-green-100 text-green-800"
    case "scheduled":
      return "bg-blue-100 text-blue-800"
    case "completed":
      return "bg-green-100 text-green-800"
    case "cancelled":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getStatusText(status: string) {
  switch (status) {
    case "requested":
      return "Solicitado"
    case "approved":
      return "Aprovado"
    case "scheduled":
      return "Agendado"
    case "completed":
      return "Concluído"
    case "cancelled":
      return "Cancelado"
    default:
      return "Desconhecido"
  }
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case "alta":
      return "bg-red-100 text-red-800"
    case "media":
      return "bg-yellow-100 text-yellow-800"
    case "baixa":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default async function ExamesPage() {
  const exams = await getExams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exames</h1>
          <p className="text-muted-foreground">Gerencie suas solicitações e resultados de exames</p>
        </div>
        <ExamRequestModal>
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            Solicitar Exame
          </Button>
        </ExamRequestModal>
      </div>

      {exams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum exame encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Você ainda não possui exames solicitados. Clique no botão acima para solicitar seu primeiro exame.
            </p>
            <ExamRequestModal>
              <Button>Solicitar Primeiro Exame</Button>
            </ExamRequestModal>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <Card key={exam.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {exam.exam_type}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getUrgencyColor(exam.urgency)}>
                      {exam.urgency === "alta" ? "Alta" : exam.urgency === "media" ? "Média" : "Baixa"}
                    </Badge>
                    <Badge className={getStatusColor(exam.status)}>
                      {getStatusIcon(exam.status)}
                      <span className="ml-1">{getStatusText(exam.status)}</span>
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  Solicitado em {new Date(exam.created_at).toLocaleDateString("pt-BR")}
                  {exam.preferred_date && (
                    <span className="ml-2">
                      • Data preferencial: {new Date(exam.preferred_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              {exam.notes && (
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Observações:</h4>
                    <p className="text-sm text-muted-foreground">{exam.notes}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
