import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar medicamentos prescritos pelo médico
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
    const patient_id = searchParams.get("patient_id")
    const active = searchParams.get("active")
    const medication_name = searchParams.get("medication_name")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Construir query
    let query = supabase
      .from("medications")
      .select(`
        *,
        patient:profiles!medications_patient_id_fkey(
          id,
          full_name,
          email,
          phone
        ),
        schedules:medication_schedules(*)
      `)
      .eq("doctor_id", session.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (patient_id) {
      query = query.eq("patient_id", patient_id)
    }
    if (active === "true") {
      query = query.eq("active", true)
    } else if (active === "false") {
      query = query.eq("active", false)
    }
    if (medication_name) {
      query = query.ilike("medication_name", `%${medication_name}%`)
    }

    const { data: medications, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: medications,
      pagination: {
        limit,
        offset,
        total: medications?.length || 0,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar medicamentos:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// POST - Prescrever novo medicamento
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
    const { patient_id, medication_name, dosage, frequency, start_date, end_date, instructions, schedules = [] } = body

    if (!patient_id || !medication_name || !dosage || !frequency || !start_date) {
      return NextResponse.json(
        { error: "patient_id, medication_name, dosage, frequency e start_date são obrigatórios" },
        { status: 400 },
      )
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

    // Criar medicamento
    const { data: medication, error } = await supabase
      .from("medications")
      .insert({
        patient_id,
        doctor_id: session.user.id,
        medication_name,
        dosage,
        frequency,
        start_date: new Date(start_date).toISOString(),
        end_date: end_date ? new Date(end_date).toISOString() : null,
        instructions,
        active: true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Criar horários de medicação se fornecidos
    if (schedules.length > 0 && medication) {
      const schedulesData = schedules.map((time: string) => ({
        medication_id: medication.id,
        scheduled_time: new Date(time).toISOString(),
        taken: false,
      }))

      const { error: schedulesError } = await supabase.from("medication_schedules").insert(schedulesData)

      if (schedulesError) {
        console.error("Erro ao criar horários de medicação:", schedulesError)
      }
    }

    // Criar notificação para o paciente
    await supabase.from("notifications").insert({
      user_id: patient_id,
      type: "medication_reminder",
      content: `Novo medicamento prescrito: ${medication_name}, ${dosage}, ${frequency}`,
      related_id: medication?.id,
      read: false,
    })

    return NextResponse.json(
      {
        success: true,
        message: "Medicamento prescrito com sucesso",
        data: medication,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Erro ao prescrever medicamento:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
