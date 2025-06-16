import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Buscar exame específico
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const examId = params.id

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

    // Buscar exame
    const { data: exam, error } = await supabase
      .from("exams")
      .select(`
        *,
        patient:profiles!exams_patient_id_fkey(
          id,
          full_name,
          email,
          phone,
          date_of_birth
        )
      `)
      .eq("id", examId)
      .eq("doctor_id", session.user.id)
      .single()

    if (error || !exam) {
      return NextResponse.json({ error: "Exame não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: exam,
    })
  } catch (error: any) {
    console.error("Erro ao buscar exame:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// PUT - Atualizar exame (adicionar resultado)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const examId = params.id
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

    // Verificar se o exame existe e pertence ao médico
    const { data: existingExam } = await supabase
      .from("exams")
      .select("id, status")
      .eq("id", examId)
      .eq("doctor_id", session.user.id)
      .single()

    if (!existingExam) {
      return NextResponse.json({ error: "Exame não encontrado" }, { status: 404 })
    }

    // Preparar dados para atualização
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Campos permitidos para atualização
    const allowedFields = [
      "exam_date",
      "status",
      "notes",
      "urgency",
      "result_available",
      "result_date",
      "result_details",
      "result_file_url",
    ]

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // Se adicionando resultado, marcar como disponível
    if (body.result_details || body.result_file_url) {
      updateData.result_available = true
      updateData.result_date = new Date().toISOString()
      updateData.status = "completed"
    }

    // Atualizar exame
    const { data: exam, error } = await supabase
      .from("exams")
      .update(updateData)
      .eq("id", examId)
      .eq("doctor_id", session.user.id)
      .select(`
        *,
        patient:profiles!exams_patient_id_fkey(
          id,
          full_name,
          email,
          phone
        )
      `)
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Exame atualizado com sucesso",
      data: exam,
    })
  } catch (error: any) {
    console.error("Erro ao atualizar exame:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
