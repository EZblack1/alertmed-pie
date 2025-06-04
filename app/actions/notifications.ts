"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function markNotificationAsRead(id: string) {
  const supabase = createClient()

  await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id)

  redirect("/dashboard/notificacoes")
}

export async function markAllNotificationsAsRead(userId: string) {
  const supabase = createClient()

  // Buscar todas as notificações não lidas do usuário
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("read", false)

  if (!notifications || notifications.length === 0) return

  const notificationIds = notifications.map((notification) => notification.id)

  await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .in("id", notificationIds)

  redirect("/dashboard/notificacoes")
}
