import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createPartnershipApplication, getPublishedCourses } from "./db";

const demoCourses = [
  {
    id: 1,
    title: "Fundamentos de Gestão de Projetos",
    slug: "fundamentos-gestao-projetos",
    description: "Aprenda a planear, executar e entregar projetos com mais clareza, ritmo e impacto.",
    level: "iniciante",
    price: "0.00",
    currency: "MZN",
    status: "published",
    coverImage: "linear-gradient(135deg, #102b47 0%, #176d70 100%)",
    categoryLabel: "Negócios",
    duration: "6 semanas",
    lessons: 28,
    accent: "teal",
  },
  {
    id: 2,
    title: "Excel para Decisões Profissionais",
    slug: "excel-decisoes-profissionais",
    description: "Transforme dados do dia a dia em análises úteis para decidir com confiança.",
    level: "intermedio",
    price: "1450.00",
    currency: "MZN",
    status: "published",
    coverImage: "linear-gradient(135deg, #f0a24b 0%, #dc654d 100%)",
    categoryLabel: "Dados & Tecnologia",
    duration: "4 semanas",
    lessons: 22,
    accent: "orange",
  },
  {
    id: 3,
    title: "Comunicação para Lideranças",
    slug: "comunicacao-para-liderancas",
    description: "Construa uma comunicação mais estratégica, humana e preparada para crescer.",
    level: "intermedio",
    price: "980.00",
    currency: "MZN",
    status: "published",
    coverImage: "linear-gradient(135deg, #674ac2 0%, #2e5eaa 100%)",
    categoryLabel: "Desenvolvimento",
    duration: "3 semanas",
    lessons: 18,
    accent: "purple",
  },
];

const requireRoles = (...roles: string[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Não tem permissão para esta área." });
    }
    return next({ ctx });
  });

const adminProcedure = requireRoles("admin");

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
    phaseOne: publicProcedure.query(() => ({
      status: "foundation-ready",
      roles: ["admin", "formador", "estudante", "empresa"],
      capabilities: ["database", "oauth", "role-protection", "portable-migrations", "private-storage-ready"],
    })),
    access: protectedProcedure.query(({ ctx }) => ({
      user: ctx.user,
      destination: ctx.user.role === "admin" ? "/admin" : ctx.user.role === "formador" ? "/formador" : ctx.user.role === "empresa" ? "/empresa" : "/dashboard",
    })),
    adminCheck: adminProcedure.query(({ ctx }) => ({
      ok: true,
      message: `Acesso administrativo confirmado para ${ctx.user.name ?? "Administrador"}.`,
    })),
    applyPartnership: publicProcedure
      .input(
        z.object({
          companyName: z.string().min(2),
          contactName: z.string().min(2),
          businessEmail: z.string().email(),
          phone: z.string().optional(),
          country: z.string().optional(),
          city: z.string().optional(),
          sector: z.string().optional(),
          employeeCount: z.number().int().positive().optional(),
          trainingCount: z.number().int().positive().optional(),
          interests: z.string().optional(),
          message: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createPartnershipApplication(input);
        return { trackingCode: `VUKA-${String(id).padStart(5, "0")}`, status: "pending" as const };
      }),
  }),
});

export type AppRouter = typeof appRouter;
