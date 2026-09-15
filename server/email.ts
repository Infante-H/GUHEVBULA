import { ENV } from "./_core/env";

export type TransactionalEmailType =
  | "account_created"
  | "password_recovery"
  | "enrollment_confirmed"
  | "payment_confirmed"
  | "course_assigned"
  | "new_assignment"
  | "assignment_graded"
  | "new_grade"
  | "certificate_available"
  | "company_invitation"
  | "company_approved"
  | "company_rejected";

export type TransactionalEmail = {
  to: string;
  type: TransactionalEmailType;
  subject: string;
  text: string;
  html?: string;
};

const subjects: Record<TransactionalEmailType, string> = {
  account_created: "Bem-vindo à VUKA Academy",
  password_recovery: "Recuperação de acesso à VUKA Academy",
  enrollment_confirmed: "Matrícula confirmada",
  payment_confirmed: "Pagamento confirmado",
  course_assigned: "Novo curso atribuído",
  new_assignment: "Novo trabalho disponível",
  assignment_graded: "Trabalho corrigido",
  new_grade: "Nova nota disponível",
  certificate_available: "O seu certificado está disponível",
  company_invitation: "Convite para colaborar na VUKA Academy",
  company_approved: "Empresa aprovada na VUKA Academy",
  company_rejected: "Atualização da candidatura empresarial",
};

export function buildTransactionalEmail(input: { to: string; type: TransactionalEmailType; body: string; subject?: string }): TransactionalEmail {
  const subject = input.subject ?? subjects[input.type];
  const safeBody = input.body.trim();
  return {
    to: input.to,
    type: input.type,
    subject,
    text: `${safeBody}\n\nVUKA Academy`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#142335"><h2>${subject}</h2><p>${safeBody.replace(/\n/g, "</p><p>")}</p><p style="color:#6a7780">VUKA Academy</p></div>`,
  };
}

export async function sendTransactionalEmail(email: TransactionalEmail): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!ENV.emailProviderUrl || !ENV.emailProviderKey || !ENV.emailFrom) {
    console.info(`[Email] skipped ${email.type}: email provider is not configured`);
    return { sent: false, skipped: true };
  }
  try {
    const response = await fetch(ENV.emailProviderUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ENV.emailProviderKey}` },
      body: JSON.stringify({ from: ENV.emailFrom, replyTo: ENV.emailReplyTo || undefined, to: email.to, subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`provider returned ${response.status}`);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown email provider error";
    console.error(`[Email] failed ${email.type} to ${email.to}: ${message}`);
    return { sent: false, error: message };
  }
}

export async function sendNotificationEmail(input: { to?: string | null; type: TransactionalEmailType; body: string; subject?: string }) {
  const to = input.to;
  if (!to) return { sent: false, skipped: true } as const;
  return sendTransactionalEmail(buildTransactionalEmail({ ...input, to }));
}

export const transactionalEmailSubjects = subjects;
