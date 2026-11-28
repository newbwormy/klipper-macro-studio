export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PrinterFixture {
  id: string;
  name: string;
  min: Vec3;
  max: Vec3;
  color: string;
  kind?: "purge_bucket";
}

export interface PrinterProfile {
  name: string;
  axisMin: Vec3;
  axisMax: Vec3;
  printArea?: { min: Pick<Vec3, "x" | "y">; max: Pick<Vec3, "x" | "y"> };
  homePos: Vec3;
  minExtrudeTemp: number;
  maxVelocity: number;
  fixtures: PrinterFixture[];
}

export interface SimInitialState {
  homedAxes: string;
  position: { x: number; y: number; z: number; e: number };
  bedTemp: number;
  toolTemp: number;
  feedrate: number;
  absolutePos: boolean;
  absoluteExtrude: boolean;
}

export type SegmentType = "travel" | "extrude" | "retract" | "home" | "wait" | "temp" | "info" | "probe";

export interface SimSegment {
  id: number;
  lineNumber: number;
  gcode: string;
  type: SegmentType;
  from: Vec3;
  to: Vec3;
  eDelta: number;
  startTime: number;
  endTime: number;
  bedTemp: number;
  bedTarget: number;
  toolTemp: number;
  toolTarget: number;
  fanSpeed: number;
  message?: string;
}

export interface SimIssue {
  lineNumber: number;
  gcode: string;
  severity: "error" | "warning";
  message: string;
}

export interface SimulationResult {
  segments: SimSegment[];
  issues: SimIssue[];
  totalDuration: number;
}
