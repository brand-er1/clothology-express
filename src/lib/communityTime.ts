import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export const formatCommunityTime = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });
