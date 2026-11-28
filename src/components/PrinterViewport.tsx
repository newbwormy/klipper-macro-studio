import React, { useLayoutEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { PrinterProfile, SimSegment, Vec3 } from "../sim/types";

const toThree = (p: Vec3): [number, number, number] => [p.x, p.z, -p.y];

interface SceneProps {
  profile: PrinterProfile;
  segments: SimSegment[];
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  onTimeAdvance: (delta: number) => void;
}

function PrinterScene({
  profile,
  segments,
  currentTime,
  isPlaying,
  speed,
  onTimeAdvance,
}: SceneProps) {
  useFrame((_, delta) => {
    if (isPlaying) onTimeAdvance(delta * speed);
  });

  const activeState = useMemo(() => {
    if (!segments.length) {
      return { pos: profile.homePos, bedTemp: 25, toolTemp: 25 };
    }
    const seg =
      segments.find((s) => currentTime >= s.startTime && currentTime <= s.endTime) ??
      segments[segments.length - 1];

    const span = Math.max(seg.endTime - seg.startTime, 0.0001);
    const t = Math.min(1, Math.max(0, (currentTime - seg.startTime) / span));

    return {
      pos: {
        x: THREE.MathUtils.lerp(seg.from.x, seg.to.x, t),
        y: THREE.MathUtils.lerp(seg.from.y, seg.to.y, t),
        z: THREE.MathUtils.lerp(seg.from.z, seg.to.z, t),
      },
      bedTemp: seg.bedTemp,
      toolTemp: seg.toolTemp,
    };
  }, [segments, currentTime, profile.homePos]);

  const visibleSegments = useMemo(
    () => segments.filter((s) => s.startTime <= currentTime),
    [segments, currentTime]
  );

  const bedW = Math.max(10, profile.axisMax.x - profile.axisMin.x);
  const bedD = Math.max(10, profile.axisMax.y - profile.axisMin.y);
  const bedH = Math.max(10, profile.axisMax.z - profile.axisMin.z);
  const centerX = (profile.axisMin.x + profile.axisMax.x) / 2;
  const centerY = (profile.axisMin.y + profile.axisMax.y) / 2;
  const target = useMemo<[number, number, number]>(() => [centerX, Math.min(bedH * .14, 42), -centerY],
    [centerX, centerY, bedH]);
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const distance = Math.hypot(bedW, bedD) * .64 / (Math.tan(Math.PI / 8) * Math.min(1, Math.max(.1, aspect)));
    const direction = new THREE.Vector3(.94, .83, 1.1).normalize().multiplyScalar(distance);
    camera.position.set(...target).add(direction);
    camera.lookAt(...target);
  }, [camera, size.width, size.height, target, bedW, bedD]);

  const bedHeatRatio = Math.min(1, Math.max(0, (activeState.bedTemp - 30) / 80));
  const bedColor = useMemo(
    () => new THREE.Color("#202d3a").lerp(new THREE.Color("#6e4940"), bedHeatRatio),
    [bedHeatRatio]
  );

  const nozzleHot = activeState.toolTemp >= 150;

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[180, 260, 180]} intensity={1.1} />

      <mesh position={[centerX, -1.5, -centerY]}>
        <boxGeometry args={[bedW, 3, bedD]} />
        <meshStandardMaterial color={bedColor} roughness={0.6} />
      </mesh>

      <Grid
        position={[centerX, 0.05, -centerY]}
        args={[bedW, bedD]}
        cellSize={10}
        sectionSize={50}
        cellColor="#425263"
        sectionColor="#768a9c"
        fadeDistance={800}
      />


      {profile.fixtures.map((f) => {
        const w = Math.max(1, f.max.x - f.min.x);
        const d = Math.max(1, f.max.y - f.min.y);
        const h = Math.max(1, f.max.z - f.min.z);
        return (
          <mesh
            key={f.id}
            position={[(f.min.x + f.max.x) / 2, (f.min.z + f.max.z) / 2, -(f.min.y + f.max.y) / 2]}
          >
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={f.color} transparent opacity={0.55} />
          </mesh>
        );
      })}

      {visibleSegments.map((s) => {
        if (s.type !== "travel" && s.type !== "extrude" && s.type !== "home" && s.type !== "probe") return null;
        const color = s.type === "probe" ? "#c084fc" : s.type === "extrude" ? "#f97316" : s.type === "home" ? "#22c55e" : "#38bdf8";
        return (
          <Line
            key={s.id}
            points={[toThree(s.from), toThree(s.to)]}
            color={color}
            lineWidth={s.type === "extrude" || s.type === "probe" ? 2.5 : 1.2}
            dashed={s.type === "travel"}
            dashSize={3}
            gapSize={2}
          />
        );
      })}

      <group position={toThree(activeState.pos)}>
        <mesh position={[0, 5, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[3.5, 10, 16]} />
          <meshStandardMaterial
            color={nozzleHot ? "#fb923c" : "#cbd5e1"}
            emissive={nozzleHot ? "#ea580c" : "#000000"}
            emissiveIntensity={nozzleHot ? 0.6 : 0}
          />
        </mesh>
        <mesh position={[0, 22, 0]}>
          <boxGeometry args={[28, 24, 28]} />
          <meshStandardMaterial color="#a5d782" metalness={0.2} roughness={0.45} />
        </mesh>
      </group>

      <OrbitControls target={target} makeDefault />
    </>
  );
}

function PreviewUnavailable() {
  return (
    <div className="preview-unavailable" role="status">
      <strong>3D preview unavailable</strong>
      <p>The browser couldn’t start the 3D renderer. You can still edit macros and export a config.</p>
    </div>
  );
}

class PreviewBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <PreviewUnavailable /> : this.props.children;
  }
}

export function PrinterViewport(props: SceneProps) {
  return (
    <div style={{ width: "100%", height: "100%", background: "radial-gradient(ellipse at 50% 58%, #202f3e, #101823 75%)" }}>
      <PreviewBoundary>
        <Canvas camera={{ position: [280, 230, 280], fov: 45, near: 1, far: 3000 }} fallback={<PreviewUnavailable />}>
          <PrinterScene {...props} />
        </Canvas>
      </PreviewBoundary>
    </div>
  );
}
