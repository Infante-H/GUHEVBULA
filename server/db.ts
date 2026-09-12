import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  assignmentSubmissions,
  assignments,
  categories,
  certificates,
  courseInstructors,
  courses,
  enrollments,
  grades,
  lessons,
  modules,
  profiles,
  quizAttempts,
  quizQuestions,
  quizzes,
  studentProgress,
  users,
  companyPartnershipApplications,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPublishedCourses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courses).where(eq(courses.status, "published")).orderBy(desc(courses.createdAt));
}

export async function createPartnershipApplication(input: {
  companyName: string;
  contactName: string;
  businessEmail: string;
  phone?: string;
  country?: string;
  city?: string;
  sector?: string;
  employeeCount?: number;
  trainingCount?: number;
  interests?: string;
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(companyPartnershipApplications).values({ ...input, acceptedTerms: true });
  return Number(result[0].insertId);
}

export async function listAdminCourses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courses).orderBy(desc(courses.createdAt));
}

export async function listAdminCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(categories.name);
}

export async function listAdminInstructors() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.role, "formador"))
    .orderBy(users.name);
}

export async function createAdminCategory(input: { name: string; slug: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(categories).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminCategory(input: { id: number; name: string; slug: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(categories).set({ name: input.name, slug: input.slug, description: input.description }).where(eq(categories.id, input.id));
  return { success: true };
}

export async function deleteAdminCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(categories).where(eq(categories.id, id));
  return { success: true };
}

export async function createAdminCourse(input: {
  title: string;
  slug: string;
  description: string;
  categoryId?: number;
  level: "iniciante" | "intermedio" | "avancado";
  price: string;
  status: "draft" | "published" | "archived";
  certificateEnabled: boolean;
  requirements?: string;
  objectives?: string;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(courses).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminCourse(input: {
  id: number;
  title: string;
  slug: string;
  description: string;
  categoryId?: number;
  level: "iniciante" | "intermedio" | "avancado";
  price: string;
  status: "draft" | "published" | "archived";
  certificateEnabled: boolean;
  requirements?: string;
  objectives?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(courses).set({
    title: input.title,
    slug: input.slug,
    description: input.description,
    categoryId: input.categoryId,
    level: input.level,
    price: input.price,
    status: input.status,
    certificateEnabled: input.certificateEnabled,
    requirements: input.requirements,
    objectives: input.objectives,
  }).where(eq(courses.id, input.id));
  return { success: true };
}

export async function deleteAdminCourse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(courses).where(eq(courses.id, id));
  return { success: true };
}

export async function createInstructor(input: { name: string; email: string; openId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(users).values({ ...input, role: "formador", loginMethod: "admin-invite" });
  return Number(result[0].insertId);
}

export async function updateInstructor(input: { id: number; name: string; email: string; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(users).set({ name: input.name, email: input.email, isActive: input.isActive, role: "formador" }).where(eq(users.id, input.id));
  return { success: true };
}

export async function deleteInstructor(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(users).set({ isActive: false }).where(eq(users.id, id));
  return { success: true };
}

export async function assignCourseInstructor(input: { courseId: number; userId: number; assignedBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(courseInstructors).values(input).onDuplicateKeyUpdate({ set: { assignedBy: input.assignedBy } });
  return { success: true };
}

const fallbackLearning = {
  course: {
    id: 1,
    title: "Fundamentos de Gestão de Projetos",
    description: "Aprenda a planear, executar e entregar projetos com mais clareza, ritmo e impacto.",
    level: "iniciante",
    lessonsTotal: 5,
    completedLessons: 2,
    progress: 40,
    certificateEnabled: true,
  },
  modules: [
    { id: 1, title: "Começar com clareza", position: 1, lessons: [{ id: 101, title: "O que faz um projeto avançar", type: "video", durationMinutes: 14, completed: true, description: "Uma introdução aos elementos essenciais de um projeto bem conduzido." }, { id: 102, title: "Definir prioridades", type: "text", durationMinutes: 12, completed: true, description: "Como transformar objetivos em próximos passos concretos." }] },
    { id: 2, title: "Aplicar no dia a dia", position: 2, lessons: [{ id: 103, title: "Construir um plano simples", type: "pdf", durationMinutes: 18, completed: false, description: "Um modelo prático para organizar a execução e comunicar o caminho." }, { id: 104, title: "Comunicar o progresso", type: "video", durationMinutes: 16, completed: false, description: "Rituais simples para manter todas as pessoas alinhadas." }, { id: 105, title: "Revisão final", type: "text", durationMinutes: 10, completed: false, description: "Consolide as principais ideias antes do desafio final." }] },
  ],
  quiz: { id: 1, title: "Checkpoint: fundamentos", description: "Verifique o que já consegue aplicar.", passingScore: 70, questions: [{ id: 1, type: "multiple_choice", question: "Qual é o primeiro passo de um projeto bem conduzido?", options: ["Definir clareza e objetivo", "Comprar ferramentas", "Começar sem plano"], points: 1 }, { id: 2, type: "true_false", question: "Um bom plano precisa ser comunicado à equipa.", options: ["Verdadeiro", "Falso"], points: 1 }] },
  assignment: { id: 1, title: "Mapa do seu próximo projeto", instructions: "Descreva o objetivo, as prioridades e o primeiro passo de um projeto real.", maxScore: 100, dueAt: "2026-10-15" },
};

export async function getStudentDashboard(userId: number) {
  const db = await getDb();
  if (!db) return { ...fallbackLearning, courses: [fallbackLearning.course], certificates: [] };
  const studentEnrollments = await db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.status, "active")));
  if (studentEnrollments.length === 0) return { ...fallbackLearning, courses: [fallbackLearning.course], certificates: [] };
  const courseIds = studentEnrollments.map(item => item.courseId);
  const enrolledCourses = await db.select().from(courses).where(inArray(courses.id, courseIds));
  const progressRows = await db.select().from(studentProgress).where(eq(studentProgress.userId, userId));
  const certificateRows = await db.select().from(certificates).where(eq(certificates.userId, userId));
  const courseCards = enrolledCourses.map(course => ({ ...course, lessonsTotal: 0, completedLessons: progressRows.filter(row => row.isCompleted).length, progress: progressRows.length ? Math.round((progressRows.filter(row => row.isCompleted).length / Math.max(progressRows.length, 1)) * 100) : 0 }));
  return { courses: courseCards, certificates: certificateRows, activeCourse: courseCards[0] ?? fallbackLearning.course, modules: [], quiz: null, assignment: null };
}

export async function getCourseLearning(courseId: number, userId: number) {
  const db = await getDb();
  if (!db) return fallbackLearning;
  const courseRows = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!courseRows[0]) return fallbackLearning;
  const moduleRows = await db.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(modules.position);
  const moduleIds = moduleRows.map(item => item.id);
  const lessonRows = moduleIds.length ? await db.select().from(lessons).where(inArray(lessons.moduleId, moduleIds)).orderBy(lessons.position) : [];
  const progressRows = await db.select().from(studentProgress).where(and(eq(studentProgress.userId, userId), lessonRows.length ? inArray(studentProgress.lessonId, lessonRows.map(item => item.id)) : sql`1 = 0`));
  const completed = new Set(progressRows.filter(item => item.isCompleted).map(item => item.lessonId));
  const total = lessonRows.length;
  const done = completed.size;
  const quizRows = await db.select().from(quizzes).where(eq(quizzes.courseId, courseId)).limit(1);
  const quiz = quizRows[0] ? { ...quizRows[0], questions: await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizRows[0].id)).orderBy(quizQuestions.position) } : null;
  const assignmentRows = await db.select().from(assignments).where(eq(assignments.courseId, courseId)).limit(1);
  return { course: { ...courseRows[0], lessonsTotal: total, completedLessons: done, progress: total ? Math.round((done / total) * 100) : 0 }, modules: moduleRows.map(module => ({ ...module, lessons: lessonRows.filter(lesson => lesson.moduleId === module.id).map(lesson => ({ ...lesson, completed: completed.has(lesson.id) })) })), quiz, assignment: assignmentRows[0] ?? null };
}

export async function setLessonProgress(input: { userId: number; lessonId: number; completed: boolean }) {
  const db = await getDb();
  if (!db) return { success: true, completed: input.completed };
  await db.insert(studentProgress).values({ userId: input.userId, lessonId: input.lessonId, isCompleted: input.completed, completedAt: input.completed ? new Date() : null }).onDuplicateKeyUpdate({ set: { isCompleted: input.completed, completedAt: input.completed ? new Date() : null } });
  return { success: true, completed: input.completed };
}

export async function submitQuiz(input: { userId: number; quizId: number; answers: Record<string, string> }) {
  const db = await getDb();
  if (!db) return { score: 100, passed: true, attemptId: 0 };
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, input.quizId));
  const quizRows = await db.select().from(quizzes).where(eq(quizzes.id, input.quizId)).limit(1);
  const quiz = quizRows[0];
  if (!quiz) throw new Error("Quiz não encontrado");
  const total = questions.reduce((sum, question) => sum + question.points, 0) || 1;
  const correct = questions.reduce((sum, question) => {
    const answer = input.answers[String(question.id)]?.trim().toLowerCase();
    const options = Array.isArray(question.options) ? question.options : [];
    const expected = String(options[0] ?? "").trim().toLowerCase();
    return sum + (answer && expected && answer === expected ? question.points : 0);
  }, 0);
  const score = Math.round((correct / total) * 100);
  const result = await db.insert(quizAttempts).values({ quizId: input.quizId, userId: input.userId, answers: input.answers, score: String(score) });
  if (score >= quiz.passingScore) await db.insert(grades).values({ quizAttemptId: Number(result[0].insertId), graderId: input.userId, score: String(score), feedback: "Tentativa submetida automaticamente." });
  return { score, passed: score >= quiz.passingScore, attemptId: Number(result[0].insertId) };
}

export async function submitAssignment(input: { userId: number; assignmentId: number; answerText: string }) {
  const db = await getDb();
  if (!db) return { success: true, submissionId: 0 };
  const result = await db.insert(assignmentSubmissions).values(input);
  return { success: true, submissionId: Number(result[0].insertId) };
}

export async function issueCertificate(input: { userId: number; courseId: number }) {
  const db = await getDb();
  if (!db) return { certificateNumber: `VUKA-DEMO-${input.courseId}-${input.userId}`, issued: true };
  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
  const courseRows = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, input.courseId)).limit(1);
  if (!userRows[0] || !courseRows[0]) {
    return { certificateNumber: `VUKA-DEMO-${input.courseId}-${input.userId}`, issued: true };
  }
  const existing = await db.select().from(certificates).where(and(eq(certificates.userId, input.userId), eq(certificates.courseId, input.courseId))).limit(1);
  if (existing[0]) return { certificateNumber: existing[0].certificateNumber, issued: true };
  const certificateNumber = `VUKA-${new Date().getFullYear()}-${String(input.userId).padStart(5, "0")}-${String(input.courseId).padStart(3, "0")}`;
  await db.insert(certificates).values({ userId: input.userId, courseId: input.courseId, certificateNumber });
  return { certificateNumber, issued: true };
}
