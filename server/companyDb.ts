import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { auditLogs, certificates, companyCourseAssignments, companyPartnershipApplications, companyUsers, companies, courses, enrollments, notificationPreferences, notifications, studentProgress, users } from "../drizzle/schema";
import { sendNotificationEmail, type TransactionalEmailType } from "./email";

export async function writeAudit(input: { userId?: number; action: string; resource: string; resourceId?: number; result?: string }) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.insert(auditLogs).values({ userId: input.userId, action: input.action, resource: input.resource, resourceId: input.resourceId, result: input.result ?? "success" });
  return { success: true };
}

export async function createNotification(input: { userId: number; type: string; title: string; body?: string }) {
  const db = await getDb();
  if (!db) return { success: true };
  const result = await db.insert(notifications).values(input);
  const recipient = await db.select({ email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
  const preferences = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, input.userId)).limit(1);
  const preference = preferences[0];
  const category = input.type.includes("payment") ? "paymentUpdates" : input.type.includes("company") || input.type.includes("invitation") ? "companyUpdates" : input.type.includes("assignment") || input.type.includes("grade") || input.type.includes("quiz") ? "assessmentUpdates" : input.type.includes("course") || input.type.includes("enrollment") || input.type.includes("certificate") ? "courseUpdates" : "securityUpdates";
  if (recipient[0]?.email && (preference?.emailEnabled ?? true) && (preference?.[category] ?? true)) {
    await sendNotificationEmail({ to: recipient[0].email, type: input.type as TransactionalEmailType, subject: input.title, body: input.body ?? input.title });
  }
  return { success: true, id: Number(result[0].insertId) };
}

export async function getCompanyMembership(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ company: companies, membership: companyUsers }).from(companyUsers).innerJoin(companies, eq(companies.id, companyUsers.companyId)).where(eq(companyUsers.userId, userId)).limit(1);
  return rows[0];
}

export async function listAdminCompanies() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));
  const ownerIds = rows.map(row => row.ownerUserId).filter((id): id is number => Boolean(id));
  const owners = ownerIds.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ownerIds)) : [];
  const memberships = rows.length ? await db.select().from(companyUsers).where(inArray(companyUsers.companyId, rows.map(row => row.id))) : [];
  const assignments = rows.length ? await db.select().from(companyCourseAssignments).where(inArray(companyCourseAssignments.companyId, rows.map(row => row.id))) : [];
  return rows.map(company => ({ ...company, owner: owners.find(owner => owner.id === company.ownerUserId) ?? null, collaborators: memberships.filter(item => item.companyId === company.id).length, assignedCourses: new Set(assignments.filter(item => item.companyId === company.id).map(item => item.courseId)).size }));
}

export async function listPartnershipApplications(filters: { status?: string; country?: string; sector?: string; company?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(companyPartnershipApplications).orderBy(desc(companyPartnershipApplications.createdAt));
  return rows.filter(row => (!filters.status || row.status === filters.status) && (!filters.country || row.country === filters.country) && (!filters.sector || row.sector === filters.sector) && (!filters.company || row.companyName.toLowerCase().includes(filters.company.toLowerCase())));
}

export async function reviewPartnershipApplication(input: { id: number; status: "under_review" | "approved" | "rejected"; reviewerId: number }) {
  const db = await getDb();
  if (!db) return { success: true, companyId: 0 };
  const rows = await db.select().from(companyPartnershipApplications).where(eq(companyPartnershipApplications.id, input.id)).limit(1);
  const application = rows[0];
  if (!application) throw new Error("Candidatura não encontrada");
  await db.update(companyPartnershipApplications).set({ status: input.status, reviewedBy: input.reviewerId, approvedAt: input.status === "approved" ? new Date() : null }).where(eq(companyPartnershipApplications.id, input.id));
  if (input.status !== "approved") { await writeAudit({ userId: input.reviewerId, action: `company_application_${input.status}`, resource: "company_partnership_application", resourceId: input.id }); return { success: true, companyId: 0 }; }
  const existingUser = await db.select().from(users).where(eq(users.email, application.businessEmail)).limit(1);
  let ownerId = existingUser[0]?.id;
  if (existingUser[0]) await db.update(users).set({ role: "empresa", isActive: true, name: application.contactName }).where(eq(users.id, existingUser[0].id));
  const companyResult = await db.insert(companies).values({ ownerUserId: ownerId, name: application.companyName, contactName: application.contactName, contactEmail: application.businessEmail, phone: application.phone, country: application.country, city: application.city, sector: application.sector, employeeCount: application.employeeCount ?? 0, status: "approved", approvedAt: new Date() });
  const companyId = Number(companyResult[0].insertId);
  if (ownerId) await db.insert(companyUsers).values({ companyId, userId: ownerId, role: "owner" });
  if (ownerId) await createNotification({ userId: ownerId, type: "company_application_approved", title: "Candidatura empresarial aprovada", body: `A empresa ${application.companyName} já está disponível na sua área.` });
  await writeAudit({ userId: input.reviewerId, action: "company_application_approved", resource: "company", resourceId: companyId });
  return { success: true, companyId };
}

export async function setCompanyStatus(input: { id: number; status: "approved" | "rejected" | "suspended" | "under_review"; adminId: number }) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.update(companies).set({ status: input.status, approvedAt: input.status === "approved" ? new Date() : undefined }).where(eq(companies.id, input.id));
  await writeAudit({ userId: input.adminId, action: `company_${input.status}`, resource: "company", resourceId: input.id });
  return { success: true };
}

export async function updateCompany(input: { id: number; name: string; contactName?: string; contactEmail?: string; phone?: string; country?: string; city?: string; sector?: string; employeeCount: number; adminId: number }) {
  const db = await getDb();
  if (!db) return { success: true };
  await db.update(companies).set({ name: input.name, contactName: input.contactName, contactEmail: input.contactEmail, phone: input.phone, country: input.country, city: input.city, sector: input.sector, employeeCount: input.employeeCount }).where(eq(companies.id, input.id));
  await writeAudit({ userId: input.adminId, action: "company_updated", resource: "company", resourceId: input.id });
  return { success: true };
}

export async function getCompanyDashboard(userId: number) {
  const membership = await getCompanyMembership(userId);
  if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb();
  if (!db) return { company: membership.company, totals: { collaborators: 0, activeCollaborators: 0, assignedCourses: 0, inProgress: 0, completed: 0, averageProgress: 0, averageScore: 0, certificates: 0 } };
  const members = await db.select().from(companyUsers).where(eq(companyUsers.companyId, membership.company.id));
  const memberIds = members.map(item => item.userId);
  const assignments = await db.select().from(companyCourseAssignments).where(eq(companyCourseAssignments.companyId, membership.company.id));
  const progress = memberIds.length ? await db.select().from(studentProgress).where(inArray(studentProgress.userId, memberIds)) : [];
  const certs = memberIds.length ? await db.select().from(certificates).where(inArray(certificates.userId, memberIds)) : [];
  const completed = assignments.filter(item => item.status === "completed").length;
  const inProgress = assignments.filter(item => item.status === "in_progress").length;
  const avg = progress.length ? Math.round((progress.filter(item => item.isCompleted).length / progress.length) * 100) : 0;
  return { company: membership.company, totals: { collaborators: members.length, activeCollaborators: members.length, assignedCourses: assignments.length, inProgress, completed, averageProgress: avg, averageScore: 0, certificates: certs.length } };
}

export async function listCompanyMembers(userId: number) {
  const membership = await getCompanyMembership(userId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return [];
  const memberships = await db.select().from(companyUsers).where(eq(companyUsers.companyId, membership.company.id));
  const ids = memberships.map(item => item.userId); if (!ids.length) return [];
  const people = await db.select().from(users).where(inArray(users.id, ids));
  const assignments = await db.select().from(companyCourseAssignments).where(eq(companyCourseAssignments.companyId, membership.company.id));
  return people.map(person => ({ ...person, membership: memberships.find(item => item.userId === person.id), assignedCourses: assignments.filter(item => item.userId === person.id).length }));
}

export async function addCompanyMember(input: { actorId: number; name: string; email: string }) {
  const membership = await getCompanyMembership(input.actorId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return { success: true, userId: 0 };
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  let userId = existing[0]?.id;
  if (existing[0]) await db.update(users).set({ name: input.name, isActive: true }).where(eq(users.id, existing[0].id));
  else { const result = await db.insert(users).values({ openId: `company-invite-${Date.now()}-${input.email}`, name: input.name, email: input.email, role: "estudante", loginMethod: "company-invite" }); userId = Number(result[0].insertId); }
  await db.insert(companyUsers).values({ companyId: membership.company.id, userId, role: "collaborator" }).onDuplicateKeyUpdate({ set: { role: "collaborator" } });
  await createNotification({ userId, type: "company_invitation", title: "Foi adicionado a uma equipa", body: `A empresa ${membership.company.name} adicionou-o à sua equipa.` });
  await writeAudit({ userId: input.actorId, action: "company_member_added", resource: "user", resourceId: userId });
  return { success: true, userId };
}

export async function setCompanyMemberActive(input: { actorId: number; userId: number; active: boolean }) {
  const membership = await getCompanyMembership(input.actorId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return { success: true };
  const rows = await db.select().from(companyUsers).where(and(eq(companyUsers.companyId, membership.company.id), eq(companyUsers.userId, input.userId))).limit(1);
  if (!rows[0]) throw new Error("Colaborador não pertence a esta empresa");
  await db.update(users).set({ isActive: input.active }).where(eq(users.id, input.userId));
  await writeAudit({ userId: input.actorId, action: input.active ? "company_member_activated" : "company_member_deactivated", resource: "user", resourceId: input.userId });
  return { success: true };
}

export async function listCompanyCourses(userId: number) {
  const membership = await getCompanyMembership(userId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return [];
  return db.select().from(courses).where(eq(courses.status, "published")).orderBy(desc(courses.createdAt));
}

export async function assignCompanyCourse(input: { actorId: number; courseId: number; userId: number; dueAt?: Date }) {
  const membership = await getCompanyMembership(input.actorId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return { success: true };
  const allowed = await db.select().from(companyUsers).where(and(eq(companyUsers.companyId, membership.company.id), eq(companyUsers.userId, input.userId))).limit(1);
  if (!allowed[0]) throw new Error("Colaborador não pertence a esta empresa");
  await db.insert(companyCourseAssignments).values({ companyId: membership.company.id, courseId: input.courseId, userId: input.userId, assignedBy: input.actorId, dueAt: input.dueAt, status: "assigned" });
  await db.insert(enrollments).values({ courseId: input.courseId, userId: input.userId, cohort: membership.company.name, status: "active" }).onDuplicateKeyUpdate({ set: { status: "active", cohort: membership.company.name } });
  await createNotification({ userId: input.userId, type: "course_assigned", title: "Novo curso atribuído", body: `A empresa ${membership.company.name} atribuiu-lhe um novo curso.` });
  await writeAudit({ userId: input.actorId, action: "company_course_assigned", resource: "course", resourceId: input.courseId });
  return { success: true };
}

export async function getCompanyPerformance(userId: number, filters: { courseId?: number; memberId?: number; status?: string }) {
  const membership = await getCompanyMembership(userId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return { rows: [], totals: { assignments: 0, completed: 0, averageProgress: 0 } };
  let assignments = await db.select().from(companyCourseAssignments).where(eq(companyCourseAssignments.companyId, membership.company.id));
  if (filters.courseId) assignments = assignments.filter(item => item.courseId === filters.courseId);
  if (filters.memberId) assignments = assignments.filter(item => item.userId === filters.memberId);
  if (filters.status) assignments = assignments.filter(item => item.status === filters.status);
  const userIds = assignments.map(item => item.userId).filter((id): id is number => Boolean(id)); const courseIds = assignments.map(item => item.courseId);
  const people = userIds.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)) : [];
  const courseRows = courseIds.length ? await db.select({ id: courses.id, title: courses.title }).from(courses).where(inArray(courses.id, courseIds)) : [];
  const progress = userIds.length ? await db.select().from(studentProgress).where(inArray(studentProgress.userId, userIds)) : [];
  const rows = assignments.map(item => { const person = people.find(row => row.id === item.userId); const course = courseRows.find(row => row.id === item.courseId); const mine = progress.filter(row => row.userId === item.userId); const progressPercent = mine.length ? Math.round((mine.filter(row => row.isCompleted).length / mine.length) * 100) : 0; return { ...item, person, course, progress: progressPercent, score: 0 }; });
  return { rows, totals: { assignments: rows.length, completed: rows.filter(row => row.status === "completed").length, averageProgress: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0 } };
}

export async function listCompanyCertificates(userId: number) {
  const membership = await getCompanyMembership(userId); if (!membership) throw new Error("Empresa não encontrada");
  const db = await getDb(); if (!db) return [];
  const members = await db.select().from(companyUsers).where(eq(companyUsers.companyId, membership.company.id)); const ids = members.map(item => item.userId); if (!ids.length) return [];
  const rows = await db.select().from(certificates).where(inArray(certificates.userId, ids));
  const people = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ids)); const courseIds = rows.map(row => row.courseId); const courseRows = courseIds.length ? await db.select({ id: courses.id, title: courses.title }).from(courses).where(inArray(courses.id, courseIds)) : [];
  return rows.map(row => ({ ...row, user: people.find(person => person.id === row.userId), course: courseRows.find(course => course.id === row.courseId) }));
}

export async function listNotifications(userId: number, unreadOnly = false) { const db = await getDb(); if (!db) return []; const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)); return unreadOnly ? rows.filter(row => !row.readAt) : rows; }
export async function markNotificationRead(userId: number, id: number) { const db = await getDb(); if (!db) return { success: true }; await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId))); return { success: true }; }
export async function markAllNotificationsRead(userId: number) { const db = await getDb(); if (!db) return { success: true }; await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))); return { success: true }; }
export async function getNotificationPreferences(userId: number) { const db = await getDb(); if (!db) return { emailEnabled: true, courseUpdates: true, assessmentUpdates: true, paymentUpdates: true, companyUpdates: true, securityUpdates: true }; const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1); return rows[0] ?? { emailEnabled: true, courseUpdates: true, assessmentUpdates: true, paymentUpdates: true, companyUpdates: true, securityUpdates: true }; }
export async function updateNotificationPreferences(userId: number, input: { emailEnabled: boolean; courseUpdates: boolean; assessmentUpdates: boolean; paymentUpdates: boolean; companyUpdates: boolean; securityUpdates: boolean }) { const db = await getDb(); if (!db) return { success: true }; await db.insert(notificationPreferences).values({ userId, ...input }).onDuplicateKeyUpdate({ set: input }); return { success: true }; }

export async function getAdminOverview() {
  const db = await getDb(); if (!db) return { students: 0, formadores: 0, companies: 0, courses: 0, publishedCourses: 0, enrollments: 0, completedCourses: 0, certificates: 0, pendingApplications: 0 };
  const [allUsers, allCompanies, allCourses, allEnrollments, allCertificates, applications] = await Promise.all([db.select().from(users), db.select().from(companies), db.select().from(courses), db.select().from(enrollments), db.select().from(certificates), db.select().from(companyPartnershipApplications)]);
  return { students: allUsers.filter(row => ["estudante", "user"].includes(row.role)).length, formadores: allUsers.filter(row => row.role === "formador").length, companies: allCompanies.length, courses: allCourses.length, publishedCourses: allCourses.filter(row => row.status === "published").length, enrollments: allEnrollments.length, completedCourses: allEnrollments.filter(row => row.status === "completed").length, certificates: allCertificates.length, pendingApplications: applications.filter(row => row.status === "pending").length };
}

export async function listAdminUsers(role?: string) { const db = await getDb(); if (!db) return []; const rows = await db.select().from(users).orderBy(desc(users.createdAt)); return role && role !== "all" ? rows.filter(row => row.role === role) : rows; }
export async function setUserActive(input: { adminId: number; userId: number; active: boolean }) { const db = await getDb(); if (!db) return { success: true }; await db.update(users).set({ isActive: input.active }).where(eq(users.id, input.userId)); await writeAudit({ userId: input.adminId, action: input.active ? "user_activated" : "user_deactivated", resource: "user", resourceId: input.userId }); return { success: true }; }
