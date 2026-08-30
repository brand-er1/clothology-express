import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { computeBodyMetrics } from "@/components/fitting3d/body-metrics";
import { closetSlotLabel } from "@/lib/closet-character-config";
import type { CharacterGender, ClosetOutfit, MannequinSize } from "@/types/closet";

interface ProceduralMannequinProps {
  gender: CharacterGender;
  mannequinSize: MannequinSize;
  outfit: ClosetOutfit;
  showLabels: boolean;
}

const bodyMaterialProps = (color: string) => ({
  color,
  roughness: 0.55,
  metalness: 0.05,
});

/**
 * A code-only, stylized "tailor's dress form" mannequin built from primitive geometry — no GLB/GLTF
 * asset exists for a photoreal rigged human yet (see the final report's asset gap section). Body
 * size differences come entirely from `computeBodyMetrics` (independent per-region dimensions from
 * `body-morph-presets.ts`), never from scaling this whole group. Explicitly NOT a substitute for a
 * real garment mesh — worn items are shown as small reference labels near the relevant body region
 * (see §8/§9 of the spec: no 2D-image-as-fake-3D-clothing here), and full garment visualization
 * happens through the existing AI photoreal fitting pipeline ("AI 피팅으로 자세히 보기").
 */
export const ProceduralMannequin = ({ gender, mannequinSize, outfit, showLabels }: ProceduralMannequinProps) => {
  const metrics = useMemo(() => computeBodyMetrics(gender, mannequinSize), [gender, mannequinSize]);

  const legsHeight = metrics.footHeight + metrics.calfLength + metrics.thighLength;
  const hipCenterY = legsHeight + metrics.hipLength / 2;
  const waistCenterY = hipCenterY + metrics.hipLength / 2 + metrics.waistLength / 2;
  const chestCenterY = waistCenterY + metrics.waistLength / 2 + metrics.chestLength / 2;
  const shoulderY = chestCenterY + metrics.chestLength / 2;
  const neckCenterY = shoulderY + metrics.neckLength / 2;
  const headCenterY = neckCenterY + metrics.neckLength / 2 + metrics.headRadius;

  const skinMaterial = bodyMaterialProps(metrics.skinTone);
  const outfitMaterial = bodyMaterialProps(metrics.outfitTone);

  const armAngle = 0.2;
  const legOffset = metrics.hipHalfWidth * 0.55;

  const labelFor = (slot: keyof typeof metrics.anchors) => {
    const garment = outfit[slot];
    if (!showLabels || !garment) return null;
    return (
      <Html
        position={metrics.anchors[slot]}
        center
        distanceFactor={2.6}
        occlude={false}
        className="pointer-events-none select-none"
      >
        <div className="whitespace-nowrap rounded-full bg-stone-950/85 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
          {closetSlotLabel[slot]} · {garment.label}
        </div>
      </Html>
    );
  };

  const renderLeg = (side: 1 | -1) => (
    <group position={[side * legOffset, 0, 0]}>
      <mesh position={[0, metrics.footHeight + metrics.calfLength / 2, 0]} castShadow>
        <capsuleGeometry args={[metrics.calfRadius, metrics.calfLength, 4, 12]} />
        <meshStandardMaterial {...skinMaterial} />
      </mesh>
      <mesh position={[0, metrics.footHeight + metrics.calfLength + metrics.thighLength / 2, 0]} castShadow>
        <capsuleGeometry args={[metrics.thighRadius, metrics.thighLength, 4, 12]} />
        <meshStandardMaterial {...outfitMaterial} />
      </mesh>
      <mesh position={[0, metrics.footHeight / 2, metrics.footLength * 0.18]} castShadow receiveShadow>
        <boxGeometry args={[metrics.footWidth, metrics.footHeight, metrics.footLength]} />
        <meshStandardMaterial color="#2b2622" roughness={0.7} />
      </mesh>
    </group>
  );

  const renderArm = (side: 1 | -1) => (
    <group
      position={[side * (metrics.shoulderHalfWidth + metrics.upperArmRadius * 0.4), shoulderY - metrics.upperArmRadius * 0.4, 0]}
      rotation={[0, 0, -side * armAngle]}
    >
      <mesh position={[0, -metrics.upperArmLength / 2, 0]} castShadow>
        <capsuleGeometry args={[metrics.upperArmRadius, metrics.upperArmLength, 4, 10]} />
        <meshStandardMaterial {...outfitMaterial} />
      </mesh>
      <mesh position={[0, -(metrics.upperArmLength + metrics.forearmLength / 2), 0]} castShadow>
        <capsuleGeometry args={[metrics.forearmRadius, metrics.forearmLength, 4, 10]} />
        <meshStandardMaterial {...skinMaterial} />
      </mesh>
      <mesh position={[0, -(metrics.upperArmLength + metrics.forearmLength + metrics.handRadius * 0.6), 0]} castShadow>
        <sphereGeometry args={[metrics.handRadius, 12, 12]} />
        <meshStandardMaterial {...skinMaterial} />
      </mesh>
    </group>
  );

  return (
    <group>
      <group position={[0, 0, 0]}>
        {renderLeg(1)}
        {renderLeg(-1)}

        <mesh position={[0, hipCenterY, 0]} castShadow>
          <capsuleGeometry args={[metrics.hipRadius, metrics.hipLength, 4, 14]} />
          <meshStandardMaterial {...outfitMaterial} />
        </mesh>
        {labelFor("bottom")}
        {labelFor("dress")}

        <mesh position={[0, waistCenterY, 0]} castShadow>
          <capsuleGeometry args={[metrics.waistRadius, metrics.waistLength, 4, 14]} />
          <meshStandardMaterial {...skinMaterial} />
        </mesh>

        <mesh position={[0, chestCenterY, 0]} castShadow>
          <capsuleGeometry args={[metrics.chestRadius, metrics.chestLength, 4, 14]} />
          <meshStandardMaterial {...outfitMaterial} />
        </mesh>
        {labelFor("top")}
        {labelFor("outer")}

        <mesh position={[0, neckCenterY, 0]} castShadow>
          <cylinderGeometry args={[metrics.neckRadius, metrics.neckRadius * 1.15, metrics.neckLength, 12]} />
          <meshStandardMaterial {...skinMaterial} />
        </mesh>

        <mesh position={[0, headCenterY, 0]} castShadow>
          <sphereGeometry args={[metrics.headRadius, 20, 20]} />
          <meshStandardMaterial {...skinMaterial} />
        </mesh>
        {labelFor("accessory")}

        {renderArm(1)}
        {renderArm(-1)}
      </group>
    </group>
  );
};
