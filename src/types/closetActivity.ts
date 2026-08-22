export type ClosetActivityEventType =
  | "garment_created"
  | "garment_edited"
  | "garment_regenerated"
  | "character_dressed"
  | "look_saved";

/** One row of the admin-visible Brand-er Closet activity feed (see get_admin_closet_activity). */
export interface AdminClosetActivity {
  id: string;
  user_id: string;
  event_type: ClosetActivityEventType;
  character_gender: string | null;
  slot: string | null;
  garment_id: string | null;
  label: string | null;
  prompt: string | null;
  image_url: string | null;
  image_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  brand_name: string | null;
  customer_name: string | null;
  username: string | null;
  phone_number: string | null;
  email: string | null;
}
