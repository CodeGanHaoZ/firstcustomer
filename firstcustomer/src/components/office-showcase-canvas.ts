import { desks, type Point } from "@/components/office-map";
import { DEMO_DURATION, type DemoScene } from "@/lib/office-showcase";

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
  const returning = elapsed >= 8400;
  const sender = along(senderPath, returning ? (elapsed - 8400) / 2800 : (elapsed - 1700) / 4200, returning);
  const receiver = along(receiverPath, returning ? (elapsed - 8400) / 2300 : (elapsed - 4500) / 1400, returning);
  if (elapsed >= 5900 && elapsed < 8400) { sender.face = -side; receiver.face = side; }
  return { sender, receiver, exchanging: elapsed >= 5900 && elapsed < 8400,
    beat: elapsed < 5900 ? 0 : elapsed < 8400 ? 1 : 2 };
}

export function drawOfficeActors(ctx: CanvasRenderingContext2D, atlas: HTMLImageElement, scene: DemoScene, elapsed: number, animate: boolean) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const { sender, receiver, exchanging, beat } = scenePoses(scene, elapsed);
  const people = (Object.keys(desks) as Person[]).map((person) => ({ person,
    pose: person === scene.from ? sender : person === scene.to ? receiver
      : { point: desks[person].home, face: -1, walking: false, cut: .24 } as Pose,
  })).sort((a, b) => a.pose.point[1] - b.pose.point[1]);

  for (const { person, pose } of people) {
    const desk = desks[person];
    const selected = person === scene.from || person === scene.to;
    if (animate && !pose.walking) {
      const glow = .09 + .10 * (1 + Math.sin(elapsed / 600 + desk.sprite));
      ctx.fillStyle = `rgba(255,246,177,${selected ? glow : glow * .35})`;
      ctx.beginPath();
      ctx.ellipse(desk.screen[0] * WIDTH / 100, desk.screen[1] * HEIGHT / 100, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const x = pose.point[0] * WIDTH / 100;
    const y = pose.point[1] * HEIGHT / 100;
    const stride = pose.walking && animate ? Math.sin(elapsed / 75) : 0;
    const tap = !pose.walking && animate ? Math.sin(elapsed / (selected ? 180 : 650) + desk.sprite * 2) : 0;
    const bob = pose.walking ? Math.abs(stride) * 4 : tap * (selected ? 1.7 : .6);
    ctx.save();
    ctx.translate(x, y);
    if (pose.cut < .06) {
      ctx.fillStyle = "rgba(75,44,23,.20)";
      ctx.beginPath(); ctx.ellipse(0, 0, 27, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.scale(pose.face, 1);
    ctx.rotate(pose.walking ? stride * .025 : tap * .012);
    const row = pose.walking && Math.floor(elapsed / 180) % 2 ? 136 : 0;
    const height = 136 * (1 - pose.cut);
    ctx.drawImage(atlas, desk.sprite * 112, row, 112, height, -56, -136 - bob, 112, height);
    const carrying = person === scene.from && elapsed >= 1300 && elapsed < 6600
      || person === scene.to && elapsed >= 7400 && elapsed < 10700;
    if (carrying) drawFile(ctx, 16, -65 - bob, selected ? "#456447" : "#a06e3c");
    ctx.restore();
  }
  if (elapsed >= 6600 && elapsed < 7400) {
    const progress = clamp((elapsed - 6600) / 800);
    ctx.save();
    ctx.translate((sender.point[0] + (receiver.point[0] - sender.point[0]) * progress) * WIDTH / 100,
      sender.point[1] * HEIGHT / 100 - 70 - Math.sin(progress * Math.PI) * 15);
    ctx.rotate((progress - .5) * .2);
    drawFile(ctx, 0, 0, "#456447");
    ctx.restore();
  }
  if (exchanging && elapsed >= 7400) {
    ctx.save();
    ctx.translate((sender.point[0] + receiver.point[0]) / 2 * WIDTH / 100, sender.point[1] * HEIGHT / 100 - 128);
    ctx.strokeStyle = "#fff7d9"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-1, 6); ctx.lineTo(10, -7); ctx.stroke();
    ctx.restore();
  }
  return { sender, receiver, beat, progress: Math.min(1, elapsed / DEMO_DURATION) };
}

function drawFile(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = "#fff6dc"; ctx.strokeStyle = "#8b6c43"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(x - 13, y - 17, 26, 34, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - 8, y - 10, 16, 4);
  ctx.fillRect(x - 8, y - 1, 16, 2);
  ctx.fillRect(x - 8, y + 6, 11, 2);
}
