"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"

interface MedicalNotesProps {
  appointmentId: string
  existingNotes: string
}

export default function MedicalNotes({ appointmentId, existingNotes }: MedicalNotesProps) {
  const [notes, setNotes] = useState(existingNotes)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const saveNotes = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.from("appointments").update({ medical_notes: notes }).eq("id", appointmentId)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anotações Médicas</CardTitle>
        <CardDescription>Registre informações importantes sobre esta consulta</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Digite suas anotações médicas aqui..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[200px]"
        />
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={saveNotes} disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar Anotações"}
        </Button>
      </CardFooter>
    </Card>
  )
}
