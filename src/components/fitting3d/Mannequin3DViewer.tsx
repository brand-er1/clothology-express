import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, ContactShadows, useProgress } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import type { WebGLRenderer } from "three";
import { RotateCcw } from "lucide-react";
import { ProceduralMannequin } from "@/components/fitting3d/ProceduralMannequin";
import { computeBodyMetrics, getFocusHeight } from "@/components/fitting3d/body-metrics";
import { ThreeErrorBoundary } from "@/components/fitting3d/ThreeErrorBoundary";
import type { CharacterGender, ClosetOutfit, MannequinSize } from "@/types/closet";

interface Mannequin3DViewerProps {
  gender: CharacterGender;
  mannequinSize: MannequinSize;
  outfit: ClosetOutfit;
  className?: string;
}

export interface Mannequin3DViewerHandle {
  /** A real capture of the current 3D canvas (whatever angle/zoom the visitor left it at) as a PNG
   * data URL — used as the "3D mannequin preview/screenshot" attached to 제작의뢰/펀딩 (spec §14/§15).
   * Returns null before the canvas has rendered a frame. */
  captureScreenshot: () => string | null;
}

type CameraView = "front" | "side" | "back";

const PRESET_POLAR = 1.32;

const azimuthByView: Record<CameraView, number> = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};

/** In-canvas-only: `useProgress` reads the shared Three.js loading manager, so it must run inside
 * the R3F tree; it reports up to the plain-DOM overlay rendered outside the Canvas. Stays idle
 * (never shown) for today's procedural mannequin, which has nothing to download — it only engages
 * once a real GLB mannequin/garment asset is wired in via `useGLTF` (see final report). */
const ProgressReporter = ({ onProgress }: { onProgress: (active: boolean, percent: number) => void }) => {
  const { active, progress } = useProgress();
  useEffect(() => {
    onProgress(active, progress);
  }, [active, progress, onProgress]);
  return null;
};

/**
 * The interactive 3D mannequin viewer: drag-to-rotate 360°, wheel/pinch-to-zoom, FRONT/SIDE/BACK
 * camera presets, and a reset. Renders the procedural body-morph mannequin (see ProceduralMannequin
 * for why it's primitives-based rather than a GLB) and nothing else — no garment mesh/plane is
 * drawn on top of it (spec §8). Camera distance/angle are clamped so the mannequin can never be
 * zoomed past its own geometry or rotated underground/overhead.
 */
export const Mannequin3DViewer = forwardRef<Mannequin3DViewerHandle, Mannequin3DViewerProps>(
  ({ gender, mannequinSize, outfit, className = "" }, forwardedRef) => {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const glRef = useRef<WebGLRenderer | null>(null);
  const [activeView, setActiveView] = useState<CameraView | null>("front");
  const [loading, setLoading] = useState({ active: false, percent: 0 });
  const [canvasKey, setCanvasKey] = useState(0);

  useImperativeHandle(forwardedRef, () => ({
    captureScreenshot: () => glRef.current?.domElement.toDataURL("image/png") ?? null,
  }));

  const metrics = useMemo(() => computeBodyMetrics(gender, mannequinSize), [gender, mannequinSize]);
  const focusHeight = useMemo(() => getFocusHeight(metrics), [metrics]);
  // Distance derived from the vertical FOV so the full body (head to feet, +25% margin) always
  // fits the frame — never a guessed multiplier that could clip the head or crop the feet.
  const verticalFovRadians = (32 * Math.PI) / 180;
  const defaultDistance = (metrics.totalHeight * 1.25) / 2 / Math.tan(verticalFovRadians / 2);
  const minDistance = defaultDistance * 0.5;
  const maxDistance = defaultDistance * 2.6;

  // CameraControls computes its own initial target from the camera's starting transform, which does
  // NOT respect a plain `camera.lookAt()` called before it mounts — so the very first frame is set
  // explicitly via `setLookAt` from Canvas's `onCreated`, R3F's guaranteed "the scene graph (refs
  // included) is ready" signal. A parent-level `useEffect` fires too early: R3F mounts the canvas's
  // own reconciler tree separately from the surrounding React commit, so `controlsRef.current` can
  // still be null on the outer component's first effect pass.
  const didInitCamera = useRef(false);

  // Gender/size changes reshape the body but should never require the visitor to re-frame the
  // camera themselves — keep whatever azimuth/tilt they had, just refresh the focus height/distance
  // limits for the new proportions.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !didInitCamera.current) return;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    void controls.setTarget(0, focusHeight, 0, true);
  }, [focusHeight, minDistance, maxDistance]);

  const goToView = (view: CameraView) => {
    const controls = controlsRef.current;
    if (!controls) return;
    setActiveView(view);
    void controls.rotateTo(azimuthByView[view], PRESET_POLAR, true);
    void controls.dollyTo(defaultDistance, true);
  };

  const resetCamera = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    setActiveView("front");
    void controls.reset(true);
  };

  const lastTapRef = useRef(0);
  const handlePointerUp = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) resetCamera();
    lastTapRef.current = now;
  };

  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#f4f0ea] to-[#ece5db] ${className}`}>
      <ThreeErrorBoundary key={canvasKey}>
        <div className="h-full w-full touch-none" onPointerUp={handlePointerUp} onDoubleClick={resetCamera}>
          <Canvas
            shadows
            dpr={[1, 1.75]}
            gl={{ antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true }}
            camera={{ fov: 32, near: 0.05, far: 20, position: [0, focusHeight, defaultDistance] }}
            onCreated={({ camera, gl }) => {
              glRef.current = gl;
              camera.lookAt(0, focusHeight, 0);
              if (!didInitCamera.current && controlsRef.current) {
                didInitCamera.current = true;
                void controlsRef.current.setLookAt(0, focusHeight, defaultDistance, 0, focusHeight, 0, false);
              }
              gl.domElement.addEventListener(
                "webglcontextlost",
                (event) => {
                  event.preventDefault();
                  setCanvasKey((key) => key + 1);
                },
                { once: true },
              );
            }}
          >
            <ambientLight intensity={0.75} />
            <directionalLight position={[2.2, 4, 2.5]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-2.5, 2, -2]} intensity={0.35} />
            <Suspense fallback={null}>
              <ProgressReporter onProgress={(active, percent) => setLoading({ active, percent })} />
              <ProceduralMannequin gender={gender} mannequinSize={mannequinSize} outfit={outfit} showLabels />
              <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={2.2} blur={2.4} far={1.2} />
            </Suspense>
            <CameraControls
              ref={controlsRef}
              minDistance={minDistance}
              maxDistance={maxDistance}
              minPolarAngle={0.35}
              maxPolarAngle={2.55}
              dollySpeed={0.45}
              smoothTime={0.22}
              // Rotate + zoom only — no panning/truck in any input mode, so the mannequin can never
              // be dragged off-center or out of frame (spec §4's camera-containment requirement).
              mouseButtons={{
                left: CameraControlsImpl.ACTION.ROTATE,
                middle: CameraControlsImpl.ACTION.DOLLY,
                right: CameraControlsImpl.ACTION.NONE,
                wheel: CameraControlsImpl.ACTION.DOLLY,
              }}
              touches={{
                one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
                two: CameraControlsImpl.ACTION.TOUCH_DOLLY,
                three: CameraControlsImpl.ACTION.NONE,
              }}
              onStart={() => setActiveView(null)}
            />
          </Canvas>
        </div>
      </ThreeErrorBoundary>

      {loading.active && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#f4f0ea]/90 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
          <p className="text-sm font-bold text-stone-700">가상 마네킹을 준비하고 있습니다...</p>
          <p className="text-xs text-stone-500">{Math.round(loading.percent)}%</p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-3 flex flex-wrap items-center justify-center gap-1.5 px-3">
        {(["front", "side", "back"] as CameraView[]).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => goToView(view)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm transition ${
              activeView === view ? "bg-stone-900 text-white" : "bg-white/90 text-stone-600 hover:bg-white"
            }`}
          >
            {view === "front" ? "FRONT" : view === "side" ? "SIDE" : "BACK"}
          </button>
        ))}
        <button
          type="button"
          onClick={resetCamera}
          className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-stone-600 shadow-sm transition hover:bg-white"
        >
          <RotateCcw className="h-3 w-3" />
          초기화
        </button>
      </div>
    </div>
  );
  },
);
Mannequin3DViewer.displayName = "Mannequin3DViewer";
