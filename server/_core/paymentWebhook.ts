import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { confirmPayment } from "../paymentDb";
import { ENV } from "./env";

function validSignature(payload: string, signature: string | undefined) {
  if (!ENV.paymentWebhookSecret || !signature) return false;
  const expected = crypto.createHmac("sha256", ENV.paymentWebhookSecret).update(payload).digest("hex");
  const actual = signature.replace(/^sha256=/, "");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function registerPaymentWebhookRoute(app: Express) {
  app.post("/api/payments/webhook/:provider", async (req: Request, res: Response) => {
    const payload = JSON.stringify(req.body ?? {});
    if (!validSignature(payload, req.header("x-payment-signature"))) return res.status(401).json({ message: "Assinatura de webhook inválida." });
    const body = req.body as { paymentId?: number; status?: "paid" | "failed" | "cancelled" | "refunded"; transactionId?: string };
    if (!body.paymentId || !body.status) return res.status(400).json({ message: "paymentId e status são obrigatórios." });
    try {
      const result = await confirmPayment({ paymentId: Number(body.paymentId), status: body.status, transactionId: body.transactionId, provider: req.params.provider });
      return res.json(result);
    } catch (error) {
      console.error("[PaymentWebhook] confirmation failed", error);
      return res.status(422).json({ message: error instanceof Error ? error.message : "Pagamento inválido." });
    }
  });
}
