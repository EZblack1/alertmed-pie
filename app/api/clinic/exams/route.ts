import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar todos os exames da clínica
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

    // Verificar se é admin/clínica
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "admin") {
      return NextResponse.json({ error: "Acesso negado - apenas administradores" }, { status: 403 })
    }

    // Parâmetros de filtro
    const status = searchParams.get("status")
    const urgency = searchParams.get("urgency")
    const exam_type = searchParams.get("exam_type")
    const patient_id = searchParams.get("patient_id")
    const doctor_id = searchParams.get("doctor_id")
    const result_available = searchParams.get("result_available")
    const date_from = searchParams.get("date_from")
    const date_to = searchParams.get("date_to")
    const limit = Number.parseInt(searchParams.get("limit") || "100")
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
        ),
        doctor:profiles!exams_doctor_id_fkey(
          id,
          full_name,
          email,
          phone
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (status) {
      query = query.eq("status", status)
    }
    if (urgency) {
      query = query.eq("urgency", urgency)
    }
    if (exam_type) {
      query = query.ilike("exam_type", `%${exam_type}%`)
    }
    if (patient_id) {
      query = query.eq("patient_id", patient_id)
    }
    if (doctor_id) {
      query = query.eq("doctor_id", doctor_id)
    }
    if (result_available) {
      query = query.eq("result_available", result_available === "true")
    }
    if (date_from) {
      query = query.gte("created_at", new Date(date_from).toISOString())
    }
    if (date_to) {
      const endDate = new Date(date_to)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt("created_at", endDate.toISOString())
    }

    const { data: exams, error } = await query

    if (error) {
      throw error
    }

    // Buscar estatísticas
    const { data: allExams } = await supabase.from("exams").select("status, urgency, result_available")

    const statistics = {
      total: allExams?.length || 0,
      by_status: {
        requested: allExams?.filter((e) => e.status === "requested").length || 0,
        scheduled: allExams?.filter((e) => e.status === "scheduled").length || 0,
        in_progress: allExams?.filter((e) => e.status === "in_progress").length || 0,
        completed: allExams?.filter((e) => e.status === "completed").length || 0,
        cancelled: allExams?.filter((e) => e.status === "cancelled").length || 0,
      },
      by_urgency: {
        baixa: allExams?.filter((e) => e.urgency === "baixa").length || 0,
        media: allExams?.filter((e) => e.urgency === "media").length || 0,
        alta: allExams?.filter((e) => e.urgency === "alta").length || 0,
      },
      pending_results: allExams?.filter((e) => !e.result_available).length || 0,
    }

    return NextResponse.json({
      success: true,
      data: exams,
      statistics,
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

// PUT - Atualizar status de exame em lote
export async function PUT(request: NextRequest) {
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

    // Verificar se é admin/clínica
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "admin") {
      return NextResponse.json({ error: "Acesso negado - apenas administradores" }, { status: 403 })
    }

    const { exam_ids, updates } = body

    if (!exam_ids || !Array.isArray(exam_ids) || exam_ids.length === 0) {
      return NextResponse.json({ error: "exam_ids deve ser um array não vazio" }, { status: 400 })
    }

    // Preparar dados para atualização
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Campos permitidos para atualização em lote
    const allowedFields = ["status", "urgency", "exam_date"]
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    })

    // Atualizar exames
    const { data: updatedExams, error } = await supabase.from("exams").update(updateData).in("id", exam_ids).select()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `${updatedExams?.length || 0} exames atualizados com sucesso`,
      data: updatedExams,
    })
  } catch (error: any) {
    console.error("Erro ao atualizar exames:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
