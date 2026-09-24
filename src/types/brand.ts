export type CreatorProfile = {
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandStatus = "active" | "suspended";

export type Brand = {
  id: string;
  owner_user_id: string;
  creator_profile_user_id: string;
  brand_name: string;
  normalized_brand_name: string;
  brand_logo_url: string | null;
  short_description: string | null;
  description: string | null;
  instagram_url: string | null;
  website_url: string | null;
  status: BrandStatus;
  created_at: string;
  updated_at: string;
};

export type BrandWithCreator = Brand & {
  creator_profile: CreatorProfile | null;
};

export type BrandProfileInput = {
  displayName: string;
  profileImageUrl: string | null;
  creatorBio: string;
  brandName: string;
  brandLogoUrl: string | null;
  shortDescription: string;
  description: string;
  instagramUrl: string;
  websiteUrl: string;
};

export type AdminBrandSummary = BrandWithCreator & {
  fundings: Array<{ id: string; status: string }>;
};
