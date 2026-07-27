import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  Bounds,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  RoundedBox,
  useGLTF,
} from "@react-three/drei";
import {
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { Box, ImagePlus, Move3D, RotateCcw, Scan, ZoomIn } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

type PrintArea = "front" | "back" | "leftSleeve" | "rightSleeve";

interface Garment3DStudioProps {
  selectedType: string;
  designImageUrl: string | null;
  initialColor?: string;
}

const MODEL_BY_TYPE: Record<string, string> = {
  short_sleeve: "/models/tshirt.glb",
  long_sleeve: "/models/long-sleeve.glb",
  hoodie: "/models/hoodie.glb",
  sweatshirt: "/models/sweatshirt.glb",
  jacket: "/models/jacket.glb",
  short_pants: "/models/shorts.glb",
  long_pants: "/models/pants.glb",
};

const COLOR_BY_NAME: Record<string, string> = {
  black: "#171717",
  white: "#f4f2ed",
  navy: "#172238",
  gray: "#767676",
};

const GARMENT_LABELS: Record<string, string> = {
  short_sleeve: "반팔 티셔츠",
  long_sleeve: "긴소매 티셔츠",
  hoodie: "후드티",
  sweatshirt: "맨투맨",
  jacket: "자켓",
  short_pants: "반바지",
  long_pants: "긴바지",
};

function LoadingGarment() {
  return (
    <Html center>
      <div className="flex w-44 flex-col items-center rounded-2xl bg-white/90 p-4 text-center shadow-xl backdrop-blur">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-stone-200 border-t-brand" />
        <span className="mt-3 text-xs font-bold text-stone-700">3D 의류 준비 중</span>
      </div>
    </Html>
  );
}

function GLBGarment({
  url,
  textureUrl,
  color,
  roughness,
  autoRotate,
}: {
  url: string;
  textureUrl: string | null;
  color: string;
  roughness: number;
  autoRotate: boolean;
}) {
  const { scene } = useGLTF(url);
  const group = useRef<Group>(null);
  const texture = useLoader(
    TextureLoader,
    textureUrl || "/placeholder.svg",
  );

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = false;
    texture.minFilter = LinearFilter;
    cloned.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = new MeshStandardMaterial({
        color: new Color(color),
        map: textureUrl ? texture : null,
        roughness,
        metalness: 0.02,
        side: DoubleSide,
      });
    });
    return cloned;
  }, [scene, texture, textureUrl, color, roughness]);

  useFrame((_, delta) => {
    if (autoRotate && group.current) group.current.rotation.y += delta * 0.28;
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

function FallbackGarment({
  type,
  color,
  roughness,
  textureUrl,
  scale,
  offsetX,
  offsetY,
  autoRotate,
}: {
  type: string;
  color: string;
  roughness: number;
  textureUrl: string | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  autoRotate: boolean;
}) {
  const group = useRef<Group>(null);
  const texture = useLoader(TextureLoader, textureUrl || "/placeholder.svg");
  texture.colorSpace = SRGBColorSpace;

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.01,
      }),
    [color, roughness],
  );
  const printMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: textureUrl ? texture : null,
        color: textureUrl ? "#ffffff" : color,
        roughness,
        transparent: true,
      }),
    [texture, textureUrl, color, roughness],
  );
  const isBottom = type === "long_pants" || type === "short_pants";
  const longSleeve = ["long_sleeve", "hoodie", "sweatshirt", "jacket"].includes(type);

  useFrame((_, delta) => {
    if (autoRotate && group.current) group.current.rotation.y += delta * 0.28;
  });

  if (isBottom) {
    const legHeight = type === "short_pants" ? 1.25 : 3.25;
    return (
      <group ref={group} position={[0, 0.3, 0]}>
        <RoundedBox args={[2.5, 1.1, 0.62]} radius={0.18} smoothness={4} material={material} />
        <RoundedBox args={[1.13, legHeight, 0.58]} radius={0.18} smoothness={4} position={[-0.65, -legHeight / 2, 0]} material={material} />
        <RoundedBox args={[1.13, legHeight, 0.58]} radius={0.18} smoothness={4} position={[0.65, -legHeight / 2, 0]} material={material} />
        <mesh position={[offsetX, -0.15 + offsetY, 0.326]} scale={scale}>
          <planeGeometry args={[1.6, 0.78]} />
          <primitive object={printMaterial} attach="material" />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={group} position={[0, -0.1, 0]}>
      <RoundedBox args={[3.05, 3.65, 0.68]} radius={0.25} smoothness={5} material={material} />
      <RoundedBox
        args={[longSleeve ? 0.82 : 1.2, longSleeve ? 3.35 : 1.5, 0.62]}
        radius={0.2}
        smoothness={4}
        rotation={[0, 0, longSleeve ? -0.18 : -0.72]}
        position={[-1.85, longSleeve ? -0.25 : 0.85, 0]}
        material={material}
      />
      <RoundedBox
        args={[longSleeve ? 0.82 : 1.2, longSleeve ? 3.35 : 1.5, 0.62]}
        radius={0.2}
        smoothness={4}
        rotation={[0, 0, longSleeve ? 0.18 : 0.72]}
        position={[1.85, longSleeve ? -0.25 : 0.85, 0]}
        material={material}
      />
      {type === "hoodie" && (
        <mesh position={[0, 2.12, -0.05]} material={material}>
          <torusGeometry args={[0.95, 0.42, 18, 48, Math.PI]} />
        </mesh>
      )}
      <mesh position={[offsetX, offsetY, 0.352]} scale={scale}>
        <planeGeometry args={[2.28, 2.45]} />
        <primitive object={printMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function Scene({
  selectedType,
  modelUrl,
  modelAvailable,
  textureUrl,
  color,
  roughness,
  scale,
  offsetX,
  offsetY,
  autoRotate,
}: {
  selectedType: string;
  modelUrl: string;
  modelAvailable: boolean;
  textureUrl: string | null;
  color: string;
  roughness: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  autoRotate: boolean;
}) {
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} />
      <Suspense fallback={<LoadingGarment />}>
        <Bounds fit clip observe margin={1.22}>
          {modelAvailable ? (
            <GLBGarment
              url={modelUrl}
              textureUrl={textureUrl}
              color={color}
              roughness={roughness}
              autoRotate={autoRotate}
            />
          ) : (
            <FallbackGarment
              type={selectedType}
              color={color}
              roughness={roughness}
              textureUrl={textureUrl}
              scale={scale}
              offsetX={offsetX}
              offsetY={offsetY}
              autoRotate={autoRotate}
            />
          )}
        </Bounds>
      </Suspense>
      <ContactShadows position={[0, -3.5, 0]} opacity={0.32} scale={12} blur={2.6} />
      <Environment preset="studio" />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={11}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI * 0.72}
      />
    </>
  );
}

export const Garment3DStudio = ({
  selectedType,
  designImageUrl,
  initialColor = "white",
}: Garment3DStudioProps) => {
  const [garmentColor, setGarmentColor] = useState(
    COLOR_BY_NAME[initialColor] || initialColor || "#f4f2ed",
  );
  const [printArea, setPrintArea] = useState<PrintArea>("front");
  const [printScale, setPrintScale] = useState(0.72);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [roughness, setRoughness] = useState(0.82);
  const [autoRotate, setAutoRotate] = useState(true);
  const [modelAvailable, setModelAvailable] = useState(false);
  const modelUrl = MODEL_BY_TYPE[selectedType] || MODEL_BY_TYPE.short_sleeve;

  useEffect(() => {
    let active = true;
    fetch(modelUrl, { method: "HEAD" })
      .then((response) => active && setModelAvailable(response.ok))
      .catch(() => active && setModelAvailable(false));
    return () => {
      active = false;
    };
  }, [modelUrl]);

  useEffect(() => {
    const next = COLOR_BY_NAME[initialColor] || initialColor;
    if (next) setGarmentColor(next);
  }, [initialColor]);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#141311] shadow-[0_28px_80px_rgba(25,20,17,0.16)]">
      <div className="grid min-h-[680px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-[520px] overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#45423d_0%,#22211f_42%,#11110f_100%)]">
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white/80 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live 3D Preview
          </div>
          <div className="absolute right-5 top-5 z-10 rounded-full border border-white/15 bg-black/25 px-3 py-2 text-[11px] font-semibold text-white/70 backdrop-blur">
            {modelAvailable ? "GLB · UV texture" : "GLB 준비용 기본 모델"}
          </div>
          <Canvas shadows camera={{ position: [0, 0.3, 7.6], fov: 38 }} dpr={[1, 1.75]}>
            <Scene
              selectedType={selectedType}
              modelUrl={modelUrl}
              modelAvailable={modelAvailable}
              textureUrl={designImageUrl}
              color={garmentColor}
              roughness={roughness}
              scale={printScale}
              offsetX={offsetX}
              offsetY={offsetY}
              autoRotate={autoRotate}
            />
          </Canvas>
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center">
            <div className="flex items-center gap-4 rounded-full border border-white/15 bg-black/30 px-5 py-2.5 text-[11px] font-semibold text-white/75 backdrop-blur">
              <span className="flex items-center gap-1.5"><Move3D className="h-3.5 w-3.5" /> 드래그 회전</span>
              <span className="flex items-center gap-1.5"><ZoomIn className="h-3.5 w-3.5" /> 스크롤 확대</span>
              <span className="hidden items-center gap-1.5 sm:flex"><Scan className="h-3.5 w-3.5" /> 터치 지원</span>
            </div>
          </div>
        </div>

        <aside className="flex flex-col bg-[#fbfaf8] p-6">
          <div className="border-b border-stone-200 pb-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand">Design controls</p>
            <h3 className="mt-2 text-xl font-bold tracking-[-0.03em] text-stone-950">
              {GARMENT_LABELS[selectedType] || "의류"} 디자인
            </h3>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              변경 내용이 UV 텍스처 미리보기에 실시간 반영됩니다.
            </p>
          </div>

          <div className="flex-1 space-y-6 py-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800">의류 컬러</label>
                <span className="font-mono text-[10px] uppercase text-stone-400">{garmentColor}</span>
              </div>
              <div className="flex gap-2">
                {["#f4f2ed", "#171717", "#172238", "#6f1d26", "#77736b"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`의류 색상 ${color}`}
                    onClick={() => setGarmentColor(color)}
                    className={`h-9 flex-1 rounded-xl border-2 transition-transform hover:scale-105 ${
                      garmentColor === color ? "border-brand ring-2 ring-brand/15" : "border-white"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={garmentColor}
                  onChange={(event) => setGarmentColor(event.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-xl border border-stone-200 bg-white p-1"
                  aria-label="직접 색상 선택"
                />
              </div>
            </div>

            <div>
              <label className="mb-3 block text-xs font-bold text-stone-800">프린팅 영역</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["front", "앞판"],
                  ["back", "뒷판"],
                  ["leftSleeve", "왼쪽 소매"],
                  ["rightSleeve", "오른쪽 소매"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPrintArea(value)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                      printArea === value
                        ? "border-brand bg-brand text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-brand/35"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <ControlSlider label="프린팅 크기" value={printScale * 100} min={10} max={135} onChange={(value) => setPrintScale(value / 100)} />
              <ControlSlider label="가로 위치" value={offsetX * 100} min={-100} max={100} onChange={(value) => setOffsetX(value / 100)} />
              <ControlSlider label="세로 위치" value={offsetY * 100} min={-120} max={120} onChange={(value) => setOffsetY(value / 100)} />
              <ControlSlider label="소재 질감" value={roughness * 100} min={25} max={100} onChange={(value) => setRoughness(value / 100)} suffix="%" />
            </div>

            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-brand">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">AI 디자인 텍스처</p>
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    {designImageUrl ? "생성 이미지가 연결되었습니다." : "디자인 생성 후 자동 연결됩니다."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-stone-300 bg-white text-xs font-bold"
            onClick={() => setAutoRotate((value) => !value)}
          >
            {autoRotate ? <Box className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {autoRotate ? "자동 회전 멈추기" : "자동 회전 시작"}
          </Button>
        </aside>
      </div>
    </div>
  );
};

function ControlSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-bold text-stone-700">{label}</label>
        <span className="text-[10px] font-semibold tabular-nums text-stone-400">
          {Math.round(value)}{suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([next]) => onChange(next)} />
    </div>
  );
}
