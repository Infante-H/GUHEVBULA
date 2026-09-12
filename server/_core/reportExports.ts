import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getInstructorPerformance } from "../db";

function parseFilters(req: Request) {
  const query = req.query;
  return {
    fromDate: typeof query.fromDate === "string" && query.fromDate ? new Date(`${query.fromDate}T00:00:00`) : undefined,
    toDate: typeof query.toDate === "string" && query.toDate ? new Date(`${query.toDate}T23:59:59`) : undefined,
    courseId: typeof query.courseId === "string" && query.courseId ? Number(query.courseId) : undefined,
    cohort: typeof query.cohort === "string" && query.cohort ? query.cohort : undefined,
    studentId: typeof query.studentId === "string" && query.studentId ? Number(query.studentId) : undefined,
  };
}

function clean(value: unknown) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function csvEscape(value: unknown) { const text = clean(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function buildCsv(report: any) {
  const lines = ["Curso,Alunos,Progresso medio (%),Conclusao (%),Quiz medio (%),Trabalhos pendentes"];
  for (const row of report.courses) lines.push([row.title, row.students, row.averageProgress, row.completionRate, row.averageQuizScore, row.pendingAssignments].map(csvEscape).join(","));
  lines.push("");
  lines.push(["Totais", report.totals.students, report.totals.averageProgress, report.totals.completionRate, report.totals.averageQuizScore, report.totals.pendingAssignments].map(csvEscape).join(","));
  return `\uFEFF${lines.join("\n")}`;
}

function buildPdf(report: any) {
  const lines = ["VUKA ACADEMY - RELATORIO DE DESEMPENHO", "", `Alunos: ${report.totals.students} | Progresso medio: ${report.totals.averageProgress}% | Conclusao: ${report.totals.completionRate}%`, `Quiz medio: ${report.totals.averageQuizScore}% | Trabalhos pendentes: ${report.totals.pendingAssignments}`, "", "CURSO | ALUNOS | PROGRESSO | CONCLUSAO | QUIZ | PENDENTES"];
  for (const row of report.courses) lines.push(`${clean(row.title)} | ${row.students} | ${row.averageProgress}% | ${row.completionRate}% | ${row.averageQuizScore}% | ${row.pendingAssignments}`);
  const commands = ["BT", "/F1 14 Tf", "50 770 Td", ...lines.flatMap((line, index) => [`(${clean(line).replace(/[\\()]/g, "\\$&")}) Tj`, index < lines.length - 1 ? "0 -19 Td" : "ET"]), ""].join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(commands, "latin1")} >>\nstream\n${commands}endstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, "latin1"); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1"); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export function registerReportExportRoutes(app: Express) {
  app.get(/^\/api\/reports\/performance\.(csv|pdf)$/, async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req as any);
      if (!user || !["formador", "admin"].includes(user.role)) return res.status(403).json({ message: "Apenas formadores e administradores podem exportar relatórios." });
      const report = await getInstructorPerformance(user.id, parseFilters(req));
      if (req.path.endsWith(".csv")) { res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=relatorio-vuka.csv"); return res.send(buildCsv(report)); }
      res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", "attachment; filename=relatorio-vuka.pdf"); return res.send(buildPdf(report));
    } catch (error) { console.error("[Reports] export failed", error); return res.status(500).json({ message: "Não foi possível exportar o relatório." }); }
  });
}
