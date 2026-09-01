// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ClosetGarment } from "@/types/closet";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/services/closetGarmentEdit", () => ({
  editGarment: vi.fn(async () => ({
    editedImageUrl: "https://example.com/top-edited.png",
    editedImagePath: "closet/top-edited.png",
    textResponse: null,
  })),
}));

vi.mock("@/services/designs", () => ({
  saveDesign: vi.fn(async () => "design-1"),
}));

import { useIsMobile } from "@/hooks/use-mobile";
import { GarmentEditPanel } from "@/components/closet/GarmentEditPanel";

const baseGarment: ClosetGarment = {
  id: "top-123",
  slot: "top",
  label: "내가 만든 후드티",
  imageUrl: "https://example.com/top-original.png",
  source: "ai_design",
  designRef: { selectedType: "hoodie", designId: "design-1" },
};

beforeEach(() => {
  // jsdom stubs Radix Dialog/Drawer commonly reach for.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }
  if (!("ResizeObserver" in window)) {
    // @ts-expect-error test polyfill
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// TEST 4: PC → 상의 생성 → 수정하기 → Expected: 수정 Modal/Page 정상 실행
describe("GarmentEditPanel on desktop (PC)", () => {
  it("opens a real dialog carrying the selected garment's data when 수정하기 is triggered", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);

    render(
      <GarmentEditPanel
        garment={baseGarment}
        open
        onOpenChange={() => {}}
        onApply={() => {}}
        onRestoreRevision={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    // The correct garment's image/category/label must be loaded into the modal, not a blank state.
    expect(screen.getByText("이 옷 수정하기")).toBeTruthy();
    expect(screen.getByText("내가 만든 후드티")).toBeTruthy();
    expect(screen.getByText("상의")).toBeTruthy();
  });

  it("renders nothing when closed and no garment has ever been selected", () => {
    render(
      <GarmentEditPanel
        garment={null}
        open={false}
        onOpenChange={() => {}}
        onApply={() => {}}
        onRestoreRevision={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // TEST 5: PC → 수정 → 저장 → Expected: 수정된 의류로 즉시 반영
  it("updates the SAME garment (same id/slot) with the new image on save, instead of creating a new one", async () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    const onApply = vi.fn();

    render(
      <GarmentEditPanel
        garment={baseGarment}
        open
        onOpenChange={() => {}}
        onApply={onApply}
        onRestoreRevision={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("어떻게 수정할까요?"), {
      target: { value: "색상을 검정으로" },
    });
    fireEvent.click(screen.getByRole("button", { name: /AI로 수정하기/ }));

    await waitFor(() => expect(screen.getByText("이 옷으로 입히기")).toBeTruthy());
    fireEvent.click(screen.getByText("이 옷으로 입히기"));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const updated = onApply.mock.calls[0][0] as ClosetGarment;
    expect(updated.id).toBe("top-123");
    expect(updated.slot).toBe("top");
    expect(updated.imageUrl).toBe("https://example.com/top-edited.png");
  });
});

describe("GarmentEditPanel on mobile", () => {
  it("still opens the bottom-sheet Drawer with the same garment data (no regression)", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <GarmentEditPanel
        garment={baseGarment}
        open
        onOpenChange={() => {}}
        onApply={() => {}}
        onRestoreRevision={() => {}}
      />,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("내가 만든 후드티")).toBeTruthy();
  });
});
