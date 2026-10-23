import { supabase } from "@/lib/supabase";
import { adminRpc } from "@/services/adminApi";
import {
  magazineArticles as fallbackArticles,
  sortMagazineArticles,
  type MagazineArticle,
  type MagazineCategory,
} from "@/data/magazineArticles";

export const MAGAZINE_BUCKET = "magazine";

const LEGACY_COLUMNS =
  "slug, category, title, publisher, published_at, summary, key_points, brand_highlight, thumbnail_url, thumbnail_path, thumbnail_credit, external_url";
// 20261023030000 마이그레이션의 본문 · SEO 컬럼
const PUBLIC_COLUMNS = `${LEGACY_COLUMNS}, body, seo_title, seo_description, author_name`;

/** 새 컬럼이 아직 없는 DB(마이그레이션 배포 전)면 기존 컬럼으로 다시 읽는다. */
const isMissingColumn = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === "42703" || /column .* does not exist/i.test(error.message ?? "")));

type MagazineRow = {
  slug: string;
  category: MagazineCategory;
  title: string;
  publisher: string;
  published_at: string;
  summary: string;
  key_points: string[] | null;
  brand_highlight: string | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  thumbnail_credit: string | null;
  external_url: string | null;
  body?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  author_name?: string | null;
};

export const magazineImageUrl = (path: string) => supabase.storage.from(MAGAZINE_BUCKET).getPublicUrl(path).data.publicUrl;

/** 자체 호스팅 이미지(thumbnail_path)를 외부 URL 보다 우선한다. */
export const resolveThumbnail = (row: Pick<MagazineRow, "thumbnail_path" | "thumbnail_url">) =>
  row.thumbnail_path ? magazineImageUrl(row.thumbnail_path) : row.thumbnail_url;

const toArticle = (row: MagazineRow): MagazineArticle => ({
  slug: row.slug,
  category: row.category,
  title: row.title,
  publisher: row.publisher,
  publishedAt: row.published_at,
  summary: row.summary ?? "",
  keyPoints: row.key_points ?? [],
  brandHighlight: row.brand_highlight,
  thumbnail: resolveThumbnail(row),
  thumbnailCredit: row.thumbnail_credit,
  externalUrl: row.external_url,
  body: row.body ?? null,
  seoTitle: row.seo_title ?? null,
  seoDescription: row.seo_description ?? null,
  authorName: row.author_name ?? null,
});

/**
 * 공개된 기사 목록(최신순). DB 를 읽지 못하면 기존 정적 목록으로 대체해
 * 백엔드 배포 상태와 관계없이 기존 매거진 콘텐츠가 사라지지 않게 한다.
 */
export async function fetchMagazineArticles(): Promise<MagazineArticle[]> {
  const query = (columns: string) => supabase
    .from("magazine_articles")
    .select(columns)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  let { data, error } = await query(PUBLIC_COLUMNS);
  if (isMissingColumn(error)) ({ data, error } = await query(LEGACY_COLUMNS));
  if (error || !data) {
    console.warn("[magazine] DB 조회 실패 — 정적 목록으로 대체합니다.", error);
    return sortMagazineArticles(fallbackArticles);
  }
  return (data as unknown as MagazineRow[]).map(toArticle);
}

/** 공개 기사 1건. 없거나 비공개면 null. DB 오류 시에만 정적 목록에서 찾는다. */
export async function fetchMagazineArticle(slug: string): Promise<MagazineArticle | null> {
  const query = (columns: string) => supabase
    .from("magazine_articles")
    .select(columns)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  let { data, error } = await query(PUBLIC_COLUMNS);
  if (isMissingColumn(error)) ({ data, error } = await query(LEGACY_COLUMNS));
  if (error) {
    console.warn("[magazine] DB 조회 실패 — 정적 목록에서 찾습니다.", error);
    return fallbackArticles.find((article) => article.slug === slug) ?? null;
  }
  return data ? toArticle(data as unknown as MagazineRow) : null;
}

// ---------------------------------------------------------------------------
// 관리자
// ---------------------------------------------------------------------------

export type AdminMagazineArticle = MagazineRow & {
  id: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminMagazineList = {
  counts: Record<"all" | "published" | "draft", number>;
  can_manage: boolean;
  rows: AdminMagazineArticle[];
};

export type MagazineArticleInput = Omit<MagazineRow, "key_points"> & {
  key_points: string[];
  is_published: boolean;
};

export type ImportedArticleMeta = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  published_at: string | null;
  author: string | null;
  image_license_notice: string;
};

/**
 * 기사 URL 의 공개 메타데이터(og:title · og:description · 발행일 · og:image)를 서버에서 읽어 온다.
 * 본문은 가져오지 않는다. 가져온 값은 폼에 채워질 뿐이고 관리자가 확인 후 저장한다.
 */
export async function importArticleMeta(url: string): Promise<ImportedArticleMeta> {
  const { data, error } = await supabase.functions.invoke("fetch-article-meta", { body: { url } });
  if (error) {
    let message = "기사 정보를 불러오지 못했습니다.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch { /* 응답 본문이 JSON 이 아니면 기본 문구 */ }
    throw new Error(message);
  }
  return data as ImportedArticleMeta;
}

export const listAdminMagazineArticles = (status: string, search: string) =>
  adminRpc<AdminMagazineList>("admin_list_magazine_articles", { p_status: status, p_search: search || null });

export const saveMagazineArticle = (id: string | null, input: MagazineArticleInput) =>
  adminRpc<AdminMagazineArticle>("admin_save_magazine_article", { p_id: id, p_data: input });

export const setMagazineArticlePublished = (id: string, published: boolean) =>
  adminRpc<void>("admin_set_magazine_article_published", { p_id: id, p_published: published });

export async function deleteMagazineArticle(id: string, reason: string) {
  const result = await adminRpc<{ thumbnail_path: string | null }>("admin_delete_magazine_article", { p_id: id, p_reason: reason });
  // 파일 정리는 실패해도 기사 삭제는 이미 끝났으므로 무시한다.
  if (result?.thumbnail_path) await supabase.storage.from(MAGAZINE_BUCKET).remove([result.thumbnail_path]);
  return result;
}

export async function uploadMagazineImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `articles/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(MAGAZINE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export const removeMagazineImage = async (path: string) => {
  await supabase.storage.from(MAGAZINE_BUCKET).remove([path]);
};
