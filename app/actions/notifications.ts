"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function markNotificationAsRead(id: string) {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error)
      return { success: false, error: error.message }
    }

    // Revalidar a página de notificações para atualizar os dados
    revalidatePath("/dashboard/notificacoes")

    return { success: true }
  } catch (error: any) {
    console.error("Erro ao marcar notificação como lida:", error)
    return { success: false, error: error.message }
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  const supabase = createClient()

  try {
    // Buscar todas as notificações não lidas do usuário
    const { data: notifications, error: fetchError } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("read", false)

    if (fetchError) {
      console.error("Erro ao buscar notificações:", fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!notifications || notifications.length === 0) {
      return { success: true, message: "Nenhuma notificação para marcar como lida" }
    }

    const notificationIds = notifications.map((notification) => notification.id)

    const { error: updateError } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .in("id", notificationIds)

    if (updateError) {
      console.error("Erro ao atualizar notificações:", updateError)
      return { success: false, error: updateError.message }
    }

    // Revalidar a página de notificações para atualizar os dados
    revalidatePath("/dashboard/notificacoes")

    return {
      success: true,
      message: `${notifications.length} notificações marcadas como lidas`,
    }
  } catch (error: any) {
    console.error("Erro ao marcar todas as notificações como lidas:", error)
    return { success: false, error: error.message }
  }
}

export async function deleteNotification(id: string) {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("notifications").delete().eq("id", id)

    if (error) {
      console.error("Erro ao deletar notificação:", error)
      return { success: false, error: error.message }
    }

    // Revalidar a página de notificações para atualizar os dados
    revalidatePath("/dashboard/notificacoes")

    return { success: true }
  } catch (error: any) {
    console.error("Erro ao deletar notificação:", error)
    return { success: false, error: error.message }
  }
}

export async function createNotification(data: {
  userId: string
  title: string
  message: string
  type: string
  relatedId?: string
}) {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      related_id: data.relatedId,
      read: false,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error("Erro ao criar notificação:", error)
      return { success: false, error: error.message }
    }

    // Revalidar páginas relevantes
    revalidatePath("/dashboard/notificacoes")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error: any) {
    console.error("Erro ao criar notificação:", error)
    return { success: false, error: error.message }
  }
}
