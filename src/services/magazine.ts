import { supabase } from "@/lib/supabase";
import { adminRpc } from "@/services/adminApi";
import {
  magazineArticles as fallbackArticles,
  sortMagazineArticles,
  type MagazineArticle,
  type MagazineCategory,
} from "@/data/magazineArticles";

export const MAGAZINE_BUCKET = "magazine";

const PUBLIC_COLUMNS =
  "slug, category, title, publisher, published_at, summary, key_points, brand_highlight, thumbnail_url, thumbnail_path, thumbnail_credit, external_url";

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
});

/**
 * 공개된 기사 목록(최신순). DB 를 읽지 못하면 기존 정적 목록으로 대체해
 * 백엔드 배포 상태와 관계없이 기존 매거진 콘텐츠가 사라지지 않게 한다.
 */
export async function fetchMagazineArticles(): Promise<MagazineArticle[]> {
  const { data, error } = await supabase
    .from("magazine_articles")
    .select(PUBLIC_COLUMNS)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return sortMagazineArticles(fallbackArticles);
  return (data as MagazineRow[]).map(toArticle);
}

/** 공개 기사 1건. 없거나 비공개면 null. DB 오류 시에만 정적 목록에서 찾는다. */
export async function fetchMagazineArticle(slug: string): Promise<MagazineArticle | null> {
  const { data, error } = await supabase
    .from("magazine_articles")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) return fallbackArticles.find((article) => article.slug === slug) ?? null;
  return data ? toArticle(data as MagazineRow) : null;
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
