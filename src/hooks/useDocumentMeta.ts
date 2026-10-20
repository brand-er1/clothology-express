import { useEffect } from "react";

type DocumentMeta = {
  title: string;
  description?: string;
  image?: string | null;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
};

const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const previous = element?.getAttribute("content") ?? null;
  const created = !element;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
  return () => {
    if (created) element?.remove();
    else if (previous !== null) element?.setAttribute("content", previous);
  };
};

const upsertCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const previous = element?.getAttribute("href") ?? null;
  const created = !element;
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
  return () => {
    if (created) element?.remove();
    else if (previous !== null) element?.setAttribute("href", previous);
  };
};

/**
 * 페이지별 title · description · Open Graph · Twitter 카드 메타를 설정하고, 페이지를 떠나면 원래 값으로 되돌린다.
 * (빌드 시 생성되는 정적 기사 페이지에는 같은 메타가 HTML 에 미리 들어가 있어 JS 를 실행하지 않는 크롤러도 읽을 수 있다.)
 */
export function useDocumentMeta(meta: DocumentMeta | null) {
  const key = meta ? JSON.stringify(meta) : "";
  useEffect(() => {
    if (!meta) return;
    const previousTitle = document.title;
    document.title = meta.title;
    const restore: (() => void)[] = [];
    const set = (attr: "name" | "property", name: string, value?: string | null) => {
      if (value) restore.push(upsertMeta(attr, name, value));
    };
    set("name", "description", meta.description);
    set("property", "og:title", meta.title);
    set("property", "og:description", meta.description);
    set("property", "og:type", meta.type ?? "website");
    set("property", "og:image", meta.image);
    set("property", "og:url", meta.url);
    set("property", "article:published_time", meta.publishedTime);
    set("name", "twitter:card", meta.image ? "summary_large_image" : "summary");
    set("name", "twitter:title", meta.title);
    set("name", "twitter:description", meta.description);
    set("name", "twitter:image", meta.image);
    if (meta.url) restore.push(upsertCanonical(meta.url));
    return () => {
      document.title = previousTitle;
      restore.reverse().forEach((undo) => undo());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
