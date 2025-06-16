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

    // Verificar se é médico
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "doctor") {
      return NextResponse.json({ error: "Acesso negado - apenas médicos" }, { status: 403 })
    }

    // Verificar se o médico já atendeu este paciente
    const { data: hasRelationship } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", session.user.id)
      .eq("patient_id", patientId)
      .limit(1)

    if (!hasRelationship || hasRelationship.length === 0) {
      return NextResponse.json(
        { error: "Acesso negado - você não tem relação médico-paciente com este usuário" },
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

    // Buscar histórico de consultas
    const { data: appointments } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .eq("doctor_id", session.user.id)
      .order("appointment_date", { ascending: false })

    // Buscar histórico de exames
    const { data: exams } = await supabase
      .from("exams")
      .select("*")
      .eq("patient_id", patientId)
      .eq("doctor_id", session.user.id)
      .order("created_at", { ascending: false })

    // Buscar medicamentos
    const { data: medications } = await supabase
      .from("medications")
      .select("*")
      .eq("patient_id", patientId)
      .eq("doctor_id", session.user.id)
      .order("created_at", { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        patient,
        medical_history: {
          appointments: appointments || [],
          exams: exams || [],
          medications: medications || [],
        },
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar dados do paciente:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// PUT - Atualizar observações médicas do paciente
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

    // Verificar se é médico
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "doctor") {
      return NextResponse.json({ error: "Acesso negado - apenas médicos" }, { status: 403 })
    }

    // Verificar se o médico já atendeu este paciente
    const { data: hasRelationship } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", session.user.id)
      .eq("patient_id", patientId)
      .limit(1)

    if (!hasRelationship || hasRelationship.length === 0) {
      return NextResponse.json(
        { error: "Acesso negado - você não tem relação médico-paciente com este usuário" },
        { status: 403 },
      )
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

    // Verificar se já existe uma entrada de observações médicas
    const { data: existingNotes } = await supabase
      .from("patient_medical_notes")
      .select("id")
      .eq("patient_id", patientId)
      .eq("doctor_id", session.user.id)
      .maybeSingle()

    const { medical_notes, allergies, chronic_conditions, blood_type } = body

    if (existingNotes) {
      // Atualizar observações existentes
      const { data: updatedNotes, error } = await supabase
        .from("patient_medical_notes")
        .update({
          medical_notes,
          allergies,
          chronic_conditions,
          blood_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingNotes.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        message: "Observações médicas atualizadas com sucesso",
        data: updatedNotes,
      })
    } else {
      // Criar novas observações
      const { data: newNotes, error } = await supabase
        .from("patient_medical_notes")
        .insert({
          patient_id: patientId,
          doctor_id: session.user.id,
          medical_notes,
          allergies,
          chronic_conditions,
          blood_type,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return NextResponse.json(
        {
          success: true,
          message: "Observações médicas criadas com sucesso",
          data: newNotes,
        },
        { status: 201 },
      )
    }
  } catch (error: any) {
    console.error("Erro ao atualizar observações médicas:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
