import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  ClarificationSection,
  EvidenceSection,
  GrowthSection,
  PageSection,
  PositioningSection,
  ProjectHeader,
  ScreenshotsSection,
  SimulatedBanner,
} from "@/components/project-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db";
import type { Gate } from "@/domain/approval";
import { findProjectByToken } from "@/workflow/actions";
import { loadProjectView } from "@/workflow/queries";
import { customerAnswers, customerDecision, customerDeleteImage, customerUploadImages } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的出海项目",
  robots: { index: false, follow: false },
};

const GATE_TEXT: Record<Gate, string> = {
  positioning: "请确认老板推荐的定位方案",
  publish: "请确认页面和渠道素材，确认后页面会公开",
  next_round: "请确认是否开启下一轮实验",
};

export default async function CustomerProjectPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { error, notice } = await searchParams;
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const view = await loadProjectView(db, project);

  const openGate: Gate | null =
    project.status === "awaiting_positioning" &&
    view.gates.positioning.founder === "approved" &&
    view.gates.positioning.customer === "pending"
      ? "positioning"
      : project.status === "awaiting_publish" &&
          view.gates.publish.founder === "approved" &&
          view.gates.publish.customer === "pending"
        ? "publish"
        : project.status === "reviewing" &&
            view.gates.next_round.founder === "approved" &&
            view.gates.next_round.customer === "pending"
          ? "next_round"
          : null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      {view.simulated ? <SimulatedBanner /> : null}
      <ProjectHeader project={project} />
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      {notice ? <p className="rounded-md border p-3 text-sm">{String(notice)}</p> : null}
      <p className="text-sm text-muted-foreground">
        这是你的项目专属链接，请不要转发给无关的人。如需作废，请联系首客。
      </p>

      {project.status === "submitted" ? (
        <Card>
          <CardContent className="pt-6 text-sm">项目已提交，等待首客老板确认后开始研究。</CardContent>
        </Card>
      ) : null}

      {["researching", "strategizing", "preparing_page"].includes(project.status) ||
      (project.status === "reviewing" && !view.report) ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <AutoRefresh />
            首客的 Agent 正在工作，页面会自动更新。
          </CardContent>
        </Card>
      ) : null}

      {openGate ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>待你确认</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={customerDecision.bind(null, token)} className="flex flex-col gap-3">
              <p className="text-sm">{GATE_TEXT[openGate]}</p>
              <input type="hidden" name="gate" value={openGate} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="reason">退回原因（退回时必填）</Label>
                <Input id="reason" name="reason" maxLength={500} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" name="verdict" value="approve">
                  确认采用
                </Button>
                <Button type="submit" name="verdict" value="reject" variant="outline">
                  退回修改
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <ClarificationSection
        questions={view.clarifications}
        canAnswer={project.status === "needs_info"}
        answerAction={customerAnswers.bind(null, token)}
      />
      <PositioningSection view={view} />
      <PageSection view={view} previewHref={`/p/${token}/preview`} />
      <GrowthSection view={view} />
      <ScreenshotsSection
        images={view.images}
        hrefFor={(imageId) => `/p/${token}/images/${imageId}`}
        editable={project.status !== "delivered" && project.status !== "cancelled"}
        uploadAction={customerUploadImages.bind(null, token)}
        deleteAction={customerDeleteImage.bind(null, token)}
      />
      <EvidenceSection view={view} />
    </main>
  );
}
