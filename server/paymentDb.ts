import { and, desc, eq, ne, or } from "drizzle-orm";
import { courses, enrollments, notifications, payments, users } from "../drizzle/schema";
import { getDb } from "./db";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded";

function effectiveAmount(course: { price: string | number; promotionalPrice?: string | number | null; pricingType?: string | null }) {
  if (course.pricingType === "free") return "0.00";
  return String(course.promotionalPrice ?? course.price ?? "0.00");
}

export async function getCheckoutCourse(courseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.status, "published"), eq(courses.commercialStatus, "available"))).limit(1);
  const course = rows[0];
  if (!course) return undefined;
  return { ...course, effectiveAmount: effectiveAmount(course), isFree: course.pricingType === "free" || Number(effectiveAmount(course)) === 0 };
}

async function notify(userId: number, title: string, body: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({ userId, type: "payment", title, body });
}

export async function createCheckoutPayment(input: { userId: number; courseId: number; acceptedTerms: boolean }) {
  if (!input.acceptedTerms) throw new Error("É necessário aceitar os termos para continuar.");
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const course = await getCheckoutCourse(input.courseId);
  if (!course) throw new Error("Curso indisponível para compra.");
  const existingEnrollment = await db.select().from(enrollments).where(and(eq(enrollments.userId, input.userId), eq(enrollments.courseId, input.courseId))).limit(1);
  if (existingEnrollment[0]?.status === "active" || existingEnrollment[0]?.status === "completed") return { kind: "already_enrolled" as const, enrollmentId: existingEnrollment[0].id, courseId: input.courseId };
  if (course.isFree) {
    const enrollment = existingEnrollment[0]
      ? await db.update(enrollments).set({ status: "active", enrolledAt: new Date(), completedAt: null }).where(eq(enrollments.id, existingEnrollment[0].id))
      : await db.insert(enrollments).values({ userId: input.userId, courseId: input.courseId, status: "active", cohort: "Geral" });
    await notify(input.userId, "Matrícula confirmada", `O curso ${course.title} está disponível na sua área de aprendizagem.`);
    return { kind: "free" as const, enrollmentId: Number((enrollment as any)[0]?.insertId ?? existingEnrollment[0]?.id ?? 0), courseId: input.courseId };
  }
  const prior = await db.select().from(payments).where(and(eq(payments.userId, input.userId), eq(payments.courseId, input.courseId), or(eq(payments.status, "pending"), eq(payments.status, "processing"), eq(payments.status, "paid")))).orderBy(desc(payments.createdAt)).limit(1);
  if (prior[0]) return { kind: "payment" as const, paymentId: prior[0].id, status: prior[0].status, amount: prior[0].amount, currency: prior[0].currency, provider: prior[0].provider, transactionId: prior[0].transactionId };
  const result = await db.insert(payments).values({ userId: input.userId, courseId: input.courseId, amount: course.effectiveAmount, currency: course.currency, status: "pending", provider: "manual_pending" });
  return { kind: "payment" as const, paymentId: Number(result[0].insertId), status: "pending" as const, amount: course.effectiveAmount, currency: course.currency, provider: "manual_pending", transactionId: null };
}

export async function confirmPayment(input: { paymentId: number; status: Extract<PaymentStatus, "paid" | "failed" | "cancelled" | "refunded">; transactionId?: string; provider?: string; actorId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const rows = await db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
  const payment = rows[0];
  if (!payment) throw new Error("Pagamento não encontrado.");
  if (payment.status === "paid" && input.status === "paid") return { success: true, idempotent: true, paymentId: payment.id, enrollmentId: undefined };
  if (payment.status === "paid" && input.status !== "paid") throw new Error("Um pagamento confirmado não pode ser revertido por este fluxo.");
  if (input.status === "paid" && !input.transactionId) throw new Error("transactionId é obrigatório para confirmar um pagamento.");
  if (input.transactionId) {
    const duplicate = await db.select().from(payments).where(and(eq(payments.transactionId, input.transactionId), ne(payments.id, input.paymentId))).limit(1);
    if (duplicate[0]) throw new Error("transactionId já utilizado por outro pagamento.");
  }
  await db.update(payments).set({ status: input.status, transactionId: input.transactionId ?? payment.transactionId, provider: input.provider ?? payment.provider }).where(eq(payments.id, payment.id));
  if (input.status !== "paid") return { success: true, idempotent: false, paymentId: payment.id, enrollmentId: undefined };
  const existing = await db.select().from(enrollments).where(and(eq(enrollments.userId, payment.userId), eq(enrollments.courseId, payment.courseId))).limit(1);
  let enrollmentId = existing[0]?.id;
  if (existing[0]) await db.update(enrollments).set({ status: "active", enrolledAt: new Date(), completedAt: null }).where(eq(enrollments.id, existing[0].id));
  else { const enrollment = await db.insert(enrollments).values({ userId: payment.userId, courseId: payment.courseId, status: "active", cohort: "Geral" }); enrollmentId = Number(enrollment[0].insertId); }
  const course = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, payment.courseId)).limit(1);
  await notify(payment.userId, "Pagamento confirmado", `A sua matrícula em ${course[0]?.title ?? "o curso"} foi ativada.`);
  return { success: true, idempotent: false, paymentId: payment.id, enrollmentId };
}

export async function getStudentPayments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ payment: payments, course: courses }).from(payments).innerJoin(courses, eq(courses.id, payments.courseId)).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  return rows.map(row => ({ ...row.payment, course: row.course }));
}

export async function listAdminPayments(filters: { status?: PaymentStatus; provider?: string; userId?: number; courseId?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.status) conditions.push(eq(payments.status, filters.status));
  if (filters.provider) conditions.push(eq(payments.provider, filters.provider));
  if (filters.userId) conditions.push(eq(payments.userId, filters.userId));
  if (filters.courseId) conditions.push(eq(payments.courseId, filters.courseId));
  const rows = await db.select({ payment: payments, course: courses, user: users }).from(payments).innerJoin(courses, eq(courses.id, payments.courseId)).innerJoin(users, eq(users.id, payments.userId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(payments.createdAt));
  return rows.map(row => ({ ...row.payment, course: row.course, user: row.user }));
}

export async function getPaymentById(paymentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return rows[0];
}

export async function getPaymentFilterOptions() {
  const rows = await listAdminPayments();
  return { providers: Array.from(new Set(rows.map(row => row.provider))), statuses: ["pending", "processing", "paid", "failed", "cancelled", "refunded"] as PaymentStatus[] };
}
