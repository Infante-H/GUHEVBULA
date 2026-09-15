import { describe, expect, it } from "vitest";
import { buildTransactionalEmail, sendTransactionalEmail } from "./email";

describe("transactional email", () => {
  it("builds the supported notification templates", () => {
    const email = buildTransactionalEmail({ to: "student@example.com", type: "payment_confirmed", body: "O pagamento foi confirmado." });
    expect(email.subject).toBe("Pagamento confirmado");
    expect(email.text).toContain("O pagamento foi confirmado.");
    expect(email.html).toContain("Pagamento confirmado");
  });

  it("fails safely when the provider is not configured", async () => {
    const result = await sendTransactionalEmail({ to: "student@example.com", type: "account_created", subject: "Conta", text: "Bem-vindo" });
    expect(result).toMatchObject({ sent: false, skipped: true });
  });
});
