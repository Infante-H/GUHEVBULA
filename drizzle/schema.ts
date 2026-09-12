import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core identity table used by the Manus OAuth callback. */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin", "formador", "estudante", "empresa"])
      .default("user")
      .notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({ roleIdx: index("users_role_idx").on(table.role) })
);

export const profiles = mysqlTable(
  "profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bio: text("bio"),
    avatarUrl: text("avatarUrl"),
    country: varchar("country", { length: 120 }),
    city: varchar("city", { length: 120 }),
    phone: varchar("phone", { length: 40 }),
    timezone: varchar("timezone", { length: 80 }).default("Africa/Maputo"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userIdx: uniqueIndex("profiles_user_uidx").on(table.userId) })
);

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  description: text("description"),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const courses = mysqlTable(
  "courses",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
    createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    description: text("description").notNull(),
    coverImage: text("coverImage"),
    level: mysqlEnum("level", ["iniciante", "intermedio", "avancado"]).default("iniciante").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 3 }).default("MZN").notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    certificateEnabled: boolean("certificateEnabled").default(true).notNull(),
    requirements: text("requirements"),
    objectives: text("objectives"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ statusIdx: index("courses_status_idx").on(table.status), categoryIdx: index("courses_category_idx").on(table.categoryId) })
);

export const courseInstructors = mysqlTable(
  "course_instructors",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedBy: int("assignedBy").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ assignmentIdx: uniqueIndex("course_instructor_uidx").on(table.courseId, table.userId) })
);

export const modules = mysqlTable(
  "modules",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ courseIdx: index("modules_course_idx").on(table.courseId) })
);

export const lessons = mysqlTable(
  "lessons",
  {
    id: int("id").autoincrement().primaryKey(),
    moduleId: int("moduleId").notNull().references(() => modules.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    type: mysqlEnum("type", ["video", "text", "pdf", "material"]).default("video").notNull(),
    durationMinutes: int("durationMinutes").default(10).notNull(),
    position: int("position").default(0).notNull(),
    isPublished: boolean("isPublished").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ moduleIdx: index("lessons_module_idx").on(table.moduleId) })
);

export const lessonMaterials = mysqlTable("lesson_materials", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl"),
  mimeType: varchar("mimeType", { length: 120 }),
  isPrivate: boolean("isPrivate").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const enrollments = mysqlTable(
  "enrollments",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    cohort: varchar("cohort", { length: 120 }).default("Geral").notNull(),
    status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
    enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => ({ enrollmentIdx: uniqueIndex("enrollments_course_user_uidx").on(table.courseId, table.userId) })
);

export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  moduleId: int("moduleId").references(() => modules.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  passingScore: int("passingScore").default(70).notNull(),
  attemptsAllowed: int("attemptsAllowed").default(3).notNull(),
  dueAt: timestamp("dueAt"),
});

export const quizQuestions = mysqlTable("quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["multiple_choice", "true_false", "open"]).notNull(),
  question: text("question").notNull(),
  options: json("options"),
  points: int("points").default(1).notNull(),
  position: int("position").default(0).notNull(),
});

export const quizAttempts = mysqlTable("quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  answers: json("answers"),
  score: decimal("score", { precision: 5, scale: 2 }),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  moduleId: int("moduleId").references(() => modules.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  instructions: text("instructions").notNull(),
  dueAt: timestamp("dueAt"),
  maxScore: int("maxScore").default(100).notNull(),
});

export const assignmentSubmissions = mysqlTable("assignment_submissions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  answerText: text("answerText"),
  fileKey: text("fileKey"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export const grades = mysqlTable("grades", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
  quizAttemptId: int("quizAttemptId").references(() => quizAttempts.id, { onDelete: "cascade" }),
  graderId: int("graderId").notNull().references(() => users.id, { onDelete: "restrict" }),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studentProgress = mysqlTable(
  "student_progress",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    lessonId: int("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    isCompleted: boolean("isCompleted").default(false).notNull(),
    completedAt: timestamp("completedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ progressIdx: uniqueIndex("student_progress_user_lesson_uidx").on(table.userId, table.lessonId) })
);

export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  certificateNumber: varchar("certificateNumber", { length: 80 }).notNull().unique(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  pdfFileKey: text("pdfFileKey"),
});

export const companies = mysqlTable(
  "companies",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    country: varchar("country", { length: 120 }),
    city: varchar("city", { length: 120 }),
    sector: varchar("sector", { length: 120 }),
    status: mysqlEnum("status", ["pending", "approved", "suspended"]).default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ statusIdx: index("companies_status_idx").on(table.status) })
);

export const companyUsers = mysqlTable(
  "company_users",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["owner", "manager", "collaborator"]).default("collaborator").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ companyUserIdx: uniqueIndex("company_users_company_user_uidx").on(table.companyId, table.userId) })
);

export const companyCourseAssignments = mysqlTable("company_course_assignments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  assignedBy: int("assignedBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const companyPartnershipApplications = mysqlTable(
  "company_partnership_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    companyName: varchar("companyName", { length: 180 }).notNull(),
    contactName: varchar("contactName", { length: 180 }).notNull(),
    businessEmail: varchar("businessEmail", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    country: varchar("country", { length: 120 }),
    city: varchar("city", { length: 120 }),
    sector: varchar("sector", { length: 120 }),
    employeeCount: int("employeeCount"),
    trainingCount: int("trainingCount"),
    interests: text("interests"),
    message: text("message"),
    acceptedTerms: boolean("acceptedTerms").default(false).notNull(),
    status: mysqlEnum("status", ["pending", "under_review", "approved", "rejected"]).default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ applicationStatusIdx: index("partnership_applications_status_idx").on(table.status) })
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ notificationUserIdx: index("notifications_user_idx").on(table.userId) })
);

export const wishlist = mysqlTable(
  "wishlist",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ wishlistIdx: uniqueIndex("wishlist_user_course_uidx").on(table.userId, table.courseId) })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
