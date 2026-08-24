import { supabase } from "@/lib/supabase";
import { getAppPath } from "@/utils/appUrl";
import { portfolioProducts } from "@/data/portfolioProducts";
import type { PortfolioProject } from "@/types/portfolio";

/** `main_image_path`/`additional_image_paths` may be either a root-relative static path
 * ("/portfolio/x.webp") or an absolute Supabase Storage URL — only the former needs the app's
 * base-path prefix (relevant when the site is deployed under a subpath, e.g. GitHub Pages). */
const resolveImagePath = (path: string) => (/^https?:\/\//i.test(path) ? path : getAppPath(path));

interface PortfolioProjectRow {
  id: string;
  name_ko: string;
  name_en: string;
  category: string;
  main_image_path: string;
  additional_image_paths: string[] | null;
  country: string | null;
  quantity: string | null;
  services: string[] | null;
  description: string | null;
  is_visible: boolean;
  display_order: number;
}

const rowToProject = (row: PortfolioProjectRow): PortfolioProject => ({
  id: row.id,
  nameKo: row.name_ko,
  nameEn: row.name_en,
  category: row.category,
  images: [row.main_image_path, ...(row.additional_image_paths || [])].map(resolveImagePath),
  country: row.country,
  quantity: row.quantity,
  services: row.services || [],
  description: row.description,
  order: row.display_order,
  visible: row.is_visible,
});

/** Falls back to the static catalog (mapped into the same shape) so the page never renders
 * empty — before the migration ships, or if the table is briefly unreachable. */
const staticFallback = (): PortfolioProject[] =>
  portfolioProducts.map((product, index) => ({
    id: product.id,
    nameKo: product.nameKo,
    nameEn: product.nameEn,
    category: product.category,
    images: [product.image],
    country: null,
    quantity: null,
    services: [],
    description: null,
    order: index + 1,
    visible: true,
  }));

/** Public listing (visible projects only), ordered for display. Used by the portfolio page. */
export const fetchVisiblePortfolioProjects = async (): Promise<PortfolioProject[]> => {
  try {
    const { data, error } = await supabase
      .from("portfolio_projects")
      .select("*")
      .eq("is_visible", true)
      .order("display_order", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return staticFallback();
    return (data as PortfolioProjectRow[]).map(rowToProject);
  } catch (error) {
    console.error("Failed to load portfolio projects, using static fallback:", error);
    return staticFallback();
  }
};

/** Admin listing — every project regardless of visibility, for the management screen. */
export const fetchAllPortfolioProjectsForAdmin = async (): Promise<PortfolioProject[]> => {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data as PortfolioProjectRow[]).map(rowToProject);
};

export interface PortfolioProjectInput {
  nameKo: string;
  nameEn: string;
  category: string;
  mainImagePath: string;
  additionalImagePaths: string[];
  country: string | null;
  quantity: string | null;
  services: string[];
  description: string | null;
  visible: boolean;
  order: number;
}

export const createPortfolioProject = async (input: PortfolioProjectInput) => {
  const { error } = await supabase.from("portfolio_projects").insert({
    name_ko: input.nameKo,
    name_en: input.nameEn,
    category: input.category,
    main_image_path: input.mainImagePath,
    additional_image_paths: input.additionalImagePaths,
    country: input.country,
    quantity: input.quantity,
    services: input.services,
    description: input.description,
    is_visible: input.visible,
    display_order: input.order,
  });
  if (error) throw error;
};

export const updatePortfolioProject = async (id: string, input: PortfolioProjectInput) => {
  const { error } = await supabase
    .from("portfolio_projects")
    .update({
      name_ko: input.nameKo,
      name_en: input.nameEn,
      category: input.category,
      main_image_path: input.mainImagePath,
      additional_image_paths: input.additionalImagePaths,
      country: input.country,
      quantity: input.quantity,
      services: input.services,
      description: input.description,
      is_visible: input.visible,
      display_order: input.order,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
};

export const deletePortfolioProject = async (id: string) => {
  const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
  if (error) throw error;
};

/** Uploads a single admin-provided image file to Storage and returns its public URL. */
export const uploadPortfolioProjectImage = async (projectId: string, file: File): Promise<string> => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `portfolio/${projectId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("generated_images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("generated_images").getPublicUrl(path);
  return data.publicUrl;
};
