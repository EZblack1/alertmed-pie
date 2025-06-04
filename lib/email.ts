// Simulação de serviço de email - em produção, usar Resend, SendGrid, etc.

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

interface AppointmentEmailData {
  patientName: string
  patientEmail: string
  appointmentDate: string
  appointmentTime: string
  specialty: string
  doctor?: string
  appointmentType: string
  notes?: string
}

export async function sendAppointmentConfirmationEmail(data: AppointmentEmailData): Promise<boolean> {
  try {
    const emailHtml = generateAppointmentEmailHTML(data)
    const emailText = generateAppointmentEmailText(data)

    // Em produção, aqui você usaria um serviço real de email
    // Por exemplo: Resend, SendGrid, Nodemailer, etc.

    console.log("📧 Email de confirmação enviado para:", data.patientEmail)
    console.log("📋 Assunto:", "Confirmação de Agendamento - AlertMed")
    console.log("📄 Conteúdo:", emailText)

    // Simular delay de envio
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simular sucesso (em produção, verificar resposta real do serviço)
    return true
  } catch (error) {
    console.error("Erro ao enviar email:", error)
    return false
  }
}

function generateAppointmentEmailHTML(data: AppointmentEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Confirmação de Agendamento</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .appointment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .detail-label { font-weight: bold; color: #64748b; }
        .detail-value { color: #1e293b; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .logo { font-size: 24px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">❤️ AlertMed</div>
          <h1>Consulta Agendada com Sucesso!</h1>
        </div>
        
        <div class="content">
          <p>Olá <strong>${data.patientName}</strong>,</p>
          
          <p>Sua consulta foi agendada com sucesso! Confira os detalhes abaixo:</p>
          
          <div class="appointment-details">
            <h3>📅 Detalhes da Consulta</h3>
            
            <div class="detail-row">
              <span class="detail-label">Data:</span>
              <span class="detail-value">${data.appointmentDate}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Horário:</span>
              <span class="detail-value">${data.appointmentTime}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Especialidade:</span>
              <span class="detail-value">${data.specialty}</span>
            </div>
            
            ${
              data.doctor
                ? `
            <div class="detail-row">
              <span class="detail-label">Médico:</span>
              <span class="detail-value">${data.doctor}</span>
            </div>
            `
                : ""
            }
            
            <div class="detail-row">
              <span class="detail-label">Tipo de Consulta:</span>
              <span class="detail-value">${getAppointmentTypeLabel(data.appointmentType)}</span>
            </div>
            
            ${
              data.notes
                ? `
            <div class="detail-row">
              <span class="detail-label">Observações:</span>
              <span class="detail-value">${data.notes}</span>
            </div>
            `
                : ""
            }
          </div>
          
          <h3>📋 Instruções Importantes</h3>
          <ul>
            <li>Chegue com 15 minutos de antecedência</li>
            <li>Traga um documento de identidade com foto</li>
            <li>Traga seu cartão do convênio (se aplicável)</li>
            <li>Traga exames anteriores relacionados à consulta</li>
            <li>Em caso de cancelamento, avise com pelo menos 24h de antecedência</li>
          </ul>
          
          <p>Se precisar reagendar ou cancelar, acesse sua conta no AlertMed ou entre em contato conosco.</p>
          
          <p>Atenciosamente,<br><strong>Equipe AlertMed</strong></p>
        </div>
        
        <div class="footer">
          <p>Este é um email automático, não responda a esta mensagem.</p>
          <p>© 2024 AlertMed - Sistema de Gestão de Saúde</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function generateAppointmentEmailText(data: AppointmentEmailData): string {
  return `
CONSULTA AGENDADA COM SUCESSO - AlertMed

Olá ${data.patientName},

Sua consulta foi agendada com sucesso! Confira os detalhes abaixo:

DETALHES DA CONSULTA:
- Data: ${data.appointmentDate}
- Horário: ${data.appointmentTime}
- Especialidade: ${data.specialty}
${data.doctor ? `- Médico: ${data.doctor}` : ""}
- Tipo de Consulta: ${getAppointmentTypeLabel(data.appointmentType)}
${data.notes ? `- Observações: ${data.notes}` : ""}

INSTRUÇÕES IMPORTANTES:
- Chegue com 15 minutos de antecedência
- Traga um documento de identidade com foto
- Traga seu cartão do convênio (se aplicável)
- Traga exames anteriores relacionados à consulta
- Em caso de cancelamento, avise com pelo menos 24h de antecedência

Se precisar reagendar ou cancelar, acesse sua conta no AlertMed ou entre em contato conosco.

Atenciosamente,
Equipe AlertMed

---
Este é um email automático, não responda a esta mensagem.
© 2024 AlertMed - Sistema de Gestão de Saúde
  `
}

function getAppointmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    "primeira-consulta": "Primeira Consulta",
    retorno: "Retorno",
    urgencia: "Urgência",
    "check-up": "Check-up",
  }
  return labels[type] || type
}

export async function logEmailSent(
  userId: string,
  emailType: string,
  recipientEmail: string,
  subject: string,
  content: string,
  success: boolean,
  relatedId?: string,
  errorMessage?: string,
) {
  // Em produção, salvar no banco de dados
  console.log("📝 Log de email salvo:", {
    userId,
    emailType,
    recipientEmail,
    subject,
    success,
    relatedId,
    errorMessage,
  })
}
