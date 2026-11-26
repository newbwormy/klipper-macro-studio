import type { PrinterProfile, Vec3 } from "./types";

type Point = Pick<Vec3, "x" | "y">;
type Settings = Record<string, Record<string, unknown>>;

function readPoint(value: unknown): Point | undefined {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
  if (parts.length !== 2 || parts.some((part) => String(part).trim() === "")) return;
  const [x, y] = parts.map(Number);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
}

export function buildProbePath(
  command: string,
  parameters: Record<string, string>,
  profile: PrinterProfile,
  position: Vec3,
  settings: Settings
): Vec3[] {
  const { axisMin: min, axisMax: max } = profile;
  const clamp = (value: number, axis: keyof Vec3) => Math.max(min[axis], Math.min(max[axis], value));
  const point = (x: number, y: number, z: number): Vec3 => ({
    x: clamp(x, "x"), y: clamp(y, "y"), z: clamp(z, "z"),
  });
  const section = settings[command === "BED_MESH_CALIBRATE" ? "bed_mesh"
    : command === "Z_TILT_ADJUST" ? "z_tilt" : command.toLowerCase()];
  const low = { x: min.x + (max.x - min.x) * 0.15, y: min.y + (max.y - min.y) * 0.15 };
  const high = { x: max.x - (max.x - min.x) * 0.15, y: max.y - (max.y - min.y) * 0.15 };
  const floor = Math.max(0, min.z);
  const clearance = Number(parameters.HORIZONTAL_MOVE_Z ?? section?.horizontal_move_z ?? 5);
  const travelZ = clamp(Number.isFinite(clearance) ? Math.max(floor + 1, clearance) : floor + 5, "z");
  const method = parameters.METHOD?.toLowerCase();
  const scanMesh = command === "BED_MESH_CALIBRATE" &&
    (method === "scan" || method === "rapid_scan" || (!method && Boolean(settings.cartographer)));
  const probeZ = clamp(floor + (scanMesh || command.includes("_SCAN_") ? 1 : 0), "z");
  let points: Point[] = [position];

  if (command === "BED_MESH_CALIBRATE") {
    const start = readPoint(parameters.MESH_MIN ?? section?.mesh_min) ?? low;
    const end = readPoint(parameters.MESH_MAX ?? section?.mesh_max) ?? high;
    const count = parameters.PROBE_COUNT ?? section?.probe_count;
    const sizes = readPoint(count) ??
      (Number.isFinite(Number(count)) && Number(count) >= 2 ? { x: Number(count), y: Number(count) } : { x: 3, y: 3 });
    const columns = Math.max(2, Math.min(15, Math.trunc(sizes.x)));
    const rows = Math.max(2, Math.min(15, Math.trunc(sizes.y)));
    points = Array.from({ length: rows * columns }, (_, i) => {
      const row = Math.floor(i / columns);
      const col = row % 2 === 0 ? i % columns : columns - 1 - i % columns;
      return {
        x: start.x + (end.x - start.x) * col / (columns - 1),
        y: start.y + (end.y - start.y) * row / (rows - 1),
      };
    });
  } else if (command === "Z_TILT_ADJUST" || command === "QUAD_GANTRY_LEVEL") {
    const configured = section?.points;
    const rows = Array.isArray(configured) ? configured : String(configured ?? "").split("\n");
    const parsed = rows.map(readPoint).filter((value): value is Point => value !== undefined);
    points = parsed.length ? parsed : [
      low, { x: low.x, y: high.y }, high, { x: high.x, y: low.y },
    ];
  }

  const path = [point(position.x, position.y, Math.max(position.z, travelZ))];
  if (scanMesh) {
    const first = points[0];
    const last = points[points.length - 1];
    return [...path, point(first.x, first.y, travelZ),
      ...points.map(({ x, y }) => point(x, y, probeZ)), point(last.x, last.y, travelZ)];
  }
  const requested = Number(parameters.SAMPLES);
  const samples = Number.isFinite(requested) && requested > 0
    ? Math.max(1, Math.min(20, Math.trunc(requested))) : command.endsWith("_ACCURACY") ? 3 : 1;
  for (const { x, y } of points) {
    path.push(point(x, y, travelZ));
    for (let i = 0; i < samples; i++) {
      path.push(point(x, y, probeZ), point(x, y, travelZ));
    }
  }
  return path;
}
