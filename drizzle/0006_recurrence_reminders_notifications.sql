CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"offset_minutes" integer,
	"remind_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_task_remind_at_unique" UNIQUE("task_id","remind_at"),
	CONSTRAINT "reminders_kind" CHECK ("reminders"."kind" in ('absolute','relative')),
	CONSTRAINT "reminders_offset" CHECK (("reminders"."kind" = 'relative') = ("reminders"."offset_minutes" is not null) and ("reminders"."offset_minutes" is null or "reminders"."offset_minutes" >= 0)),
	CONSTRAINT "reminders_status" CHECK ("reminders"."status" in ('pending','sent','canceled','skipped'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"type" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"payload" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_user_dedupe_unique" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_view_type";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_rule" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_mode" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_series_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_anchor" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_index" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_generated_from" uuid;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("recipient_user_id","remind_at") WHERE "reminders"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "reminders_task_idx" ON "reminders" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_recurrence_generated_idx" ON "tasks" USING btree ("recurrence_generated_from") WHERE "tasks"."recurrence_generated_from" is not null;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_valid" CHECK ("tasks"."recurrence_rule" is null or ("tasks"."due_date" is not null and "tasks"."parent_task_id" is null and "tasks"."recurrence_mode" in ('fixed_schedule','after_completion') and "tasks"."recurrence_series_id" is not null and "tasks"."recurrence_anchor" is not null and "tasks"."recurrence_index" >= 1));--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_view_type" CHECK ("saved_views"."view_type" in ('list','board','calendar'));