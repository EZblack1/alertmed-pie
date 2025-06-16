import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar notificações da clínica
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
    const type = searchParams.get("type")
    const read = searchParams.get("read")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Construir query para todas as notificações
    let query = supabase
      .from("notifications")
      .select(`
        *,
        user:profiles!notifications_user_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (type) {
      query = query.eq("type", type)
    }
    if (read !== null) {
      query = query.eq("read", read === "true")
    }

    const { data: notifications, error } = await query

    if (error) {
      throw error
    }

    // Buscar estatísticas
    const { data: allNotifications } = await supabase.from("notifications").select("type, read")

    const statistics = {
      total: allNotifications?.length || 0,
      unread: allNotifications?.filter((n) => !n.read).length || 0,
      by_type: {
        exam_result: allNotifications?.filter((n) => n.type === "exam_result").length || 0,
        medication_reminder: allNotifications?.filter((n) => n.type === "medication_reminder").length || 0,
        appointment_reminder: allNotifications?.filter((n) => n.type === "appointment_reminder").length || 0,
      },
    }

    return NextResponse.json({
      success: true,
      data: notifications,
      statistics,
      pagination: {
        limit,
        offset,
        total: notifications?.length || 0,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar notificações:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// POST - Criar notificação para pacientes
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

    // Verificar se é admin/clínica
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "admin") {
      return NextResponse.json({ error: "Acesso negado - apenas administradores" }, { status: 403 })
    }

    const { user_ids, type, content, related_id } = body

    if (!user_ids || !Array.isArray(user_ids) || !type || !content) {
      return NextResponse.json({ error: "user_ids, type e content são obrigatórios" }, { status: 400 })
    }

    // Criar notificações para múltiplos usuários
    const notifications = user_ids.map((user_id) => ({
      user_id,
      type,
      content,
      related_id: related_id || null,
      read: false,
      created_at: new Date().toISOString(),
    }))

    const { data: createdNotifications, error } = await supabase.from("notifications").insert(notifications).select()

    if (error) {
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: `${createdNotifications?.length || 0} notificações criadas com sucesso`,
        data: createdNotifications,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Erro ao criar notificações:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
