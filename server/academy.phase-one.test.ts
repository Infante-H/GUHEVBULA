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
