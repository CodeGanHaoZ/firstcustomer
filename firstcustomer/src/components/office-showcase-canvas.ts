import { desks, type Point } from "@/components/office-map";
import { DEMO_DURATION, OFFICE_TIMING as T, type DemoScene } from "@/lib/office-showcase";

const WIDTH = 1681;
const HEIGHT = 936;
type Person = keyof typeof desks;
type Pose = { point: Point; face: number; walking: boolean; cut: number };
const clamp = (value: number) => Math.min(1, Math.max(0, value));

function along(points: Point[], progress: number, backwards: boolean): Pose {
  const distances = points.slice(1).map((point, i) => Math.hypot((point[0] - points[i][0]) * WIDTH, (point[1] - points[i][1]) * HEIGHT));
  const total = distances.reduce((sum, value) => sum + value, 0);
  const fraction = backwards ? 1 - clamp(progress) : clamp(progress);
  let remaining = fraction * total;
  let index = 0;
  while (index < distances.length - 1 && remaining > distances[index]) remaining -= distances[index++];
  const start = points[index];
  const end = points[index + 1];
  const part = distances[index] ? remaining / distances[index] : 0;
  return { point: [start[0] + (end[0] - start[0]) * part, start[1] + (end[1] - start[1]) * part],
    face: progress <= 0 && !backwards ? -1 : (end[0] >= start[0] ? 1 : -1) * (backwards ? -1 : 1), walking: progress > 0 && progress < 1,
    cut: .24 * (1 - Math.min(1, fraction * 5)) };
}

export function scenePoses(scene: DemoScene, elapsed: number) {
  const from = desks[scene.from];
  const to = desks[scene.to];
  const side = from.exit[0] < to.exit[0] ? -1 : 1;
  const meeting: Point = [to.exit[0], to.home[1] < 52 ? 46 : 58];
  const delivery: Point = [meeting[0] + side * 6, meeting[1]];
  const senderPath: Point[] = [from.home, from.exit, [from.exit[0], 52], [delivery[0], 52], delivery];
  const receiverPath: Point[] = [to.home, to.exit, meeting];
  const returning = elapsed >= T.return;
  const sender = along(senderPath, returning ? (elapsed - T.return) / (T.home - T.return) : (elapsed - T.depart) / (T.meet - T.depart), returning);
  const receiver = along(receiverPath, returning ? (elapsed - T.return) / (T.home - T.return) : (elapsed - (T.meet - 1600)) / 1600, returning);
  if (elapsed >= T.meet && elapsed < T.return) { sender.face = -side; receiver.face = side; }
  return { sender, receiver, exchanging: elapsed >= T.meet && elapsed < T.return,
    beat: elapsed < T.meet ? 0 : elapsed < T.return ? 1 : 2,
    phase: elapsed < T.depart ? 0 : elapsed < T.meet ? 1 : elapsed < T.pass ? 2 : elapsed < T.return ? 3 : elapsed < T.home ? 4 : 5 };
}

export function drawOfficeActors(ctx: CanvasRenderingContext2D, atlas: HTMLImageElement, scene: DemoScene, elapsed: number, animate: boolean) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const { sender, receiver, exchanging, beat, phase } = scenePoses(scene, elapsed);
  const people = (Object.keys(desks) as Person[]).map((person) => ({ person,
    pose: person === scene.from ? sender : person === scene.to ? receiver
      : { point: desks[person].home, face: -1, walking: false, cut: .24 } as Pose,
  })).sort((a, b) => a.pose.point[1] - b.pose.point[1]);

  const workingPerson = phase === 0 ? scene.from : phase === 5 ? scene.to : null;
  for (const { person, pose } of people) {
    const desk = desks[person];
    const selected = person === scene.from || person === scene.to;
    const working = person === workingPerson;
    if (!pose.walking) {
      const glow = .09 + .10 * (1 + Math.sin(elapsed / 600 + desk.sprite));
      ctx.fillStyle = `rgba(255,246,177,${working ? .55 + glow : glow * .25})`;
      ctx.beginPath();
      ctx.ellipse(desk.screen[0] * WIDTH / 100, desk.screen[1] * HEIGHT / 100, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const x = pose.point[0] * WIDTH / 100;
    const y = pose.point[1] * HEIGHT / 100;
    const stride = pose.walking && animate ? Math.sin(elapsed / 75) : 0;
    const tap = !pose.walking && animate ? Math.sin(elapsed / (working ? 125 : 750) + desk.sprite * 2) : 0;
    const bob = pose.walking ? Math.abs(stride) * 4 : tap * (working ? 4 : .6);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = selected ? 1 : .7;
    if (working) {
      ctx.fillStyle = "rgba(245,255,205,.6)";
      ctx.strokeStyle = "#456447"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -12, 66, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.scale(1.2, 1.2);
    }
    if (pose.cut < .06) {
      ctx.fillStyle = "rgba(75,44,23,.20)";
      ctx.beginPath(); ctx.ellipse(0, 0, 27, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.scale(pose.face, 1);
    ctx.rotate(pose.walking ? stride * .025 : tap * .012);
    const row = pose.walking && Math.floor(elapsed / 180) % 2 ? 136 : 0;
    const height = 136 * (1 - pose.cut);
    const top = working && animate ? 79 : 0;
    ctx.drawImage(atlas, desk.sprite * 112, row + top, 112, height - top, -56, -136 - bob + top, 112, height - top);
    // Separate the head and forepaws from the same atlas: head turns and alternating
    // key taps stay attached to the body instead of bobbing the whole picture alone.
    if (working && animate) {
      ctx.save(); ctx.translate(0, -58 - bob); ctx.rotate(tap * .045);
      ctx.drawImage(atlas, desk.sprite * 112, 0, 112, 79, -56, -78, 112, 79);
      ctx.restore();
      for (const [offset, delta] of [[25, tap * 4], [61, -tap * 4]]) {
        ctx.drawImage(atlas, desk.sprite * 112 + offset, 83, 25, 17, offset - 56, -53 - bob + delta, 25, 17);
      }
    }
    if (working) drawWorkTool(ctx, person, elapsed, animate);
    const carrying = person === scene.from && elapsed >= T.depart - 500 && elapsed < T.pass
      || person === scene.to && elapsed >= T.received && elapsed < T.home;
    if (carrying) drawFile(ctx, 16, -65 - bob, selected ? "#456447" : "#a06e3c");
    ctx.restore();
  }
  if (elapsed >= T.pass && elapsed < T.received) {
    const progress = clamp((elapsed - T.pass) / (T.received - T.pass));
    ctx.save();
    ctx.translate((sender.point[0] + (receiver.point[0] - sender.point[0]) * progress) * WIDTH / 100,
      sender.point[1] * HEIGHT / 100 - 70 - Math.sin(progress * Math.PI) * 15);
    ctx.rotate((progress - .5) * .2);
    drawFile(ctx, 0, 0, "#456447");
    ctx.restore();
  }
  if (exchanging && elapsed >= T.received) {
    ctx.save();
    ctx.translate((sender.point[0] + receiver.point[0]) / 2 * WIDTH / 100, sender.point[1] * HEIGHT / 100 - 128);
    ctx.strokeStyle = "#fff7d9"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-1, 6); ctx.lineTo(10, -7); ctx.stroke();
    ctx.restore();
  }
  return { sender, receiver, beat, phase, progress: Math.min(1, elapsed / DEMO_DURATION) };
}

function drawWorkTool(ctx: CanvasRenderingContext2D, person: Person, elapsed: number, animate: boolean) {
  ctx.save();
  ctx.translate(66, -90 + (animate ? Math.sin(elapsed / 300) * 3 : 0));
  // A functional task icon sits beside the active character, separate from its art.
  ctx.fillStyle = "#fff7db"; ctx.beginPath(); ctx.roundRect(-17, -17, 34, 34, 5); ctx.fill();
  ctx.strokeStyle = "#31543d"; ctx.fillStyle = "#31543d"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  if (person === "research") {
    ctx.beginPath(); ctx.arc(-2, -2, 7, 0, Math.PI * 2); ctx.moveTo(3, 3); ctx.lineTo(10, 10); ctx.stroke();
  } else if (person === "strategy") {
    ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-6, 1); ctx.lineTo(5, -10); ctx.lineTo(10, -5); ctx.lineTo(-1, 6); ctx.closePath(); ctx.stroke();
  } else if (person === "growth") {
    for (let i = 0; i < 3; i++) { const height = 7 + i * 5; ctx.fillRect(-10 + i * 8, 10 - height, 5, height); }
  } else if (person === "finance") {
    ctx.strokeRect(-8, -10, 16, 20); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 3); ctx.lineTo(5, -4); ctx.stroke();
  } else if (person === "launch") {
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(10, -10); ctx.lineTo(5, 10); ctx.lineTo(-1, 1); ctx.closePath(); ctx.moveTo(-1, 1); ctx.lineTo(10, -10); ctx.stroke();
  } else {
    ctx.strokeRect(-11, -7, 22, 14);
    for (let i = 0; i < 3; i++) ctx.fillRect(-7 + i * 6, -3, 3, 2);
    ctx.fillRect(-6, 2, 12, 2);
  }
  ctx.restore();
}

function drawFile(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = "#fff6dc"; ctx.strokeStyle = "#8b6c43"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(x - 13, y - 17, 26, 34, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - 8, y - 10, 16, 4);
  ctx.fillRect(x - 8, y - 1, 16, 2);
  ctx.fillRect(x - 8, y + 6, 11, 2);
}
