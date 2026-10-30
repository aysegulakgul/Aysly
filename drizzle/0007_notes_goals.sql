CREATE TABLE "note_tags" (
	"note_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "note_tags_note_id_tag_id_pk" PRIMARY KEY("note_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "note_project_links" (
	"note_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_project_links_note_id_project_id_pk" PRIMARY KEY("note_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "note_task_links" (
	"note_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_task_links_note_id_task_id_pk" PRIMARY KEY("note_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text,
	"body" text DEFAULT '' NOT NULL,
	"pinned_at" timestamp with time zone,
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_batch_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "notes_not_empty" CHECK (char_length(coalesce("notes"."title", '')) + char_length("notes"."body") > 0),
	CONSTRAINT "notes_title_length" CHECK ("notes"."title" is null or char_length("notes"."title") <= 200),
	CONSTRAINT "notes_body_length" CHECK (char_length("notes"."body") <= 200000)
);
--> statement-breakpoint
CREATE TABLE "goal_project_links" (
	"goal_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "goal_project_links_goal_id_project_id_pk" PRIMARY KEY("goal_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "goal_task_links" (
	"goal_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "goal_task_links_goal_id_task_id_pk" PRIMARY KEY("goal_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"progress_mode" text DEFAULT 'auto' NOT NULL,
	"manual_progress" smallint,
	"achieved_at" timestamp with time zone,
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_batch_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "goals_title_length" CHECK (char_length(btrim("goals"."title")) between 1 and 200),
	CONSTRAINT "goals_description_length" CHECK ("goals"."description" is null or char_length("goals"."description") <= 5000),
	CONSTRAINT "goals_status" CHECK ("goals"."status" in ('active','achieved','abandoned')),
	CONSTRAINT "goals_progress_mode" CHECK ("goals"."progress_mode" in ('auto','manual')),
	CONSTRAINT "goals_manual_progress" CHECK ("goals"."manual_progress" is null or "goals"."manual_progress" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_fk" FOREIGN KEY ("workspace_id","note_id") REFERENCES "public"."notes"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_fk" FOREIGN KEY ("workspace_id","tag_id") REFERENCES "public"."tags"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_project_links" ADD CONSTRAINT "note_project_links_note_fk" FOREIGN KEY ("workspace_id","note_id") REFERENCES "public"."notes"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_project_links" ADD CONSTRAINT "note_project_links_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_task_links" ADD CONSTRAINT "note_task_links_note_fk" FOREIGN KEY ("workspace_id","note_id") REFERENCES "public"."notes"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_task_links" ADD CONSTRAINT "note_task_links_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_project_links" ADD CONSTRAINT "goal_project_links_goal_fk" FOREIGN KEY ("workspace_id","goal_id") REFERENCES "public"."goals"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_project_links" ADD CONSTRAINT "goal_project_links_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_task_links" ADD CONSTRAINT "goal_task_links_goal_fk" FOREIGN KEY ("workspace_id","goal_id") REFERENCES "public"."goals"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_task_links" ADD CONSTRAINT "goal_task_links_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_tags_tag_idx" ON "note_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "note_project_links_project_idx" ON "note_project_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "note_task_links_task_idx" ON "note_task_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "notes_list_idx" ON "notes" USING btree ("workspace_id","updated_at") WHERE "notes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "goal_project_links_project_idx" ON "goal_project_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "goal_task_links_task_idx" ON "goal_task_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "goals_list_idx" ON "goals" USING btree ("workspace_id","status") WHERE "goals"."deleted_at" is null;