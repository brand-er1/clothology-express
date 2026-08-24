import { useCallback, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { useMascotPageContext } from "@/components/guide/MascotContext";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { GarmentCanvas } from "@/components/ready-made/editor/GarmentCanvas";
import { EditorNav, EDITOR_PANELS, type EditorPanelKey } from "@/components/ready-made/editor/EditorNav";
import { EditorSummaryBar } from "@/components/ready-made/editor/EditorSummaryBar";
import { ProductPanel } from "@/components/ready-made/editor/ProductPanel";
import { ColorPanel } from "@/components/ready-made/editor/ColorPanel";
import { DesignPanel } from "@/components/ready-made/editor/DesignPanel";
import { PrintPanel } from "@/components/ready-made/editor/PrintPanel";
import { QuantityPanel } from "@/components/ready-made/editor/QuantityPanel";
import { QuotePanel } from "@/components/ready-made/editor/QuotePanel";
import { useReadyMadeGroupWearForm } from "@/hooks/useReadyMadeGroupWearForm";
import { captureReadyMadeDesignPreviews } from "@/lib/ready-made-design-capture";
import type { ReadyMadeGarmentSide } from "@/data/ready-made-pricing-config";

const PANEL_COMPONENTS: Record<EditorPanelKey, typeof ProductPanel> = {
  product: ProductPanel,
  color: ColorPanel,
  design: DesignPanel,
  print: PrintPanel,
  quantity: QuantityPanel,
  quote: QuotePanel,
};

const QuickGroupWear = () => {
  const form = useReadyMadeGroupWearForm();
  const [activePanel, setActivePanel] = useState<EditorPanelKey>("product");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [side, setSide] = useState<ReadyMadeGarmentSide>("front");

  // Only one of these is actually laid out at a time (the other is `display:none` under the
  // responsive breakpoint) — capture always targets whichever one currently has a real size.
  const desktopStageRef = useRef<HTMLDivElement>(null);
  const mobileStageRef = useRef<HTMLDivElement>(null);
  const [isCapturingDesign, setIsCapturingDesign] = useState(false);

  useMascotPageContext({ page: "quick-group-wear", hasEstimate: Boolean(form.quote) });

  const ActivePanelComponent = PANEL_COMPONENTS[activePanel];
  const activePanelLabel = EDITOR_PANELS.find((panel) => panel.key === activePanel)?.label ?? "";

  const getVisibleStageNode = useCallback(() => {
    const desktop = desktopStageRef.current;
    if (desktop && desktop.clientWidth > 0 && desktop.clientHeight > 0) return desktop;
    const mobile = mobileStageRef.current;
    if (mobile && mobile.clientWidth > 0 && mobile.clientHeight > 0) return mobile;
    return null;
  }, []);

  // Wraps the hook's submitRequest so the exact editor canvas the customer just used is
  // captured as the order's WYSIWYG final-design preview right before submission — never
  // recomputed from stored percentages, which is what keeps mobile/desktop submissions landing
  // in the same spot on the admin side. A capture failure never blocks the actual submission;
  // it just means that order goes out with no preview image, same as before this feature existed.
  const handleSubmit = useCallback(async () => {
    setIsCapturingDesign(true);
    try {
      let previews: Awaited<ReturnType<typeof captureReadyMadeDesignPreviews>> = [];
      try {
        previews = await captureReadyMadeDesignPreviews({
          printJobs: form.printJobs,
          currentSide: side,
          setSide,
          getStageNode: getVisibleStageNode,
        });
      } catch (error) {
        console.error("Failed to capture ready-made design preview:", error);
      }
      await form.submitRequest(previews);
    } finally {
      setIsCapturingDesign(false);
    }
  }, [form, side, getVisibleStageNode]);

  const formForPanels = {
    ...form,
    submitRequest: handleSubmit,
    isSubmitting: form.isSubmitting || isCapturingDesign,
  };

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />

      <main className="mx-auto max-w-[1440px] pb-10 pt-20 lg:pb-8 lg:pt-24">
        <div className="px-4 pb-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Brand-er design editor</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-3xl">
            단체복 직접 디자인하기
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            옷을 고르고 색상을 바꾸고, 로고를 직접 옮기고 크기를 조절하면서 실시간으로 견적을 확인하세요.
          </p>
        </div>

        {/* Desktop / tablet: 3-column editor */}
        <div className="hidden overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-sm lg:mx-4 lg:flex lg:h-[calc(100vh-220px)] lg:min-h-[640px] xl:mx-8">
          <EditorNav active={activePanel} onSelect={setActivePanel} orientation="vertical" />

          <div className="w-80 shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-5">
            <ActivePanelComponent form={formForPanels} />
          </div>

          <div className="flex flex-1 items-center justify-center bg-[#faf9f7] p-6">
            <div className="w-full max-w-xl">
              <GarmentCanvas
                product={form.selectedProduct}
                color={form.selectedColor}
                side={side}
                onSideChange={setSide}
                designPreviewUrl={form.designPreviewUrl}
                printJobs={form.printJobs}
                onPlacementChange={form.setPrintJobPlacement}
                onDuplicateJob={form.duplicatePrintJob}
                onDeleteJob={form.removePrintJob}
                captureMode={isCapturingDesign}
                stageRef={desktopStageRef}
              />
            </div>
          </div>

          <div className="w-72 shrink-0 overflow-y-auto border-l border-stone-200 bg-white p-5">
            <EditorSummaryBar form={form} layout="column" />
          </div>
        </div>

        {/* Mobile: the editor menu stays directly below the header so it is easy to reach and
            never collides with the browser's bottom controls. Each item opens its panel in a drawer. */}
        <div className="lg:hidden">
          <div
            data-testid="mobile-nav"
            className="sticky top-16 z-40 bg-[#f4f0ea]/95 px-4 py-2 backdrop-blur-md sm:top-[72px] sm:px-6"
          >
            <EditorNav
              active={activePanel}
              orientation="horizontal"
              onSelect={(panel) => {
                setActivePanel(panel);
                setMobileSheetOpen(true);
              }}
            />
          </div>

          <div className="px-4 pt-1 sm:px-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-3">
              <GarmentCanvas
                product={form.selectedProduct}
                color={form.selectedColor}
                side={side}
                onSideChange={setSide}
                designPreviewUrl={form.designPreviewUrl}
                printJobs={form.printJobs}
                onPlacementChange={form.setPrintJobPlacement}
                onDuplicateJob={form.duplicatePrintJob}
                onDeleteJob={form.removePrintJob}
                captureMode={isCapturingDesign}
                stageRef={mobileStageRef}
              />
            </div>

            <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3.5">
              <EditorSummaryBar form={form} layout="row" />
            </div>
          </div>

          <Drawer open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <DrawerContent className="max-h-[85svh] pb-[env(safe-area-inset-bottom)]">
              <DrawerHeader className="pb-0">
                <DrawerTitle>{activePanelLabel}</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto p-4 pt-2">
                <ActivePanelComponent form={formForPanels} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </main>
    </div>
  );
};

export default QuickGroupWear;
