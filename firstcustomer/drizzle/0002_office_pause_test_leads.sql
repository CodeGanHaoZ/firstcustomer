ALTER TABLE "leads" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "paused" boolean DEFAULT false NOT NULL;