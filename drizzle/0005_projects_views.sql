CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"view_type" text NOT NULL,
	"filter" jsonb NOT NULL,
	"sort" text DEFAULT 'manual' NOT NULL,
	"group_by" text DEFAULT 'none' NOT NULL,
	"position" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_name_length" CHECK (char_length(btrim("saved_views"."name")) between 1 and 60),
	CONSTRAINT "saved_views_view_type" CHECK ("saved_views"."view_type" in ('list','board'))
);
--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_views_owner_idx" ON "saved_views" USING btree ("workspace_id","owner_user_id","position");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_color" CHECK ("projects"."color" in ('slate','red','orange','amber','green','teal','cyan','blue','indigo','violet','pink','brown'));