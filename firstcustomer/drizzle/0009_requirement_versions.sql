CREATE TABLE "project_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"scope_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "requirement_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "clarifications" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "clarifications" ADD COLUMN "batch" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "current_workflow" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "success_criteria" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "constraints" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "requirement_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "clarification_rounds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "clarifications_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_requirements_version_idx" ON "project_requirements" USING btree ("project_id","version");
--> statement-breakpoint
UPDATE projects SET clarification_rounds = 1 WHERE EXISTS (SELECT 1 FROM clarifications WHERE clarifications.project_id = projects.id);
--> statement-breakpoint
INSERT INTO project_requirements (project_id, version, scope_version, snapshot, actor, reason, confirmed_at)
SELECT id, 1, 1, jsonb_build_object(
  'productName', product_name, 'productUrl', coalesce(product_url, ''), 'stage', stage, 'goal', goal,
  'targetMarket', coalesce(target_market, ''), 'budgetNote', coalesce(budget_note, ''),
  'currentWorkflow', '', 'successCriteria', '', 'constraints', '',
  'route', CASE WHEN goal = '提升转化' THEN 'growth_diagnosis' WHEN stage IN ('没有产品','有想法') OR goal = '找需求' THEN 'market_validation' ELSE 'launch_validation' END,
  'unknowns', jsonb_build_array('现行做法', '希望验证的结果', '限制条件'), 'answers', '[]'::jsonb
), 'legacy', '迁移前项目资料快照；未补造客户确认', NULL FROM projects;
