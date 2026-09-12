import type { Express, Request, Response } from "express";
import express from "express";
import { sdk } from "./sdk";
import { storagePut } from "../storage";
import { createLessonMaterial, getLessonForUpload } from "../db";

const allowedTypes = new Set(["video/mp4", "video/webm", "application/pdf", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
const maxSize = 250 * 1024 * 1024;

export function registerUploadRoutes(app: Express) {
  app.post("/api/lesson-materials/upload", express.raw({ type: () => true, limit: "250mb" }), async (req: Request, res: Response) => {
    try {
      let user = null;
      try { user = await sdk.authenticateRequest(req as any); } catch { user = null; }
      if (!user || !["admin", "formador"].includes(user.role)) return res.status(403).json({ message: "Apenas administradores e formadores podem carregar materiais." });
      const lessonId = Number(req.header("x-lesson-id"));
      const filename = req.header("x-file-name") || "material";
      const mimeType = req.header("content-type") || "application/octet-stream";
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
      if (!Number.isInteger(lessonId) || lessonId <= 0) return res.status(400).json({ message: "lessonId inválido." });
      if (!body.length || body.length > maxSize) return res.status(400).json({ message: "O ficheiro deve ter entre 1 byte e 250 MB." });
      if (!allowedTypes.has(mimeType) && !mimeType.startsWith("text/")) return res.status(415).json({ message: "Tipo de ficheiro não suportado." });
      const lesson = await getLessonForUpload(lessonId);
      if (!lesson) return res.status(404).json({ message: "Aula não encontrada." });
      if (user.role === "formador" && lesson.instructorIds.length > 0 && !lesson.instructorIds.includes(user.id)) return res.status(403).json({ message: "Não pode editar esta aula." });
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
      const uploaded = await storagePut(`academy/lessons/${lessonId}/${Date.now()}-${safeName}`, body, mimeType);
      const materialId = await createLessonMaterial({ lessonId, name: filename, fileKey: uploaded.key, fileUrl: uploaded.url, mimeType, isPrivate: true });
      return res.json({ id: materialId, ...uploaded, name: filename, mimeType });
    } catch (error) {
      console.error("[Upload] lesson material failed", error);
      return res.status(500).json({ message: "Não foi possível carregar o material." });
    }
  });
}
