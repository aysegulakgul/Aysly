CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_length" CHECK (char_length("users"."name") between 1 and 100),
	CONSTRAINT "users_email_normalized" CHECK ("users"."email" = lower(btrim("users"."email")))
);
--> statement-breakpoint
CREATE TABLE "workspace_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "memberships_role" CHECK ("workspace_memberships"."role" in ('owner','admin','member','guest')),
	CONSTRAINT "memberships_status" CHECK ("workspace_memberships"."status" in ('active','removed'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspaces_type" CHECK ("workspaces"."type" in ('personal','shared')),
	CONSTRAINT "workspaces_name_length" CHECK (char_length("workspaces"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text NOT NULL,
	"icon" text,
	"status" text DEFAULT 'active' NOT NULL,
	"position" text NOT NULL,
	"created_by" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_batch_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "projects_kind" CHECK ("projects"."kind" in ('inbox','standard')),
	CONSTRAINT "projects_status" CHECK ("projects"."status" in ('active','on_hold','completed')),
	CONSTRAINT "projects_name_length" CHECK (char_length(btrim("projects"."name")) between 1 and 120),
	CONSTRAINT "projects_description_length" CHECK ("projects"."description" is null or char_length("projects"."description") <= 5000),
	CONSTRAINT "projects_inbox_protected" CHECK ("projects"."kind" <> 'inbox' or ("projects"."archived_at" is null and "projects"."deleted_at" is null))
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"timezone" text NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"density" text DEFAULT 'comfortable' NOT NULL,
	"date_format" text NOT NULL,
	"time_format" text NOT NULL,
	"week_start" smallint NOT NULL,
	"default_task_view" text DEFAULT 'list' NOT NULL,
	"start_page" text DEFAULT 'dashboard' NOT NULL,
	"all_day_reminder_time" time DEFAULT '09:00' NOT NULL,
	"dashboard_layout" jsonb NOT NULL,
	"notification_settings" jsonb NOT NULL,
	"onboarding" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prefs_locale" CHECK ("user_preferences"."locale" in ('tr','en')),
	CONSTRAINT "prefs_theme" CHECK ("user_preferences"."theme" in ('light','dark','system')),
	CONSTRAINT "prefs_density" CHECK ("user_preferences"."density" in ('comfortable','compact')),
	CONSTRAINT "prefs_date_format" CHECK ("user_preferences"."date_format" in ('DD.MM.YYYY','YYYY-MM-DD','MM/DD/YYYY')),
	CONSTRAINT "prefs_time_format" CHECK ("user_preferences"."time_format" in ('24h','12h')),
	CONSTRAINT "prefs_week_start" CHECK ("user_preferences"."week_start" in (0,1,6)),
	CONSTRAINT "prefs_default_view" CHECK ("user_preferences"."default_task_view" in ('list','board','calendar')),
	CONSTRAINT "prefs_start_page" CHECK ("user_preferences"."start_page" in ('dashboard','inbox','my-tasks'))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_unique" ON "auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_one_active" ON "workspace_memberships" USING btree ("workspace_id","user_id") WHERE "workspace_memberships"."status" = 'active';--> statement-breakpoint
CREATE INDEX "memberships_user_status_idx" ON "workspace_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_one_personal_per_owner" ON "workspaces" USING btree ("owner_user_id") WHERE "workspaces"."type" = 'personal';--> statement-breakpoint
CREATE UNIQUE INDEX "projects_one_inbox_per_workspace" ON "projects" USING btree ("workspace_id") WHERE "projects"."kind" = 'inbox';--> statement-breakpoint
CREATE INDEX "projects_workspace_position_idx" ON "projects" USING btree ("workspace_id","position") WHERE "projects"."deleted_at" is null and "projects"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "audit_actor_created_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_workspace_created_idx" ON "audit_events" USING btree ("workspace_id","created_at");