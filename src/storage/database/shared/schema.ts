import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统健康检查表（保留，禁止删除）
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表（销售和管理员）
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("sales"), // 'admin' | 'sales'
  subject: varchar("subject", { length: 64 }), // 负责学科：语文、数学、英语等
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_role_idx").on(table.role),
  index("users_subject_idx").on(table.subject),
]);

// 学员表
export const students = pgTable("students", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 128 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  wechat: varchar("wechat", { length: 64 }),
  source: varchar("source", { length: 128 }), // 来源：抖音、小红书、转介绍等
  course: varchar("course", { length: 255 }), // 报名课程
  subject: varchar("subject", { length: 64 }), // 学科：语文、数学、英语等
  undertaker: text("undertaker"), // 承接人（多人用逗号分隔，如：王孟博,刘盼盼,李一鑫）
  userId: varchar("user_id", { length: 128 }), // 用户ID（从系统导入的用户标识）
  status: varchar("status", { length: 32 }).default("pending"), // pending | enrolled | refunded | lost
  isRefunded: boolean("is_refunded").default(false).notNull(),
  refundReason: text("refund_reason"),
  salesId: varchar("sales_id", { length: 36 }), // 关联销售（创建人）
  amount: integer("amount"), // 金额
  notes: text("notes"), // 备注
  // 观看进度按学科存储 (JSON格式: { "语文": { "1": true, "2": false }, "数学": { "1": true } })
  lectureProgress: jsonb("lecture_progress").default({}), // 观看进度
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
  index("students_name_idx").on(table.name),
  index("students_phone_idx").on(table.phone),
  index("students_status_idx").on(table.status),
  index("students_sales_id_idx").on(table.salesId),
  index("students_is_refunded_idx").on(table.isRefunded),
  index("students_user_id_idx").on(table.userId),
  index("students_subject_idx").on(table.subject),
]);

// 导入配置表（保存用户的列映射配置）
export const importConfigs = pgTable("import_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(), // 配置名称
  mapping: jsonb("mapping").notNull(), // 列映射配置 { excel列名: 数据库字段 }
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("import_configs_user_id_idx").on(table.userId),
]);

// Zod schemas for validation
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// User schemas
export const insertUserSchema = createCoercedInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
});

export const updateUserSchema = createCoercedInsertSchema(users)
  .pick({
    name: true,
    role: true,
    subject: true,
    isActive: true,
  })
  .partial();

// Student schemas
export const insertStudentSchema = createCoercedInsertSchema(students).pick({
  name: true,
  phone: true,
  wechat: true,
  source: true,
  course: true,
  subject: true,
  undertaker: true,
  userId: true,
  status: true,
  isRefunded: true,
  refundReason: true,
  salesId: true,
  amount: true,
  notes: true,
  lectureProgress: true,
});

export const updateStudentSchema = createCoercedInsertSchema(students)
  .pick({
    name: true,
    phone: true,
    wechat: true,
    source: true,
    course: true,
    subject: true,
    undertaker: true,
    userId: true,
    status: true,
    isRefunded: true,
    refundReason: true,
    salesId: true,
    amount: true,
    notes: true,
    lectureProgress: true,
  })
  .partial();

// Import config schemas
export const insertImportConfigSchema = createCoercedInsertSchema(importConfigs).pick({
  userId: true,
  name: true,
  mapping: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type UpdateStudent = z.infer<typeof updateStudentSchema>;

export type ImportConfig = typeof importConfigs.$inferSelect;
export type InsertImportConfig = z.infer<typeof insertImportConfigSchema>;
