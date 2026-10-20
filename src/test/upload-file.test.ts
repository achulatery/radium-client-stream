import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFile } from "../lib/upload-file";
import { beginUpload, finishUpload, getUploadChunk, removeUpload } from "../lib/uploads.functions";

vi.mock("../lib/uploads.functions", () => ({
  beginUpload: vi.fn(), finishUpload: vi.fn(), getUploadChunk: vi.fn(), removeUpload: vi.fn(),
}));

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("upload file flow", () => {
  it("uploads a chunk and returns the confirmed file", async () => {
    vi.mocked(beginUpload).mockResolvedValue({ id: "upload-id", chunks: 1 });
    vi.mocked(getUploadChunk).mockResolvedValue({ url: "https://files.example/upload" });
    const saved = { id: "upload-id", name: "photo.png", mime: "image/png", size: 3 };
    vi.mocked(finishUpload).mockResolvedValue(saved);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const progress = vi.fn();
    const file = new File(["abc"], "photo.png", { type: "image/png" });
    expect(await uploadFile(file, "kleb", undefined, progress)).toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith("https://files.example/upload", expect.objectContaining({ method: "PUT" }));
    expect(progress).toHaveBeenCalledWith(100);
    expect(removeUpload).not.toHaveBeenCalled();
  });

  it("cleans up a failed upload without confirming it", async () => {
    vi.mocked(beginUpload).mockResolvedValue({ id: "upload-id", chunks: 1 });
    vi.mocked(getUploadChunk).mockResolvedValue({ url: "https://files.example/upload" });
    vi.mocked(removeUpload).mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(uploadFile(new File(["abc"], "photo.png"), "kleb", undefined, vi.fn())).rejects.toThrow("Upload failed");
    expect(removeUpload).toHaveBeenCalledWith({ data: { id: "upload-id" } });
    expect(finishUpload).not.toHaveBeenCalled();
  });
});