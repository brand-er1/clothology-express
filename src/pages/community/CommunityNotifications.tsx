import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Ban, Flame, Heart, Loader2, MessageCircle, PackageCheck, PartyPopper, Rocket,
  UserPlus, UserX, Vote, Megaphone,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { formatCommunityTime } from "@/lib/communityTime";
import {
  fetchCommunityNotifications,
  getCommunityErrorMessage,
  markAllCommunityNotificationsRead,
  markCommunityNotificationRead,
} from "@/services/community";
import type { CommunityNotification, CommunityNotificationType } from "@/types/community";

const iconByType: Record<CommunityNotificationType, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  reply: MessageCircle,
  purchase_intent: Flame,
  poll_vote: Vote,
  follow: UserPlus,
  purchase_intent_goal: PartyPopper,
  funding_started: Rocket,
  funding_status_changed: PackageCheck,
  participation_cancelled: UserX,
  funding_cancelled: Ban,
  admin_notice: Megaphone,
  funding_success: PartyPopper,
  funding_success_participant: PartyPopper,
};

// 서버가 내려준 내부 경로만 따라간다(외부 URL/프로토콜 상대 경로 차단).
const isSafeInternalPath = (path: string | null): path is string => Boolean(path && path.startsWith("/") && !path.startsWith("//"));

const CommunityNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      setNotifications(await fetchCommunityNotifications());
    } catch (error) {
      toast({ title: "알림을 불러오지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleClick = async (notification: CommunityNotification) => {
    if (!notification.isRead) {
      void markCommunityNotificationRead(notification.id);
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
    }
    if (isSafeInternalPath(notification.linkPath)) {
      navigate(notification.linkPath);
    } else if (notification.postId) {
      navigate(`/community/${notification.postId}`);
    } else if (notification.fundingId) {
      navigate(`/fundings/${notification.fundingId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllCommunityNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      toast({ title: "처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f4]">
      <Header />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-20 sm:pt-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-[-0.03em] text-stone-950">알림</h1>
          {notifications.some((item) => !item.isRead) && (
            <Button variant="ghost" size="sm" className="text-xs font-bold text-brand" onClick={handleMarkAllRead}>
              모두 읽음 처리
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : notifications.length === 0 ? (
          <p className="py-24 text-center text-sm text-stone-400">아직 알림이 없습니다.</p>
        ) : (
          <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm">
            {notifications.map((notification) => {
              const Icon = iconByType[notification.type] ?? Heart;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleClick(notification)}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-stone-50 ${!notification.isRead ? "bg-brand/5" : ""}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${!notification.isRead ? "bg-brand text-white" : "bg-stone-100 text-stone-500"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {notification.title && <span className="block text-sm font-extrabold text-stone-900">{notification.title}</span>}
                    <span className="block whitespace-pre-line text-sm text-stone-800">{notification.message}</span>
                    {notification.type === "funding_success" && isSafeInternalPath(notification.linkPath) && (
                      <span className="mt-2 inline-flex rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">펀딩 관리하기</span>
                    )}
                    <span className="mt-0.5 block text-xs text-stone-400">{formatCommunityTime(notification.createdAt)}</span>
                  </span>
                  {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/profile" className="text-sm font-semibold text-stone-500 hover:text-brand">마이페이지로 돌아가기</Link>
        </div>
      </main>
    </div>
  );
};

export default CommunityNotifications;
