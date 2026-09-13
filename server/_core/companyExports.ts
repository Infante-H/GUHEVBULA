import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getCompanyPerformance } from "../companyDb";

function pdfFor(report: any) {
  const lines = ["VUKA ACADEMY - RELATORIO EMPRESARIAL", "", `Atribuicoes: ${report.totals.assignments} | Concluidos: ${report.totals.completed} | Progresso medio: ${report.totals.averageProgress}%`, "", "COLABORADOR | CURSO | ESTADO | PROGRESSO | NOTA"];
  for (const row of report.rows) lines.push(`${row.person?.name ?? row.person?.email ?? "-"} | ${row.course?.title ?? "-"} | ${row.status} | ${row.progress}% | ${row.score}%`);
  const esc = (value: string) => value.replace(/[\\()]/g, "\\$&").slice(0, 110);
  const commands = ["BT", "/F1 12 Tf", "40 790 Td"];
  lines.forEach((line, index) => { commands.push(`(${esc(line)}) Tj`); if (index < lines.length - 1) commands.push("0 -18 Td"); });
  commands.push("ET");
  const content = commands.join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, "latin1"); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1");
  const entries = offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n");
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n" + entries + "\ntrailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return Buffer.from(pdf, "latin1");
}

export function registerCompanyExportRoutes(app: Express) {
  app.get("/api/reports/company.pdf", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req as any);
      if (!user || user.role !== "empresa") return res.status(403).json({ message: "Apenas contas empresariais podem exportar este relatório." });
      const report = await getCompanyPerformance(user.id, { courseId: req.query.courseId ? Number(req.query.courseId) : undefined, memberId: req.query.memberId ? Number(req.query.memberId) : undefined, status: typeof req.query.status === "string" ? req.query.status : undefined });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=relatorio-empresa.pdf");
      return res.send(pdfFor(report));
    } catch (error) {
      console.error("[CompanyReports] export failed", error);
      return res.status(500).json({ message: "Não foi possível exportar o relatório empresarial." });
    }
  });
}
