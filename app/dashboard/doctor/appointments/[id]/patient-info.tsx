import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

interface PatientInfoProps {
  patient: {
    id: string
    full_name: string
    email: string
    phone: string
    birth_date: string
    gender: string
    blood_type: string
    allergies: string
    chronic_conditions: string
  }
}

export default function PatientInfo({ patient }: PatientInfoProps) {
  // Calcular idade
  const birthDate = new Date(patient.birth_date)
  const age = new Date().getFullYear() - birthDate.getFullYear()

  // Formatar data de nascimento
  const formattedBirthDate = format(birthDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  // Mapear gênero para texto em português
  const genderText: Record<string, string> = {
    male: "Masculino",
    female: "Feminino",
    other: "Outro",
    prefer_not_to_say: "Prefere não informar",
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Informações do Paciente</CardTitle>
          <CardDescription>Dados pessoais e contato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
              <p>{patient.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data de Nascimento</p>
              <p>
                {formattedBirthDate} ({age} anos)
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Gênero</p>
              <p>{genderText[patient.gender] || "Não informado"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tipo Sanguíneo</p>
              <p>{patient.blood_type || "Não informado"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{patient.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Telefone</p>
              <p>{patient.phone || "Não informado"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Médicas</CardTitle>
          <CardDescription>Condições e alergias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Alergias</p>
            <p>{patient.allergies || "Nenhuma alergia registrada"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Condições Crônicas</p>
            <p>{patient.chronic_conditions || "Nenhuma condição crônica registrada"}</p>
          </div>
          <div className="pt-2">
            <Button variant="outline" className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              Ver Prontuário Completo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
