import { supabase } from "@/lib/supabase";
import type { CreateFundingInput, Funding, FundingStatus } from "@/types/funding";

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
};
export const createFundingDraft = async (input: CreateFundingInput): Promise<Funding> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fundings")
    .insert({
      creator_id: user.id,
      product_name: input.productName,
      cloth_type: input.clothType,
      material: input.material,
      color: input.color || null,
      size: input.size,
      measurements: input.measurements,
      image_url: input.imageUrl,
      image_path: input.imagePath,
      description: input.description,
      moq: 20,
      current_orders: 0,
      funding_days: 30,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchFunding = async (id: string): Promise<Funding> => {
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchApprovedFundings = async (): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const fetchMyFundings = async (): Promise<Funding[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const updateFunding = async (
  id: string,
  updates: Pick<Funding, "product_name" | "description" | "moq" | "price" | "funding_days">
): Promise<Funding> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fundings")
    .update({
      ...updates,
      moq: Math.max(20, updates.moq),
      status: "pending",
      admin_comment: null,
      reviewed_at: null,
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("creator_id", user.id)
    .in("status", ["pending", "rejected"])
    .select("*")
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchAllFundings = async (): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const reviewFunding = async (
  id: string,
  status: Extract<FundingStatus, "approved" | "rejected">,
  adminComment: string
): Promise<void> => {
  const user = await requireUser();
  const { error } = await supabase
    .from("fundings")
    .update({
      status,
      admin_comment: adminComment || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
};
