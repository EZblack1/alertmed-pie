import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar exames do médico
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

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

    // Parâmetros de filtro
    const status = searchParams.get("status")
    const patient_id = searchParams.get("patient_id")
    const exam_type = searchParams.get("exam_type")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Construir query
    let query = supabase
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
      .eq("doctor_id", session.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (status) {
      query = query.eq("status", status)
    }
    if (patient_id) {
      query = query.eq("patient_id", patient_id)
    }
    if (exam_type) {
      query = query.ilike("exam_type", `%${exam_type}%`)
    }

    const { data: exams, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: exams,
      pagination: {
        limit,
        offset,
        total: exams?.length || 0,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar exames:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// POST - Solicitar exame como médico
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
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

    // Validar dados obrigatórios
    const { patient_id, exam_type, exam_date, urgency = "media", notes } = body

    if (!patient_id || !exam_type) {
      return NextResponse.json({ error: "patient_id e exam_type são obrigatórios" }, { status: 400 })
    }

    // Verificar se o paciente existe
    const { data: patient } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", patient_id)
      .eq("user_type", "patient")
      .single()

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 })
    }

    // Criar exame
    const { data: exam, error } = await supabase
      .from("exams")
      .insert({
        patient_id,
        doctor_id: session.user.id,
        exam_type,
        exam_date: exam_date ? new Date(exam_date).toISOString() : null,
        status: "scheduled",
        urgency,
        notes,
        result_available: false,
      })
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

    return NextResponse.json(
      {
        success: true,
        message: "Exame solicitado com sucesso",
        data: exam,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Erro ao solicitar exame:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
