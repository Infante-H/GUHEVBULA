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
  lessonMaterials,
  modules,
  profiles,
  quizAttempts,
  quizQuestions,
  quizzes,
  studentProgress,
  users,
  companyPartnershipApplications,
  companies,
  companyUsers,
  companyCourseAssignments,
  notifications,
  auditLogs,
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
  const materialRows = lessonRows.length ? await db.select().from(lessonMaterials).where(inArray(lessonMaterials.lessonId, lessonRows.map(item => item.id))) : [];
  const progressRows = await db.select().from(studentProgress).where(and(eq(studentProgress.userId, userId), lessonRows.length ? inArray(studentProgress.lessonId, lessonRows.map(item => item.id)) : sql`1 = 0`));
  const completed = new Set(progressRows.filter(item => item.isCompleted).map(item => item.lessonId));
  const total = lessonRows.length;
  const done = completed.size;
  const quizRows = await db.select().from(quizzes).where(eq(quizzes.courseId, courseId)).limit(1);
  const quiz = quizRows[0] ? { ...quizRows[0], questions: await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizRows[0].id)).orderBy(quizQuestions.position) } : null;
  const assignmentRows = await db.select().from(assignments).where(eq(assignments.courseId, courseId)).limit(1);
  return { course: { ...courseRows[0], lessonsTotal: total, completedLessons: done, progress: total ? Math.round((done / total) * 100) : 0 }, modules: moduleRows.map(module => ({ ...module, lessons: lessonRows.filter(lesson => lesson.moduleId === module.id).map(lesson => ({ ...lesson, completed: completed.has(lesson.id), videoPositionSeconds: progressRows.find(progress => progress.lessonId === lesson.id)?.videoPositionSeconds ?? 0, materials: materialRows.filter(material => material.lessonId === lesson.id) })) })), quiz, assignment: assignmentRows[0] ?? null };
}

export async function setLessonProgress(input: { userId: number; lessonId: number; completed: boolean }) {
  const db = await getDb();
  if (!db) return { success: true, completed: input.completed };
  await db.insert(studentProgress).values({ userId: input.userId, lessonId: input.lessonId, isCompleted: input.completed, completedAt: input.completed ? new Date() : null }).onDuplicateKeyUpdate({ set: { isCompleted: input.completed, completedAt: input.completed ? new Date() : null } });
  return { success: true, completed: input.completed };
}

export async function setVideoProgress(input: { userId: number; lessonId: number; videoPositionSeconds: number }) {
  const db = await getDb();
  if (!db) return { success: true, videoPositionSeconds: input.videoPositionSeconds };
  await db.insert(studentProgress).values({ userId: input.userId, lessonId: input.lessonId, videoPositionSeconds: input.videoPositionSeconds }).onDuplicateKeyUpdate({ set: { videoPositionSeconds: input.videoPositionSeconds } });
  return { success: true, videoPositionSeconds: input.videoPositionSeconds };
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


export async function listAdminModules(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(modules.position);
}

export async function createAdminModule(input: { courseId: number; title: string; position: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(modules).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminModule(input: { id: number; title: string; position: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(modules).set({ title: input.title, position: input.position }).where(eq(modules.id, input.id));
  return { success: true };
}

export async function deleteAdminModule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(modules).where(eq(modules.id, id));
  return { success: true };
}

export async function listAdminLessons(moduleId: number) {
  const db = await getDb();
  if (!db) return [];
  const lessonRows = await db.select().from(lessons).where(eq(lessons.moduleId, moduleId)).orderBy(lessons.position);
  const lessonIds = lessonRows.map(row => row.id);
  const materialRows = lessonIds.length ? await db.select().from(lessonMaterials).where(inArray(lessonMaterials.lessonId, lessonIds)) : [];
  return lessonRows.map(row => ({ ...row, materials: materialRows.filter(material => material.lessonId === row.id) }));
}

export async function createAdminLesson(input: { moduleId: number; title: string; description?: string; type: "video" | "text" | "pdf" | "material"; durationMinutes: number; position: number; isPublished: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(lessons).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminLesson(input: { id: number; title: string; description?: string; type: "video" | "text" | "pdf" | "material"; durationMinutes: number; position: number; isPublished: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(lessons).set(input).where(eq(lessons.id, input.id));
  return { success: true };
}

export async function deleteAdminLesson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(lessons).where(eq(lessons.id, id));
  return { success: true };
}

export async function listAdminQuizzes(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(quizzes).where(eq(quizzes.courseId, courseId));
  const ids = rows.map(row => row.id);
  const questions = ids.length ? await db.select().from(quizQuestions).where(inArray(quizQuestions.quizId, ids)).orderBy(quizQuestions.position) : [];
  return rows.map(row => ({ ...row, questions: questions.filter(question => question.quizId === row.id) }));
}

export async function createAdminQuiz(input: { courseId: number; moduleId?: number; title: string; description?: string; passingScore: number; attemptsAllowed: number; dueAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(quizzes).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminQuiz(input: { id: number; title: string; description?: string; passingScore: number; attemptsAllowed: number; dueAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(quizzes).set(input).where(eq(quizzes.id, input.id));
  return { success: true };
}

export async function deleteAdminQuiz(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(quizzes).where(eq(quizzes.id, id));
  return { success: true };
}

export async function createAdminQuestion(input: { quizId: number; type: "multiple_choice" | "true_false" | "open"; question: string; options?: unknown; points: number; position: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(quizQuestions).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminQuestion(input: { id: number; type: "multiple_choice" | "true_false" | "open"; question: string; options?: unknown; points: number; position: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(quizQuestions).set(input).where(eq(quizQuestions.id, input.id));
  return { success: true };
}

export async function deleteAdminQuestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
  return { success: true };
}

export async function listAdminAssignments(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assignments).where(eq(assignments.courseId, courseId));
}

export async function createAdminAssignment(input: { courseId: number; moduleId?: number; title: string; instructions: string; dueAt?: Date; maxScore: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(assignments).values(input);
  return Number(result[0].insertId);
}

export async function updateAdminAssignment(input: { id: number; title: string; instructions: string; dueAt?: Date | null; maxScore: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(assignments).set(input).where(eq(assignments.id, input.id));
  return { success: true };
}

export async function deleteAdminAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(assignments).where(eq(assignments.id, id));
  return { success: true };
}

export async function createLessonMaterial(input: { lessonId: number; name: string; fileKey: string; fileUrl: string; mimeType: string; isPrivate: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(lessonMaterials).values(input);
  return Number(result[0].insertId);
}

export async function getLessonForUpload(lessonId: number) {
  const db = await getDb();
  if (!db) return { id: lessonId, instructorIds: [] as number[] };
  const row = await db.select({ id: lessons.id, courseId: modules.courseId }).from(lessons).innerJoin(modules, eq(lessons.moduleId, modules.id)).where(eq(lessons.id, lessonId)).limit(1);
  if (!row[0]) return null;
  const assignmentsRows = await db.select({ userId: courseInstructors.userId }).from(courseInstructors).where(eq(courseInstructors.courseId, row[0].courseId));
  return { id: row[0].id, instructorIds: assignmentsRows.map(item => item.userId) };
}

export async function getInstructorPerformance(userId: number, filters: { fromDate?: Date; toDate?: Date; courseId?: number; cohort?: string; studentId?: number } = {}) {
  const db = await getDb();
  if (!db) return { courses: [{ courseId: 1, title: fallbackLearning.course.title, students: 18, averageProgress: 62, completionRate: 34, averageQuizScore: 78, pendingAssignments: 4 }], totals: { students: 18, averageProgress: 62, completionRate: 34, averageQuizScore: 78, pendingAssignments: 4 }, filterOptions: { cohorts: ["Geral"], students: [{ id: 10, name: "Aluno demo", email: "aluno@vuka.test" }] } };
  const assigned = await db.select({ courseId: courseInstructors.courseId, title: courses.title }).from(courseInstructors).innerJoin(courses, eq(courseInstructors.courseId, courses.id)).where(eq(courseInstructors.userId, userId));
  const courseIds = assigned.map(row => row.courseId).filter(id => !filters.courseId || id === filters.courseId);
  if (!courseIds.length) return { courses: [], totals: { students: 0, averageProgress: 0, completionRate: 0, averageQuizScore: 0, pendingAssignments: 0 }, filterOptions: { cohorts: [], students: [] } };
  const enrollmentRows = await db.select().from(enrollments).where(inArray(enrollments.courseId, courseIds));
  const filteredEnrollments = enrollmentRows.filter(row => (!filters.cohort || row.cohort === filters.cohort) && (!filters.studentId || row.userId === filters.studentId) && (!filters.fromDate || new Date(row.enrolledAt).getTime() >= filters.fromDate.getTime()) && (!filters.toDate || new Date(row.enrolledAt).getTime() <= filters.toDate.getTime()));
  const allStudentIds = Array.from(new Set(enrollmentRows.map(row => row.userId)));
  const studentRows = allStudentIds.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, allStudentIds)) : [];
  const moduleRows = await db.select({ id: modules.id, courseId: modules.courseId }).from(modules).where(inArray(modules.courseId, courseIds));
  const lessonRows = moduleRows.length ? await db.select({ id: lessons.id, moduleId: lessons.moduleId }).from(lessons).where(inArray(lessons.moduleId, moduleRows.map(row => row.id))) : [];
  const progressRows = enrollmentRows.length && lessonRows.length ? await db.select().from(studentProgress).where(inArray(studentProgress.userId, enrollmentRows.map(row => row.userId))) : [];
  const quizRows = await db.select({ courseId: quizzes.courseId, id: quizAttempts.id, userId: quizAttempts.userId, score: quizAttempts.score }).from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id)).where(inArray(quizzes.courseId, courseIds));
  const assignmentRows = await db.select({ courseId: assignments.courseId, id: assignmentSubmissions.id, graded: grades.id }).from(assignments).leftJoin(assignmentSubmissions, eq(assignmentSubmissions.assignmentId, assignments.id)).leftJoin(grades, eq(grades.submissionId, assignmentSubmissions.id)).where(inArray(assignments.courseId, courseIds));
  const reports = assigned.filter(course => courseIds.includes(course.courseId)).map(course => { const students = filteredEnrollments.filter(row => row.courseId === course.courseId); const lessonsForCourse = lessonRows.filter(lesson => moduleRows.find(module => module.id === lesson.moduleId)?.courseId === course.courseId); const progressValues = students.map(student => { const completed = progressRows.filter(item => item.userId === student.userId && item.isCompleted && lessonsForCourse.some(lesson => lesson.id === item.lessonId)).length; return lessonsForCourse.length ? (completed / lessonsForCourse.length) * 100 : 0; }); const quizzes = quizRows.filter(row => row.courseId === course.courseId && (!filters.studentId || row.userId === filters.studentId)).map(row => Number(row.score ?? 0)); const pending = assignmentRows.filter(row => row.courseId === course.courseId && row.id && !row.graded).length; return { courseId: course.courseId, title: course.title, students: students.length, averageProgress: progressValues.length ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length) : 0, completionRate: students.length ? Math.round((students.filter(student => student.status === "completed").length / students.length) * 100) : 0, averageQuizScore: quizzes.length ? Math.round(quizzes.reduce((a, b) => a + b, 0) / quizzes.length) : 0, pendingAssignments: pending }; });
  const totals = { students: reports.reduce((sum, row) => sum + row.students, 0), averageProgress: reports.length ? Math.round(reports.reduce((sum, row) => sum + row.averageProgress, 0) / reports.length) : 0, completionRate: reports.length ? Math.round(reports.reduce((sum, row) => sum + row.completionRate, 0) / reports.length) : 0, averageQuizScore: reports.length ? Math.round(reports.reduce((sum, row) => sum + row.averageQuizScore, 0) / reports.length) : 0, pendingAssignments: reports.reduce((sum, row) => sum + row.pendingAssignments, 0) };
  return { courses: reports, totals, filterOptions: { cohorts: Array.from(new Set(enrollmentRows.map(row => row.cohort))), students: studentRows } };
}
