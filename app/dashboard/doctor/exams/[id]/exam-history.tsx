import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface HistoryItem {
  id: string
  exam_id: string
  status: string
  notes: string
  created_at: string
  created_by?: string
}

interface ExamHistoryProps {
  history: HistoryItem[]
}

export default function ExamHistory({ history }: ExamHistoryProps) {
  // Mapear status para texto em português
  const statusText: Record<string, string> = {
    requested: "Solicitado",
    approved: "Aprovado",
    scheduled: "Agendado",
    completed: "Concluído",
    cancelled: "Cancelado",
  }

  // Mapear status para cores
  const statusColors: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico do Exame</CardTitle>
        <CardDescription>Registro de alterações e atualizações</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum registro de histórico encontrado.</p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => {
              const date = new Date(item.created_at)
              const formattedDate = format(date, "dd/MM/yyyy", { locale: ptBR })
              const formattedTime = format(date, "HH:mm", { locale: ptBR })

              return (
                <div key={item.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className={`inline-block px-2 py-1 text-xs rounded-md ${statusColors[item.status]}`}>
                        {statusText[item.status]}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {formattedDate} às {formattedTime}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">{item.notes}</p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
