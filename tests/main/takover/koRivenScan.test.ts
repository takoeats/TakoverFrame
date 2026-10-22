import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ read: vi.fn<(png: Buffer) => Promise<string>>() }));

vi.mock("../../../services/ocrServer", () => ({
  nativeOcrAvailable: true,
  nativeOcrBuffer: (png: Buffer) => hoisted.read(png),
  ocrServer: { runOCRBuffer: () => Promise.reject(new Error("not used")) },
}));

import { recognizeKoreanStatArea } from "../../../services/takover/koRivenScan";

describe("recognizeKoreanStatArea", () => {
  it("reads the stat area as a PNG and returns English lines", async () => {
    hoisted.read.mockResolvedValueOnce("Sobek Plaga-satilis +154.4% 멀티샷 +48% 확대율 증가");
    const result = await recognizeKoreanStatArea(Buffer.alloc(4 * 4 * 2, 255), 4, 2);
    const png = hoisted.read.mock.calls[0][0];
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(result).toEqual({
      text: "Sobek Plaga-satilis\n+154.4% Multishot\n+48% Zoom",
      lines: [
        { text: "Sobek Plaga-satilis", confidence: 1 },
        { text: "+154.4% Multishot", confidence: 1 },
        { text: "+48% Zoom", confidence: 1 },
      ],
      minConfidence: 1,
      yoloBoxCount: 0,
    });
  });

  it("reports no lines for an empty read", async () => {
    hoisted.read.mockResolvedValueOnce("");
    const result = await recognizeKoreanStatArea(Buffer.alloc(4, 0), 1, 1);
    expect(result).toEqual({ text: "", lines: [], minConfidence: -1, yoloBoxCount: 0 });
  });
});
