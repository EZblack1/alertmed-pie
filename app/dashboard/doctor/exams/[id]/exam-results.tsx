"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { FileText, Download, Eye } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ExamResult {
  id: string
  exam_id: string
  result_text: string
  file_url?: string
  file_name?: string
  created_at: string
  created_by?: string
  doctor_notes?: string
}

interface ExamResultsProps {
  examId: string
  results: ExamResult[]
}

export default function ExamResults({ examId, results }: ExamResultsProps) {
  const [doctorNotes, setDoctorNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const saveNotes = async () => {
    setIsLoading(true)
    try {
      // Encontrar o resultado mais recente
      const latestResult = results[0]

      if (!latestResult) {
        throw new Error("Nenhum resultado encontrado")
      }

      const { error } = await supabase
        .from("exam_results")
        .update({ doctor_notes: doctorNotes })
        .eq("id", latestResult.id)

      if (error) throw error

      toast({
        title: "Anotações salvas",
        description: "As anotações médicas foram salvas com sucesso.",
      })

      router.refresh()
    } catch (error) {
      console.error("Erro ao salvar anotações:", error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as anotações médicas.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resultados do Exame</CardTitle>
          <CardDescription>Nenhum resultado disponível ainda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Aguardando Resultados</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Os resultados serão exibidos aqui assim que estiverem disponíveis.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Ordenar resultados por data (mais recente primeiro)
  const sortedResults = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Pegar o resultado mais recente
  const latestResult = sortedResults[0]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resultado Mais Recente</CardTitle>
          <CardDescription>
            Adicionado em {format(new Date(latestResult.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestResult.result_text && (
            <div className="border rounded-md p-4 bg-gray-50">
              <p className="whitespace-pre-wrap">{latestResult.result_text}</p>
            </div>
          )}

          {latestResult.file_url && (
            <div className="flex items-center justify-between border rounded-md p-3">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-blue-600 mr-2" />
                <span>{latestResult.file_name || "Arquivo de resultado"}</span>
              </div>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  <Eye className="h-4 w-4 mr-1" />
                  Visualizar
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anotações Médicas</CardTitle>
          <CardDescription>Adicione suas observações sobre este resultado</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Digite suas anotações sobre o resultado do exame..."
            value={doctorNotes || latestResult.doctor_notes || ""}
            onChange={(e) => setDoctorNotes(e.target.value)}
            className="min-h-[150px]"
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={saveNotes} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Anotações"}
          </Button>
        </CardFooter>
      </Card>

      {sortedResults.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Resultados</CardTitle>
            <CardDescription>Resultados anteriores deste exame</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {sortedResults.slice(1).map((result) => (
                <li key={result.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Resultado de {format(new Date(result.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Adicionado às {format(new Date(result.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/dashboard/doctor/exams/${examId}/results/${result.id}`)}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
