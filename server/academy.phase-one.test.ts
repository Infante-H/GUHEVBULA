import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "admin" | "formador" | "estudante" | "empresa" | "user";

function contextFor(role: Role): TrpcContext {
  return {
    user: {
      id: 10,
      openId: `phase-one-${role}`,
      email: `${role}@vuka.test`,
      name: `Demo ${role}`,
      loginMethod: "test",
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("academy.phaseOne", () => {
  it("exposes the four platform roles and foundation capabilities", async () => {
    const result = await appRouter.createCaller(contextFor("user")).academy.phaseOne();
    expect(result.status).toBe("foundation-ready");
    expect(result.roles).toEqual(["admin", "formador", "estudante", "empresa"]);
    expect(result.capabilities).toContain("role-protection");
  });

  it("returns demo course contracts when the catalog has no published rows", async () => {
    const result = await appRouter.createCaller(contextFor("user")).academy.courses();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toMatchObject({ status: "published" });
  });
});

describe("academy.adminCheck", () => {
  it("allows administrators", async () => {
    const result = await appRouter.createCaller(contextFor("admin")).academy.adminCheck();
    expect(result.ok).toBe(true);
  });

  it("rejects non-admin roles on the backend", async () => {
    await expect(appRouter.createCaller(contextFor("formador")).academy.adminCheck()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});


describe("academy.student", () => {
  it("returns a course learning structure with modules and assessments", async () => {
    const result = await appRouter.createCaller(contextFor("estudante")).academy.student.course({ courseId: 1 });
    expect(result.course.title).toContain("Gestão de Projetos");
    expect(result.modules.length).toBeGreaterThan(0);
    expect(result.quiz?.questions.length).toBeGreaterThan(0);
    expect(result.assignment?.title).toContain("Mapa");
  });

  it("supports lesson completion and demo certificate issuance", async () => {
    const caller = appRouter.createCaller(contextFor("estudante"));
    await expect(caller.academy.student.markLesson({ lessonId: 101, completed: true })).resolves.toMatchObject({ success: true, completed: true });
    await expect(caller.academy.student.issueCertificate({ courseId: 1 })).resolves.toMatchObject({ issued: true });
  });
});


describe("academy.admin CRUD guards", () => {
  it("rejects course management for non-admin roles", async () => {
    await expect(appRouter.createCaller(contextFor("formador")).academy.admin.createCourse({
      title: "Curso de teste",
      slug: "curso-de-teste",
      description: "Descrição suficientemente longa para passar a validação.",
      level: "iniciante",
      price: "0.00",
      status: "draft",
      certificateEnabled: true,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates slugs before attempting course persistence", async () => {
    await expect(appRouter.createCaller(contextFor("admin")).academy.admin.createCourse({
      title: "Curso de teste",
      slug: "Slug inválido",
      description: "Descrição suficientemente longa para passar a validação.",
      level: "iniciante",
      price: "0.00",
      status: "draft",
      certificateEnabled: true,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});


describe("academy.curriculum and academy.formador", () => {
  it("keeps curriculum CRUD restricted to administrators", async () => {
    await expect(appRouter.createCaller(contextFor("formador")).academy.admin.modules({ courseId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(contextFor("estudante")).academy.admin.createLesson({ moduleId: 1, title: "Aula", type: "text", durationMinutes: 10, position: 1, isPublished: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a stable performance report contract for formadores", async () => {
    const result = await appRouter.createCaller(contextFor("formador")).academy.formador.performance();
    expect(result).toHaveProperty("courses");
    expect(result.totals).toMatchObject({ students: expect.any(Number), averageProgress: expect.any(Number), pendingAssignments: expect.any(Number) });
  });
});


describe("academy.reports and assessment editing", () => {
  it("accepts formador report filters and returns filter options", async () => {
    const result = await appRouter.createCaller(contextFor("formador")).academy.formador.performance({ cohort: "Geral" });
    expect(result).toHaveProperty("filterOptions");
    expect(result.filterOptions).toHaveProperty("students");
  });

  it("keeps question and assignment editing restricted to administrators", async () => {
    const caller = appRouter.createCaller(contextFor("formador"));
    await expect(caller.academy.admin.updateQuestion({ id: 1, type: "open", question: "Pergunta atualizada", points: 1, position: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.academy.admin.updateAssignment({ id: 1, title: "Trabalho atualizado", instructions: "Instruções suficientemente longas.", maxScore: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});


describe("academy.video and quiz editing", () => {
  it("persists video progress through the student procedure contract", async () => {
    const result = await appRouter.createCaller(contextFor("estudante")).academy.student.saveVideoProgress({ lessonId: 101, videoPositionSeconds: 42 });
    expect(result).toMatchObject({ success: true, videoPositionSeconds: 42 });
  });

  it("keeps complete quiz editing restricted to administrators", async () => {
    await expect(appRouter.createCaller(contextFor("formador")).academy.admin.updateQuiz({ id: 1, title: "Quiz atualizado", description: "Descrição", passingScore: 80, attemptsAllowed: 2, dueAt: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});


describe("academy.business isolation and administration", () => {
  it("rejects non-company users from company dashboard procedures", async () => {
    await expect(appRouter.createCaller(contextFor("estudante")).academy.company.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(contextFor("formador")).academy.company.members()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects company users from global admin company management", async () => {
    await expect(appRouter.createCaller(contextFor("empresa")).academy.admin.companies()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(contextFor("empresa")).academy.admin.users({ role: "all" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows administrators to query company and application contracts", async () => {
    await expect(appRouter.createCaller(contextFor("admin")).academy.admin.companies()).resolves.toBeDefined();
    await expect(appRouter.createCaller(contextFor("admin")).academy.admin.applications({ status: "pending" })).resolves.toBeDefined();
  });

  it("keeps company course assignment input constrained to positive identifiers", async () => {
    await expect(appRouter.createCaller(contextFor("empresa")).academy.company.assignCourse({ courseId: 0, userId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("protects notification reads by authenticated user context", async () => {
    await expect(appRouter.createCaller(contextFor("estudante")).academy.notifications.list()).resolves.toBeDefined();
    await expect(appRouter.createCaller(contextFor("user")).academy.notifications.markRead({ id: 1 })).resolves.toBeDefined();
  });

  it("exposes real admin overview metrics without fictitious dashboard values", async () => {
    const result = await appRouter.createCaller(contextFor("admin")).academy.admin.overview();
    expect(result).toMatchObject({ students: expect.any(Number), formadores: expect.any(Number), companies: expect.any(Number), publishedCourses: expect.any(Number), pendingApplications: expect.any(Number) });
  });
});
