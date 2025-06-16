import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Buscar detalhes de um paciente específico
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const patientId = params.id

    // Verificar autenticação
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Verificar se o hospital já atendeu este paciente
    const { data: hasRelationship } = await supabase
      .from("appointments")
      .select("id")
      .eq("hospital_id", session.user.id)
      .eq("patient_id", patientId)
      .limit(1)

    const { data: hasExamRelationship } = await supabase
      .from("exams")
      .select("id")
      .eq("hospital_id", session.user.id)
      .eq("patient_id", patientId)
      .limit(1)

    if (
      (!hasRelationship || hasRelationship.length === 0) &&
      (!hasExamRelationship || hasExamRelationship.length === 0)
    ) {
      return NextResponse.json(
        { error: "Acesso negado - este paciente não tem histórico neste hospital" },
        { status: 403 },
      )
    }

    // Buscar dados do paciente
    const { data: patient, error: patientError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, date_of_birth, created_at, updated_at")
      .eq("id", patientId)
      .eq("user_type", "patient")
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 })
    }

    // Buscar histórico de consultas no hospital
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        *,
        doctor:profiles!appointments_doctor_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq("patient_id", patientId)
      .eq("hospital_id", session.user.id)
      .order("appointment_date", { ascending: false })

    // Buscar histórico de exames no hospital
    const { data: exams } = await supabase
      .from("exams")
      .select(`
        *,
        doctor:profiles!exams_doctor_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq("patient_id", patientId)
      .eq("hospital_id", session.user.id)
      .order("created_at", { ascending: false })

    // Buscar observações médicas (apenas as mais recentes de cada médico)
    const { data: medicalNotes } = await supabase.rpc("get_latest_medical_notes_by_patient", {
      p_patient_id: patientId,
    })

    return NextResponse.json({
      success: true,
      data: {
        patient,
        medical_history: {
          appointments: appointments || [],
          exams: exams || [],
          medical_notes: medicalNotes || [],
        },
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar dados do paciente:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// PUT - Atualizar dados administrativos do paciente
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const patientId = params.id
    const body = await request.json()

    // Verificar autenticação
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Verificar se o paciente existe
    const { data: patient } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", patientId)
      .eq("user_type", "patient")
      .single()

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 })
    }

    // Campos permitidos para atualização
    const allowedFields = ["phone", "emergency_contact", "insurance_provider", "insurance_number", "notes"]
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // Atualizar dados do paciente
    const { data: updatedPatient, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", patientId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Dados do paciente atualizados com sucesso",
      data: updatedPatient,
    })
  } catch (error: any) {
    console.error("Erro ao atualizar dados do paciente:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
