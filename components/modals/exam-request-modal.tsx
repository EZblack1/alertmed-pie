"use client"

import type React from "react"

import { useState } from "react"
import { Calendar, FileText, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createExamRequest } from "@/app/actions/appointments"

interface ExamRequestModalProps {
  children: React.ReactNode
  onSuccess?: () => void
}

export function ExamRequestModal({ children, onSuccess }: ExamRequestModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Form state
  const [examType, setExamType] = useState("")
  const [preferredDate, setPreferredDate] = useState("")
  const [notes, setNotes] = useState("")
  const [urgency, setUrgency] = useState("")

  const examTypes = [
    "Hemograma Completo",
    "Glicemia",
    "Colesterol Total",
    "Triglicerídeos",
    "Creatinina",
    "Ureia",
    "TGO/TGP",
    "TSH",
    "T4 Livre",
    "Vitamina D",
    "Vitamina B12",
    "Ácido Úrico",
    "PCR",
    "VHS",
    "Eletrocardiograma",
    "Raio-X de Tórax",
    "Ultrassom Abdominal",
    "Mamografia",
    "Papanicolau",
    "Outro",
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await createExamRequest({
        examType,
        urgency: urgency || undefined,
        preferredDate: preferredDate || undefined,
        notes: notes || undefined,
      })

      if (result.success) {
        toast({
          title: "Solicitação enviada com sucesso! 🎉",
          description: "Sua solicitação de exame foi recebida e está sendo processada.",
        })

        // Reset form
        setExamType("")
        setPreferredDate("")
        setNotes("")
        setUrgency("")
        setOpen(false)

        // Callback para atualizar a página
        if (onSuccess) {
          onSuccess()
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message || "Ocorreu um erro ao enviar sua solicitação. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Solicitar Exame
          </DialogTitle>
          <DialogDescription>Preencha as informações abaixo para solicitar um novo exame.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exam-type">Tipo de Exame *</Label>
            <Select value={examType} onValueChange={setExamType} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de exame" />
              </SelectTrigger>
              <SelectContent>
                {examTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="urgency">Urgência</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a urgência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa - Exame de rotina</SelectItem>
                <SelectItem value="media">Média - Acompanhamento médico</SelectItem>
                <SelectItem value="alta">Alta - Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred-date">Data Preferencial</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="preferred-date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="pl-10"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Esta é apenas uma preferência. A data final será confirmada pela equipe médica.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Adicione qualquer informação adicional sobre o exame..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !examType}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Solicitar Exame"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
