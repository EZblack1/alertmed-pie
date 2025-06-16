import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Gerar relatórios da clínica
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

    // Parâmetros do relatório
    const report_type = searchParams.get("type") || "general"
    const date_from = searchParams.get("date_from")
    const date_to = searchParams.get("date_to")
    const doctor_id = searchParams.get("doctor_id")
    const specialty = searchParams.get("specialty")

    // Definir período padrão (último mês)
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1)

    const startDate = date_from ? new Date(date_from) : defaultStartDate
    const endDate = date_to ? new Date(date_to) : defaultEndDate

    let reportData: any = {}

    switch (report_type) {
      case "appointments":
        reportData = await generateAppointmentsReport(supabase, startDate, endDate, doctor_id, specialty)
        break

      case "exams":
        reportData = await generateExamsReport(supabase, startDate, endDate, doctor_id)
        break

      case "financial":
        reportData = await generateFinancialReport(supabase, startDate, endDate, doctor_id, specialty)
        break

      case "patients":
        reportData = await generatePatientsReport(supabase, startDate, endDate)
        break

      default:
        reportData = await generateGeneralReport(supabase, startDate, endDate)
    }

    return NextResponse.json({
      success: true,
      report_type,
      period: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
      data: reportData,
    })
  } catch (error: any) {
    console.error("Erro ao gerar relatório:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// Função para relatório de consultas
async function generateAppointmentsReport(
  supabase: any,
  startDate: Date,
  endDate: Date,
  doctor_id?: string | null,
  specialty?: string | null,
) {
  let query = supabase
    .from("appointments")
    .select(`
      id,
      appointment_date,
      status,
      specialty,
      appointment_type,
      duration,
      patient:profiles!appointments_patient_id_fkey(
        full_name,
        email
      ),
      doctor:profiles!appointments_doctor_id_fkey(
        full_name,
        email
      )
    `)
    .gte("appointment_date", startDate.toISOString())
    .lte("appointment_date", endDate.toISOString())

  if (doctor_id) {
    query = query.eq("doctor_id", doctor_id)
  }
  if (specialty) {
    query = query.eq("specialty", specialty)
  }

  const { data: appointments } = await query

  // Estatísticas
  const stats = {
    total: appointments?.length || 0,
    by_status: {
      scheduled: appointments?.filter((a) => a.status === "scheduled").length || 0,
      completed: appointments?.filter((a) => a.status === "completed").length || 0,
      cancelled: appointments?.filter((a) => a.status === "cancelled").length || 0,
      rescheduled: appointments?.filter((a) => a.status === "rescheduled").length || 0,
    },
    by_specialty: {},
    by_type: {},
    by_doctor: {},
  }

  // Agrupar por especialidade
  appointments?.forEach((app) => {
    if (app.specialty) {
      stats.by_specialty[app.specialty] = (stats.by_specialty[app.specialty] || 0) + 1
    }
    if (app.appointment_type) {
      stats.by_type[app.appointment_type] = (stats.by_type[app.appointment_type] || 0) + 1
    }
    if (app.doctor?.full_name) {
      stats.by_doctor[app.doctor.full_name] = (stats.by_doctor[app.doctor.full_name] || 0) + 1
    }
  })

  return {
    appointments,
    statistics: stats,
  }
}

// Função para relatório de exames
async function generateExamsReport(supabase: any, startDate: Date, endDate: Date, doctor_id?: string | null) {
  let query = supabase
    .from("exams")
    .select(`
      id,
      exam_type,
      exam_date,
      status,
      urgency,
      result_available,
      created_at,
      patient:profiles!exams_patient_id_fkey(
        full_name,
        email
      ),
      doctor:profiles!exams_doctor_id_fkey(
        full_name,
        email
      )
    `)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())

  if (doctor_id) {
    query = query.eq("doctor_id", doctor_id)
  }

  const { data: exams } = await query

  // Estatísticas
  const stats = {
    total: exams?.length || 0,
    by_status: {
      requested: exams?.filter((e) => e.status === "requested").length || 0,
      scheduled: exams?.filter((e) => e.status === "scheduled").length || 0,
      in_progress: exams?.filter((e) => e.status === "in_progress").length || 0,
      completed: exams?.filter((e) => e.status === "completed").length || 0,
      cancelled: exams?.filter((e) => e.status === "cancelled").length || 0,
    },
    by_urgency: {
      baixa: exams?.filter((e) => e.urgency === "baixa").length || 0,
      media: exams?.filter((e) => e.urgency === "media").length || 0,
      alta: exams?.filter((e) => e.urgency === "alta").length || 0,
    },
    by_type: {},
    pending_results: exams?.filter((e) => !e.result_available).length || 0,
  }

  // Agrupar por tipo
  exams?.forEach((exam) => {
    if (exam.exam_type) {
      stats.by_type[exam.exam_type] = (stats.by_type[exam.exam_type] || 0) + 1
    }
  })

  return {
    exams,
    statistics: stats,
  }
}

// Função para relatório financeiro (simulado)
async function generateFinancialReport(
  supabase: any,
  startDate: Date,
  endDate: Date,
  doctor_id?: string | null,
  specialty?: string | null,
) {
  // Buscar consultas concluídas
  let query = supabase
    .from("appointments")
    .select(`
      id,
      appointment_date,
      specialty,
      appointment_type,
      duration,
      doctor:profiles!appointments_doctor_id_fkey(
        full_name
      )
    `)
    .eq("status", "completed")
    .gte("appointment_date", startDate.toISOString())
    .lte("appointment_date", endDate.toISOString())

  if (doctor_id) {
    query = query.eq("doctor_id", doctor_id)
  }
  if (specialty) {
    query = query.eq("specialty", specialty)
  }

  const { data: completedAppointments } = await query

  // Buscar exames concluídos
  const { data: completedExams } = await supabase
    .from("exams")
    .select("id, exam_type, status")
    .eq("status", "completed")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())

  // Valores simulados (em produção, viria de uma tabela de preços)
  const appointmentPrice = 150.0
  const examPrices: { [key: string]: number } = {
    "Hemograma Completo": 50.0,
    Glicemia: 25.0,
    "Colesterol Total": 30.0,
    "Raio-X de Tórax": 80.0,
    "Ultrassom Abdominal": 120.0,
    Eletrocardiograma: 60.0,
  }

  const appointmentRevenue = (completedAppointments?.length || 0) * appointmentPrice
  const examRevenue =
    completedExams?.reduce((total, exam) => {
      return total + (examPrices[exam.exam_type] || 100.0)
    }, 0) || 0

  return {
    revenue: {
      appointments: appointmentRevenue,
      exams: examRevenue,
      total: appointmentRevenue + examRevenue,
    },
    volume: {
      appointments: completedAppointments?.length || 0,
      exams: completedExams?.length || 0,
    },
    by_specialty: {},
    by_doctor: {},
  }
}

// Função para relatório de pacientes
async function generatePatientsReport(supabase: any, startDate: Date, endDate: Date) {
  // Buscar pacientes cadastrados no período
  const { data: newPatients } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      phone,
      date_of_birth,
      created_at
    `)
    .eq("user_type", "patient")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())

  // Buscar total de pacientes
  const { count: totalPatients } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("user_type", "patient")

  // Buscar pacientes ativos (com consultas no período)
  const { data: activePatients } = await supabase
    .from("appointments")
    .select("patient_id")
    .gte("appointment_date", startDate.toISOString())
    .lte("appointment_date", endDate.toISOString())

  const uniqueActivePatients = new Set(activePatients?.map((a) => a.patient_id))

  return {
    new_patients: newPatients,
    statistics: {
      new_registrations: newPatients?.length || 0,
      total_patients: totalPatients || 0,
      active_patients: uniqueActivePatients.size,
      retention_rate: totalPatients ? ((uniqueActivePatients.size / totalPatients) * 100).toFixed(2) : 0,
    },
  }
}

// Função para relatório geral
async function generateGeneralReport(supabase: any, startDate: Date, endDate: Date) {
  const appointmentsData = await generateAppointmentsReport(supabase, startDate, endDate)
  const examsData = await generateExamsReport(supabase, startDate, endDate)
  const patientsData = await generatePatientsReport(supabase, startDate, endDate)
  const financialData = await generateFinancialReport(supabase, startDate, endDate)

  return {
    summary: {
      appointments: appointmentsData.statistics,
      exams: examsData.statistics,
      patients: patientsData.statistics,
      financial: financialData.revenue,
    },
    highlights: [
      `${appointmentsData.statistics.total} consultas realizadas`,
      `${examsData.statistics.total} exames solicitados`,
      `${patientsData.statistics.new_registrations} novos pacientes`,
      `R$ ${financialData.revenue.total.toFixed(2)} em receita`,
    ],
  }
}
