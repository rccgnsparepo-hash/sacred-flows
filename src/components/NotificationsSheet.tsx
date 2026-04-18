import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { X, Heart, MessageCircle, UserPlus, MessageSquare, Bell, Check } from 'lucide-react';

interface Props { onClose: () => void; }

const ICONS = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  message: MessageSquare,
  post: Bell,
  admin: Bell,
};

const COLORS = {
  like: 'text-destructive',
  comment: 'text-primary',
  follow: 'text-church-gold',
  message: 'text-primary',
  post: 'text-foreground',
  admin: 'text-church-gold',
};

function relTime(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function describe(n: NotificationItem) {
  const who = n.actor_name || 'Someone';
  switch (n.type) {
    case 'like': return `${who} liked your post`;
    case 'comment': return `${who} commented: ${n.message || ''}`;
    case 'follow': return `${who} started following you`;
    case 'message': return `${who}: ${n.message || ''}`;
    case 'post': return `${who} posted something new`;
    case 'admin': return n.message || 'Admin notification';
    default: return 'New notification';
  }
}

export function NotificationsSheet({ onClose }: Props) {
  const { items, loading, markAllRead, markRead, unread } = useNotifications();

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] bg-background rounded-t-3xl flex flex-col slide-up shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-foreground">Notifications</h3>
            {unread > 0 && <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{unread}</span>}
          </div>
          <div className="flex gap-2">
            {unread > 0 && (
              <button onClick={markAllRead} className="neu-btn p-2 text-primary" title="Mark all read">
                <Check size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-muted-foreground"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground text-[13px] py-8">Loading...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Bell size={36} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-[13px]">No notifications yet</p>
            </div>
          ) : items.map(n => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`neu-card-sm p-3 flex items-start gap-3 cursor-pointer ${!n.is_read ? 'border-l-4 border-primary' : 'opacity-70'}`}
              >
                <div className="w-9 h-9 rounded-full neu-convex flex items-center justify-center shrink-0 overflow-hidden">
                  {n.actor_avatar ? (
                    <img src={n.actor_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon size={16} className={COLORS[n.type]} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground line-clamp-2">{describe(n)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{relTime(n.created_at)} ago</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
