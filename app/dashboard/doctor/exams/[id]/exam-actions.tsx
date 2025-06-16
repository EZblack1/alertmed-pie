"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { AlertCircle, Calendar, CheckCircle, FileText, Upload, XCircle } from "lucide-react"

interface ExamActionsProps {
  examId: string
  currentStatus: string
  userRole: string
}

export default function ExamActions({ examId, currentStatus, userRole }: ExamActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelForm, setShowCancelForm] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const updateStatus = async (status: string, reason?: string) => {
    setIsLoading(true)
    try {
      // Atualizar status do exame
      const { error } = await supabase
        .from("exams")
        .update({
          status,
          ...(reason ? { cancellation_reason: reason } : {}),
        })
        .eq("id", examId)

      if (error) throw error

      // Registrar no histórico
      await supabase.from("exam_history").insert({
        exam_id: examId,
        status,
        notes: reason || `Status alterado para ${status}`,
      })

      toast({
        title: "Status atualizado",
        description: `O exame foi ${status === "cancelled" ? "cancelado" : "atualizado"} com sucesso.`,
      })

      router.refresh()
    } catch (error) {
      console.error("Erro ao atualizar status:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do exame.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setShowCancelForm(false)
    }
  }

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast({
        title: "Atenção",
        description: "Por favor, informe o motivo do cancelamento.",
        variant: "destructive",
      })
      return
    }
    updateStatus("cancelled", cancelReason)
  }

  // Ações específicas para hospital/clínica
  if (userRole === "hospital") {
    return (
      <div className="space-y-4">
        {currentStatus === "requested" && (
          <>
            <Button className="w-full" onClick={() => updateStatus("approved")} disabled={isLoading}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar Exame
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/dashboard/hospital/exams/${examId}/schedule`)}
              disabled={isLoading}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Agendar Exame
            </Button>
          </>
        )}

        {currentStatus === "approved" && (
          <Button
            className="w-full"
            onClick={() => router.push(`/dashboard/hospital/exams/${examId}/schedule`)}
            disabled={isLoading}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Agendar Exame
          </Button>
        )}

        {currentStatus === "scheduled" && (
          <Button className="w-full" onClick={() => updateStatus("completed")} disabled={isLoading}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Marcar como Concluído
          </Button>
        )}

        {(currentStatus === "requested" || currentStatus === "approved" || currentStatus === "scheduled") && (
          <>
            {!showCancelForm ? (
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowCancelForm(true)}
                disabled={isLoading}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar Exame
              </Button>
            ) : (
              <Card className="p-4 border-red-200">
                <Textarea
                  placeholder="Motivo do cancelamento"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mb-2"
                />
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => setShowCancelForm(false)} disabled={isLoading}>
                    Voltar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isLoading}>
                    Confirmar Cancelamento
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {(currentStatus === "scheduled" || currentStatus === "completed") && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/dashboard/hospital/exams/${examId}/results/upload`)}
            disabled={isLoading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Enviar Resultados
          </Button>
        )}
      </div>
    )
  }

  // Ações para médicos
  return (
    <div className="space-y-4">
      {currentStatus === "completed" && (
        <Button
          className="w-full"
          onClick={() => router.push(`/dashboard/doctor/exams/${examId}/analyze`)}
          disabled={isLoading}
        >
          <FileText className="mr-2 h-4 w-4" />
          Analisar Resultados
        </Button>
      )}

      {(currentStatus === "requested" || currentStatus === "approved") && (
        <>
          {!showCancelForm ? (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowCancelForm(true)}
              disabled={isLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar Solicitação
            </Button>
          ) : (
            <Card className="p-4 border-red-200">
              <Textarea
                placeholder="Motivo do cancelamento"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mb-2"
              />
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setShowCancelForm(false)} disabled={isLoading}>
                  Voltar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isLoading}>
                  Confirmar Cancelamento
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/dashboard/doctor/exams/request?copy=${examId}`)}
        disabled={isLoading}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        Solicitar Exame Similar
      </Button>
    </div>
  )
}
