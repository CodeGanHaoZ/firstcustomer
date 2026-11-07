CREATE TABLE "conclusion_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conclusion_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conclusion_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conclusion_id" uuid NOT NULL,
	"level" text NOT NULL,
	"reason" text NOT NULL,
	"reviewer" text NOT NULL,
	"basis_hash" text NOT NULL,
	"rule_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_conclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scope_version" integer NOT NULL,
	"requirement_version" integer NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"key" text NOT NULL,
	"statement" text NOT NULL,
	"rationale" text NOT NULL,
	"task_id" uuid,
	"actor" text NOT NULL,
	"basis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"scope_version" integer DEFAULT 1 NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"sha256" text NOT NULL,
	"method" text NOT NULL,
	"actor" text NOT NULL,
	"task_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "prompt_hash" text;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "source_version_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "origin_evidence_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "created_task_id" uuid;--> statement-breakpoint
ALTER TABLE "conclusion_evidence" ADD CONSTRAINT "conclusion_evidence_conclusion_id_evidence_conclusions_id_fk" FOREIGN KEY ("conclusion_id") REFERENCES "public"."evidence_conclusions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conclusion_evidence" ADD CONSTRAINT "conclusion_evidence_evidence_id_evidence_items_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conclusion_reviews" ADD CONSTRAINT "conclusion_reviews_conclusion_id_evidence_conclusions_id_fk" FOREIGN KEY ("conclusion_id") REFERENCES "public"."evidence_conclusions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_conclusions" ADD CONSTRAINT "evidence_conclusions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_conclusions" ADD CONSTRAINT "evidence_conclusions_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_versions" ADD CONSTRAINT "source_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_versions" ADD CONSTRAINT "source_versions_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conclusion_evidence_pair_idx" ON "conclusion_evidence" USING btree ("conclusion_id","evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_conclusions_subject_idx" ON "evidence_conclusions" USING btree ("subject_type","subject_id","key");--> statement-breakpoint
CREATE INDEX "evidence_conclusions_project_idx" ON "evidence_conclusions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "source_versions_lookup_idx" ON "source_versions" USING btree ("project_id","scope_version","url");--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_source_version_id_source_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."source_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_created_task_id_agent_tasks_id_fk" FOREIGN KEY ("created_task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Deliberately do not backfill legacy cache contents as historical source versions.
CREATE FUNCTION prevent_provenance_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Provenance records are immutable; create a new version';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER source_versions_immutable BEFORE UPDATE ON source_versions FOR EACH ROW EXECUTE FUNCTION prevent_provenance_update();
--> statement-breakpoint
CREATE TRIGGER evidence_conclusions_immutable BEFORE UPDATE ON evidence_conclusions FOR EACH ROW EXECUTE FUNCTION prevent_provenance_update();
--> statement-breakpoint
CREATE TRIGGER conclusion_evidence_immutable BEFORE UPDATE ON conclusion_evidence FOR EACH ROW EXECUTE FUNCTION prevent_provenance_update();
--> statement-breakpoint
CREATE TRIGGER conclusion_reviews_immutable BEFORE UPDATE ON conclusion_reviews FOR EACH ROW EXECUTE FUNCTION prevent_provenance_update();
--> statement-breakpoint
CREATE FUNCTION validate_source_capture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sha256 <> encode(sha256(convert_to(NEW.text, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Source digest mismatch';
  END IF;
  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM agent_tasks t WHERE t.id = NEW.task_id AND t.project_id = NEW.project_id AND t.scope_version = NEW.scope_version
  ) THEN RAISE EXCEPTION 'Source task outside project scope'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER source_versions_validate BEFORE INSERT ON source_versions FOR EACH ROW EXECUTE FUNCTION validate_source_capture();
--> statement-breakpoint
CREATE FUNCTION protect_evidence_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    (to_jsonb(NEW) - ARRAY['status', 'expires_at', 'license_status']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['status', 'expires_at', 'license_status'])
  ) THEN RAISE EXCEPTION 'Evidence identity is immutable; create new evidence'; END IF;
  IF NEW.source_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM source_versions s WHERE s.id = NEW.source_version_id AND s.url = NEW.url
      AND (s.project_id IS NULL OR (s.project_id = NEW.project_id AND s.scope_version = NEW.scope_version))
  ) THEN RAISE EXCEPTION 'Evidence source outside project scope'; END IF;
  IF NEW.created_task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM agent_tasks t WHERE t.id = NEW.created_task_id AND t.project_id = NEW.project_id AND t.scope_version = NEW.scope_version
  ) THEN RAISE EXCEPTION 'Evidence task outside project scope'; END IF;
  IF NEW.origin_evidence_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM evidence_items e WHERE e.id = NEW.origin_evidence_id AND e.project_id IS NULL
      AND e.source_version_id IS NOT DISTINCT FROM NEW.source_version_id AND e.excerpt = NEW.excerpt
  ) THEN RAISE EXCEPTION 'Invalid library evidence origin'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER evidence_lineage_validate BEFORE INSERT OR UPDATE ON evidence_items FOR EACH ROW EXECUTE FUNCTION protect_evidence_lineage();
--> statement-breakpoint
CREATE FUNCTION validate_conclusion_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM evidence_conclusions c JOIN evidence_items e ON e.project_id = c.project_id AND e.scope_version = c.scope_version
    WHERE c.id = NEW.conclusion_id AND e.id = NEW.evidence_id
  ) THEN RAISE EXCEPTION 'Conclusion evidence outside project scope'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER conclusion_link_validate BEFORE INSERT ON conclusion_evidence FOR EACH ROW EXECUTE FUNCTION validate_conclusion_link();
--> statement-breakpoint
-- Check retained links at commit so deleting an entire project can cascade cleanly,
-- while deleting a referenced source or evidence on its own still fails.
ALTER TABLE conclusion_evidence ALTER CONSTRAINT conclusion_evidence_evidence_id_evidence_items_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE evidence_items ALTER CONSTRAINT evidence_items_source_version_id_source_versions_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE evidence_items ALTER CONSTRAINT evidence_items_created_task_id_agent_tasks_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE evidence_conclusions ALTER CONSTRAINT evidence_conclusions_task_id_agent_tasks_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE source_versions ALTER CONSTRAINT source_versions_task_id_agent_tasks_id_fk DEFERRABLE INITIALLY DEFERRED;
