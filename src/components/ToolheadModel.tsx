import { useMemo } from "react";
import { Path, Shape } from "three";

const face = [
  [-25, 30], [-25, 51], [-17, 62], [17, 62], [25, 51], [25, 30],
  [18, 20], [9, 13], [6, 25], [-6, 25], [-9, 13], [-18, 20],
];
const extrude = { depth: 7, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1.2, bevelThickness: 1 };

export function ToolheadModel({ hot }: { hot: boolean }) {
  const housing = useMemo(() => {
    const shape = new Shape();
    face.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
    shape.closePath();
    const fanOpening = new Path();
    fanOpening.absarc(0, 43, 14.6, 0, Math.PI * 2);
    shape.holes.push(fanOpening);
    return shape;
  }, []);

  return (
    <group name="Stealthburner-style toolhead">
      {/* The nozzle tip is the toolpath origin. */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[3.3, .7, 8, 6]} />
        <meshStandardMaterial color={hot ? "#f3b775" : "#b89964"} metalness={.72} roughness={.32}
          emissive={hot ? "#ad4a19" : "#000000"} emissiveIntensity={hot ? .25 : 0} />
      </mesh>
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[14, 8, 13]} />
        <meshStandardMaterial color="#313139" roughness={.8} />
      </mesh>
      <mesh position={[0, 45, -5]}>
        <boxGeometry args={[40, 36, 23]} />
        <meshStandardMaterial color="#20232c" roughness={.74} />
      </mesh>
      <mesh position={[0, 0, 8]}>
        <extrudeGeometry args={[housing, extrude]} />
        <meshStandardMaterial color="#465061" roughness={.55} />
      </mesh>
      <group position={[0, 43, 15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[14.5, 14.5, 5, 40]} />
          <meshStandardMaterial color="#10141e" roughness={.84} />
        </mesh>
        <mesh position-z={2.8}>
          <torusGeometry args={[13.3, 1.2, 8, 40]} />
          <meshStandardMaterial color="#596273" metalness={.35} roughness={.48} />
        </mesh>
        {Array.from({ length: 7 }, (_, index) => (
          <group key={index} rotation-z={index * Math.PI * 2 / 7}>
            <mesh position={[1.8, 7.9, 2.7]} rotation-z={-.48}>
              <boxGeometry args={[3.2, 8.4, .8]} />
              <meshStandardMaterial color="#383e4c" roughness={.64} />
            </mesh>
          </group>
        ))}
        <mesh position-z={3.35} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[4.5, 4.5, 1.6, 20]} />
          <meshStandardMaterial color="#252c37" roughness={.55} />
        </mesh>
      </group>
      {[-1, 1].map(side => (
        <group key={side}>
          <mesh position={[side * 16, 24, 11.5]} rotation-z={side * .52}>
            <boxGeometry args={[8.5, 22, 10]} />
            <meshStandardMaterial color="#cc3442" roughness={.46} />
          </mesh>
          <mesh position={[side * 9.5, 15, 14.2]} rotation-z={side * .45}>
            <boxGeometry args={[4.6, 3, 6]} />
            <meshStandardMaterial color="#e6eef0" emissive="#9ee4ff" emissiveIntensity={.65} />
          </mesh>
          <mesh position={[side * 19, 51, 15.8]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.55, 1.55, 1.1, 10]} />
            <meshStandardMaterial color="#aeb6c6" metalness={.73} roughness={.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 24, 16]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[5.4, 5.4, 1.7]} />
        <meshStandardMaterial color="#ff5a62" emissive="#c62234" emissiveIntensity={.75} />
      </mesh>
    </group>
  );
}
