import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  assignCourseInstructor,
  createAdminAssignment,
  createAdminLesson,
  createAdminModule,
  createAdminQuestion,
  createAdminQuiz,
  createAdminCategory,
  createAdminCourse,
  createInstructor,
  createPartnershipApplication,
  deleteAdminCategory,
  deleteAdminCourse,
  deleteAdminAssignment,
  deleteAdminLesson,
  deleteAdminModule,
  deleteAdminQuestion,
  deleteAdminQuiz,
  deleteInstructor,
  getCourseLearning,
  getPublishedCourses,
  getStudentDashboard,
  getInstructorPerformance,
  issueCertificate,
  listAdminCategories,
  listAdminCourses,
  listAdminInstructors,
  listAdminAssignments,
  listAdminLessons,
  listAdminModules,
  listAdminQuizzes,
  setLessonProgress,
  setVideoProgress,
  submitAssignment,
  submitQuiz,
  updateAdminCategory,
  updateAdminCourse,
  updateAdminAssignment,
  updateAdminLesson,
  updateAdminModule,
  updateAdminQuestion,
  updateAdminQuiz,
  updateInstructor,
} from "./db";

const demoCourses = [
  { id: 1, title: "Fundamentos de Gestão de Projetos", slug: "fundamentos-gestao-projetos", description: "Aprenda a planear, executar e entregar projetos com mais clareza, ritmo e impacto.", level: "iniciante", price: "0.00", currency: "MZN", status: "published", coverImage: "linear-gradient(135deg, #102b47 0%, #176d70 100%)", categoryLabel: "Negócios", duration: "6 semanas", lessons: 28, accent: "teal" },
  { id: 2, title: "Excel para Decisões Profissionais", slug: "excel-decisoes-profissionais", description: "Transforme dados do dia a dia em análises úteis para decidir com confiança.", level: "intermedio", price: "1450.00", currency: "MZN", status: "published", coverImage: "linear-gradient(135deg, #f0a24b 0%, #dc654d 100%)", categoryLabel: "Dados & Tecnologia", duration: "4 semanas", lessons: 22, accent: "orange" },
  { id: 3, title: "Comunicação para Lideranças", slug: "comunicacao-para-liderancas", description: "Construa uma comunicação mais estratégica, humana e preparada para crescer.", level: "intermedio", price: "980.00", currency: "MZN", status: "published", coverImage: "linear-gradient(135deg, #674ac2 0%, #2e5eaa 100%)", categoryLabel: "Desenvolvimento", duration: "3 semanas", lessons: 18, accent: "purple" },
];

const requireRoles = (...roles: string[]) => protectedProcedure.use(({ ctx, next }) => {
  if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Não tem permissão para esta área." });
  return next({ ctx });
});
const adminProcedure = requireRoles("admin");
const studentProcedure = requireRoles("estudante", "user", "admin");
const formadorProcedure = requireRoles("formador", "admin");

const courseInput = z.object({
  title: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  description: z.string().min(10),
  categoryId: z.number().int().positive().optional(),
  level: z.enum(["iniciante", "intermedio", "avancado"]),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  status: z.enum(["draft", "published", "archived"]),
  certificateEnabled: z.boolean(),
  requirements: z.string().optional(),
  objectives: z.string().optional(),
});
const moduleInput = z.object({ courseId: z.number().int().positive(), title: z.string().min(2), position: z.number().int().min(0) });
const lessonInput = z.object({ moduleId: z.number().int().positive(), title: z.string().min(2), description: z.string().optional(), type: z.enum(["video", "text", "pdf", "material"]), durationMinutes: z.number().int().positive(), position: z.number().int().min(0), isPublished: z.boolean() });
const quizInput = z.object({ courseId: z.number().int().positive(), moduleId: z.number().int().positive().optional(), title: z.string().min(2), description: z.string().optional(), passingScore: z.number().int().min(0).max(100), attemptsAllowed: z.number().int().positive(), dueAt: z.coerce.date().optional() });
const questionInput = z.object({ quizId: z.number().int().positive(), type: z.enum(["multiple_choice", "true_false", "open"]), question: z.string().min(5), options: z.array(z.string()).optional(), points: z.number().int().positive(), position: z.number().int().min(0) });
const assignmentInput = z.object({ courseId: z.number().int().positive(), moduleId: z.number().int().positive().optional(), title: z.string().min(2), instructions: z.string().min(10), dueAt: z.coerce.date().optional(), maxScore: z.number().int().positive() });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  academy: router({
    courses: publicProcedure.query(async () => {
      try {
        const rows = await getPublishedCourses();
        return rows.length > 0 ? rows : demoCourses;
      } catch (error) {
        console.warn("[Academy] Falling back to demo course catalog:", error);
        return demoCourses;
      }
    }),
    phaseOne: publicProcedure.query(() => ({ status: "foundation-ready", roles: ["admin", "formador", "estudante", "empresa"], capabilities: ["database", "oauth", "role-protection", "portable-migrations", "private-storage-ready"] })),
    access: protectedProcedure.query(({ ctx }) => ({ user: ctx.user, destination: ctx.user.role === "admin" ? "/admin" : ctx.user.role === "formador" ? "/formador" : ctx.user.role === "empresa" ? "/empresa" : "/dashboard" })),
    adminCheck: adminProcedure.query(({ ctx }) => ({ ok: true, message: `Acesso administrativo confirmado para ${ctx.user.name ?? "Administrador"}.` })),
    applyPartnership: publicProcedure.input(z.object({ companyName: z.string().min(2), contactName: z.string().min(2), businessEmail: z.string().email(), phone: z.string().optional(), country: z.string().optional(), city: z.string().optional(), sector: z.string().optional(), employeeCount: z.number().int().positive().optional(), trainingCount: z.number().int().positive().optional(), interests: z.string().optional(), message: z.string().optional() })).mutation(async ({ input }) => {
      const id = await createPartnershipApplication(input);
      return { trackingCode: `VUKA-${String(id).padStart(5, "0")}`, status: "pending" as const };
    }),
    student: router({
      dashboard: studentProcedure.query(({ ctx }) => getStudentDashboard(ctx.user.id)),
      course: studentProcedure.input(z.object({ courseId: z.number().int().positive() })).query(({ ctx, input }) => getCourseLearning(input.courseId, ctx.user.id)),
      markLesson: studentProcedure.input(z.object({ lessonId: z.number().int().positive(), completed: z.boolean() })).mutation(({ ctx, input }) => setLessonProgress({ userId: ctx.user.id, ...input })),
      saveVideoProgress: studentProcedure.input(z.object({ lessonId: z.number().int().positive(), videoPositionSeconds: z.number().int().min(0) })).mutation(({ ctx, input }) => setVideoProgress({ userId: ctx.user.id, ...input })),
      submitQuiz: studentProcedure.input(z.object({ quizId: z.number().int().positive(), answers: z.record(z.string(), z.string()) })).mutation(({ ctx, input }) => submitQuiz({ userId: ctx.user.id, ...input })),
      submitAssignment: studentProcedure.input(z.object({ assignmentId: z.number().int().positive(), answerText: z.string().min(5) })).mutation(({ ctx, input }) => submitAssignment({ userId: ctx.user.id, ...input })),
      issueCertificate: studentProcedure.input(z.object({ courseId: z.number().int().positive() })).mutation(({ ctx, input }) => issueCertificate({ userId: ctx.user.id, ...input })),
    }),
    formador: router({
      performance: formadorProcedure.input(z.object({ fromDate: z.coerce.date().optional(), toDate: z.coerce.date().optional(), courseId: z.number().int().positive().optional(), cohort: z.string().optional(), studentId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getInstructorPerformance(ctx.user.id, input ?? {})),
    }),
    admin: router({
      courses: adminProcedure.query(() => listAdminCourses()),
      createCourse: adminProcedure.input(courseInput).mutation(({ ctx, input }) => createAdminCourse({ ...input, createdBy: ctx.user.id })),
      updateCourse: adminProcedure.input(courseInput.extend({ id: z.number().int().positive() })).mutation(({ input }) => updateAdminCourse(input)),
      deleteCourse: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminCourse(input.id)),
      categories: adminProcedure.query(() => listAdminCategories()),
      createCategory: adminProcedure.input(z.object({ name: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9-]+$/), description: z.string().optional() })).mutation(({ input }) => createAdminCategory(input)),
      updateCategory: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9-]+$/), description: z.string().optional() })).mutation(({ input }) => updateAdminCategory(input)),
      deleteCategory: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminCategory(input.id)),
      instructors: adminProcedure.query(() => listAdminInstructors()),
      createInstructor: adminProcedure.input(z.object({ name: z.string().min(2), email: z.string().email(), openId: z.string().min(3) })).mutation(({ input }) => createInstructor(input)),
      updateInstructor: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2), email: z.string().email(), isActive: z.boolean() })).mutation(({ input }) => updateInstructor(input)),
      deleteInstructor: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteInstructor(input.id)),
      assignInstructor: adminProcedure.input(z.object({ courseId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(({ ctx, input }) => assignCourseInstructor({ ...input, assignedBy: ctx.user.id })),
      modules: adminProcedure.input(z.object({ courseId: z.number().int().positive() })).query(({ input }) => listAdminModules(input.courseId)),
      createModule: adminProcedure.input(moduleInput).mutation(({ input }) => createAdminModule(input)),
      updateModule: adminProcedure.input(moduleInput.omit({ courseId: true }).extend({ id: z.number().int().positive() })).mutation(({ input }) => updateAdminModule(input)),
      deleteModule: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminModule(input.id)),
      lessons: adminProcedure.input(z.object({ moduleId: z.number().int().positive() })).query(({ input }) => listAdminLessons(input.moduleId)),
      createLesson: adminProcedure.input(lessonInput).mutation(({ input }) => createAdminLesson(input)),
      updateLesson: adminProcedure.input(lessonInput.omit({ moduleId: true }).extend({ id: z.number().int().positive() })).mutation(({ input }) => updateAdminLesson(input)),
      deleteLesson: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminLesson(input.id)),
      quizzes: adminProcedure.input(z.object({ courseId: z.number().int().positive() })).query(({ input }) => listAdminQuizzes(input.courseId)),
      createQuiz: adminProcedure.input(quizInput).mutation(({ input }) => createAdminQuiz(input)),
      updateQuiz: adminProcedure.input(quizInput.omit({ courseId: true, moduleId: true }).extend({ id: z.number().int().positive(), dueAt: z.coerce.date().nullable().optional() })).mutation(({ input }) => updateAdminQuiz(input)),
      deleteQuiz: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminQuiz(input.id)),
      createQuestion: adminProcedure.input(questionInput).mutation(({ input }) => createAdminQuestion(input)),
      updateQuestion: adminProcedure.input(questionInput.omit({ quizId: true }).extend({ id: z.number().int().positive() })).mutation(({ input }) => updateAdminQuestion(input)),
      deleteQuestion: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminQuestion(input.id)),
      assignments: adminProcedure.input(z.object({ courseId: z.number().int().positive() })).query(({ input }) => listAdminAssignments(input.courseId)),
      createAssignment: adminProcedure.input(assignmentInput).mutation(({ input }) => createAdminAssignment(input)),
      updateAssignment: adminProcedure.input(assignmentInput.omit({ courseId: true, moduleId: true }).extend({ id: z.number().int().positive(), dueAt: z.coerce.date().nullable().optional() })).mutation(({ input }) => updateAdminAssignment(input)),
      deleteAssignment: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAdminAssignment(input.id)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
