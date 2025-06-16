import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Dashboard da clínica com estatísticas
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

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

    // Buscar estatísticas gerais
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // Consultas
    const { data: allAppointments } = await supabase
      .from("appointments")
      .select("id, status, appointment_date, created_at")

    const { data: todayAppointments } = await supabase
      .from("appointments")
      .select("id, status")
      .gte("appointment_date", startOfDay.toISOString())
      .lte("appointment_date", endOfDay.toISOString())

    // Exames
    const { data: allExams } = await supabase.from("exams").select("id, status, result_available, created_at")

    const { data: pendingExams } = await supabase.from("exams").select("id").eq("result_available", false)

    // Pacientes
    const { data: allPatients } = await supabase.from("profiles").select("id, created_at").eq("user_type", "patient")

    const { data: newPatientsThisMonth } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_type", "patient")
      .gte("created_at", startOfMonth.toISOString())

    // Médicos
    const { data: allDoctors } = await supabase.from("profiles").select("id, full_name").eq("user_type", "doctor")

    // Notificações não lidas
    const { data: unreadNotifications } = await supabase.from("notifications").select("id").eq("read", false)

    // Consultas por especialidade
    const { data: appointmentsBySpecialty } = await supabase
      .from("appointments")
      .select("specialty")
      .not("specialty", "is", null)

    const specialtyStats =
      appointmentsBySpecialty?.reduce((acc: any, app) => {
        acc[app.specialty] = (acc[app.specialty] || 0) + 1
        return acc
      }, {}) || {}

    // Consultas por status
    const appointmentStats = {
      total: allAppointments?.length || 0,
      scheduled: allAppointments?.filter((a) => a.status === "scheduled").length || 0,
      completed: allAppointments?.filter((a) => a.status === "completed").length || 0,
      cancelled: allAppointments?.filter((a) => a.status === "cancelled").length || 0,
      today: todayAppointments?.length || 0,
      today_completed: todayAppointments?.filter((a) => a.status === "completed").length || 0,
    }

    // Exames por status
    const examStats = {
      total: allExams?.length || 0,
      pending: pendingExams?.length || 0,
      completed: allExams?.filter((e) => e.result_available).length || 0,
      requested: allExams?.filter((e) => e.status === "requested").length || 0,
      in_progress: allExams?.filter((e) => e.status === "in_progress").length || 0,
    }

    // Estatísticas de pacientes
    const patientStats = {
      total: allPatients?.length || 0,
      new_this_month: newPatientsThisMonth?.length || 0,
      active:
        allPatients?.filter((p) => {
          const createdDate = new Date(p.created_at)
          return createdDate >= startOfMonth
        }).length || 0,
    }

    // Próximas consultas (hoje e amanhã)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0))
    const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999))

    const { data: upcomingAppointments } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        specialty,
        status,
        patient:profiles!appointments_patient_id_fkey(
          full_name,
          phone
        ),
        doctor:profiles!appointments_doctor_id_fkey(
          full_name
        )
      `)
      .eq("status", "scheduled")
      .gte("appointment_date", new Date().toISOString())
      .lte("appointment_date", endOfTomorrow.toISOString())
      .order("appointment_date", { ascending: true })
      .limit(10)

    // Exames urgentes
    const { data: urgentExams } = await supabase
      .from("exams")
      .select(`
        id,
        exam_type,
        urgency,
        created_at,
        patient:profiles!exams_patient_id_fkey(
          full_name,
          phone
        )
      `)
      .eq("urgency", "alta")
      .eq("result_available", false)
      .order("created_at", { ascending: true })
      .limit(5)

    const dashboard = {
      statistics: {
        appointments: appointmentStats,
        exams: examStats,
        patients: patientStats,
        doctors: allDoctors?.length || 0,
        unread_notifications: unreadNotifications?.length || 0,
      },
      charts: {
        appointments_by_specialty: specialtyStats,
        appointments_trend: [], // Pode ser implementado com dados históricos
        exams_trend: [], // Pode ser implementado com dados históricos
      },
      upcoming_appointments: upcomingAppointments,
      urgent_exams: urgentExams,
      alerts: [
        ...(pendingExams && pendingExams.length > 10
          ? [
              {
                type: "warning",
                message: `${pendingExams.length} exames pendentes de resultado`,
                action: "Ver exames pendentes",
              },
            ]
          : []),
        ...(urgentExams && urgentExams.length > 0
          ? [
              {
                type: "error",
                message: `${urgentExams.length} exames urgentes aguardando`,
                action: "Ver exames urgentes",
              },
            ]
          : []),
      ],
    }

    return NextResponse.json({
      success: true,
      data: dashboard,
    })
  } catch (error: any) {
    console.error("Erro ao buscar dashboard:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
