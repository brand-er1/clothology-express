/**
 * 이미지 URL 을 파일로 저장한다. 다른 도메인(Storage 공개 URL 등)이라 a[download] 가 무시되는 경우를 위해
 * blob 으로 받아 저장하고, 그마저 막히면(CORS) 새 탭으로 원본을 연다.
 */
export async function downloadImage(url: string, filename: string): Promise<"downloaded" | "opened"> {
  const save = (href: string, name: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (url.startsWith("data:")) {
    save(url, filename);
    return "downloaded";
  }
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : null;
    const name = extension ? filename.replace(/\.[a-z0-9]+$/i, "") + `.${extension}` : filename;
    const objectUrl = URL.createObjectURL(blob);
    save(objectUrl, name);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return "downloaded";
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  }
}
