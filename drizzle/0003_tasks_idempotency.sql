CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"start_date" date,
	"due_date" date,
	"due_time" time,
	"timezone" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"position" text NOT NULL,
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_batch_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "tasks_title_length" CHECK (char_length(btrim("tasks"."title")) between 1 and 500),
	CONSTRAINT "tasks_description_length" CHECK ("tasks"."description" is null or char_length("tasks"."description") <= 20000),
	CONSTRAINT "tasks_status" CHECK ("tasks"."status" in ('todo','in_progress','done')),
	CONSTRAINT "tasks_priority" CHECK ("tasks"."priority" between 0 and 3),
	CONSTRAINT "tasks_completed_consistent" CHECK (("tasks"."status" = 'done') = ("tasks"."completed_at" is not null)),
	CONSTRAINT "tasks_start_before_due" CHECK ("tasks"."start_date" is null or "tasks"."due_date" is null or "tasks"."start_date" <= "tasks"."due_date"),
	CONSTRAINT "tasks_due_time_complete" CHECK ("tasks"."due_time" is null or ("tasks"."due_date" is not null and "tasks"."timezone" is not null and "tasks"."due_at" is not null)),
	CONSTRAINT "tasks_not_own_parent" CHECK ("tasks"."parent_task_id" is null or "tasks"."parent_task_id" <> "tasks"."id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_fk" FOREIGN KEY ("workspace_id","parent_task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_project_list_idx" ON "tasks" USING btree ("workspace_id","project_id","status","position") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("workspace_id","due_date") WHERE "tasks"."deleted_at" is null and "tasks"."status" <> 'done' and "tasks"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("workspace_id","due_at") WHERE "tasks"."deleted_at" is null and "tasks"."due_at" is not null and "tasks"."status" <> 'done';--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_task_id") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_trash_idx" ON "tasks" USING btree ("workspace_id","deleted_at") WHERE "tasks"."deleted_at" is not null;