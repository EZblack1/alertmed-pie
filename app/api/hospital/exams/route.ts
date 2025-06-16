import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar exames do hospital
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

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Parâmetros de filtro
    const status = searchParams.get("status")
    const urgency = searchParams.get("urgency")
    const exam_type = searchParams.get("exam_type")
    const patient_id = searchParams.get("patient_id")
    const doctor_id = searchParams.get("doctor_id")
    const result_available = searchParams.get("result_available")
    const approval_status = searchParams.get("approval_status")
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
        ),
        approver:profiles(
          id,
          full_name,
          email
        )
      `)
      .eq("hospital_id", session.user.id)
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
    if (approval_status) {
      query = query.eq("approval_status", approval_status)
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
    const { data: allExams } = await supabase
      .from("exams")
      .select("status, urgency, result_available, approval_status")
      .eq("hospital_id", session.user.id)

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
      by_approval: {
        pending: allExams?.filter((e) => e.approval_status === "pending").length || 0,
        approved: allExams?.filter((e) => e.approval_status === "approved").length || 0,
        rejected: allExams?.filter((e) => e.approval_status === "rejected").length || 0,
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
  } catch (error) {
    console.error("Erro ao buscar exames:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar novo exame (usado pelo hospital para agendar)
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

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    const {
      patient_id,
      doctor_id,
      exam_type,
      description,
      urgency = "media",
      scheduled_date,
      scheduled_time,
      notes,
    } = body

    // Validar campos obrigatórios
    if (!patient_id || !doctor_id || !exam_type) {
      return NextResponse.json({ error: "Campos obrigatórios: patient_id, doctor_id, exam_type" }, { status: 400 })
    }

    // Criar exame
    const { data: exam, error } = await supabase
      .from("exams")
      .insert({
        patient_id,
        doctor_id,
        hospital_id: session.user.id,
        exam_type,
        description,
        urgency,
        scheduled_date,
        scheduled_time,
        notes,
        status: "scheduled",
        approval_status: "approved",
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Criar notificação para o paciente
    await supabase.from("notifications").insert({
      user_id: patient_id,
      title: "Exame Agendado",
      message: `Seu exame de ${exam_type} foi agendado para ${scheduled_date} às ${scheduled_time}`,
      type: "exam_scheduled",
      related_id: exam.id,
    })

    // Criar notificação para o médico
    await supabase.from("notifications").insert({
      user_id: doctor_id,
      title: "Exame Agendado",
      message: `Exame de ${exam_type} agendado para ${scheduled_date} às ${scheduled_time}`,
      type: "exam_scheduled",
      related_id: exam.id,
    })

    return NextResponse.json({
      success: true,
      data: exam,
      message: "Exame agendado com sucesso",
    })
  } catch (error) {
    console.error("Erro ao criar exame:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Atualizar exame (aprovar/rejeitar/reagendar)
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

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    const { id, action, ...updateData } = body

    if (!id || !action) {
      return NextResponse.json({ error: "ID do exame e ação são obrigatórios" }, { status: 400 })
    }

    let updateFields: any = { ...updateData }

    // Definir campos baseado na ação
    switch (action) {
      case "approve":
        updateFields = {
          ...updateFields,
          approval_status: "approved",
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          status: "scheduled",
        }
        break
      case "reject":
        updateFields = {
          ...updateFields,
          approval_status: "rejected",
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          status: "cancelled",
        }
        break
      case "reschedule":
        updateFields = {
          ...updateFields,
          status: "scheduled",
        }
        break
      case "complete":
        updateFields = {
          ...updateFields,
          status: "completed",
          completed_at: new Date().toISOString(),
        }
        break
      case "cancel":
        updateFields = {
          ...updateFields,
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        }
        break
    }

    // Atualizar exame
    const { data: exam, error } = await supabase
      .from("exams")
      .update(updateFields)
      .eq("id", id)
      .eq("hospital_id", session.user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Criar notificação baseada na ação
    let notificationTitle = ""
    let notificationMessage = ""

    switch (action) {
      case "approve":
        notificationTitle = "Exame Aprovado"
        notificationMessage = `Seu exame de ${exam.exam_type} foi aprovado e agendado`
        break
      case "reject":
        notificationTitle = "Exame Rejeitado"
        notificationMessage = `Seu exame de ${exam.exam_type} foi rejeitado`
        break
      case "reschedule":
        notificationTitle = "Exame Reagendado"
        notificationMessage = `Seu exame de ${exam.exam_type} foi reagendado`
        break
      case "complete":
        notificationTitle = "Exame Concluído"
        notificationMessage = `Seu exame de ${exam.exam_type} foi concluído`
        break
      case "cancel":
        notificationTitle = "Exame Cancelado"
        notificationMessage = `Seu exame de ${exam.exam_type} foi cancelado`
        break
    }

    if (notificationTitle) {
      // Notificar paciente
      await supabase.from("notifications").insert({
        user_id: exam.patient_id,
        title: notificationTitle,
        message: notificationMessage,
        type: `exam_${action}`,
        related_id: exam.id,
      })

      // Notificar médico
      await supabase.from("notifications").insert({
        user_id: exam.doctor_id,
        title: notificationTitle,
        message: notificationMessage,
        type: `exam_${action}`,
        related_id: exam.id,
      })
    }

    return NextResponse.json({
      success: true,
      data: exam,
      message: `Exame ${action === "approve" ? "aprovado" : action === "reject" ? "rejeitado" : "atualizado"} com sucesso`,
    })
  } catch (error) {
    console.error("Erro ao atualizar exame:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Excluir exame
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

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

    if (!id) {
      return NextResponse.json({ error: "ID do exame é obrigatório" }, { status: 400 })
    }

    // Buscar exame antes de excluir
    const { data: exam } = await supabase
      .from("exams")
      .select("patient_id, doctor_id, exam_type")
      .eq("id", id)
      .eq("hospital_id", session.user.id)
      .single()

    if (!exam) {
      return NextResponse.json({ error: "Exame não encontrado" }, { status: 404 })
    }

    // Excluir exame
    const { error } = await supabase.from("exams").delete().eq("id", id).eq("hospital_id", session.user.id)

    if (error) {
      throw error
    }

    // Notificar paciente
    await supabase.from("notifications").insert({
      user_id: exam.patient_id,
      title: "Exame Excluído",
      message: `Seu exame de ${exam.exam_type} foi excluído do sistema`,
      type: "exam_deleted",
    })

    // Notificar médico
    await supabase.from("notifications").insert({
      user_id: exam.doctor_id,
      title: "Exame Excluído",
      message: `Exame de ${exam.exam_type} foi excluído do sistema`,
      type: "exam_deleted",
    })

    return NextResponse.json({
      success: true,
      message: "Exame excluído com sucesso",
    })
  } catch (error) {
    console.error("Erro ao excluir exame:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
