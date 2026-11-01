ALTER TABLE "tasks" DROP CONSTRAINT "tasks_status";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status" CHECK ("tasks"."status" in ('todo','in_progress','on_hold','done'));