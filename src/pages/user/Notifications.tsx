import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CalendarX2, CheckCheck, PartyPopper, Sparkles, Ticket } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '@/services/notificationService'
import { formatDateTime } from '@/utils/format'
import type { AppNotification, NotificationType } from '@/types'

const ICONS: Record<NotificationType, typeof BellRing> = {
  new_event: PartyPopper,
  registration_confirmed: Ticket,
  event_reminder: BellRing,
  event_cancelled: CalendarX2,
  event_updated: BellRing,
  waitlist_promoted: Ticket,
  request_approved: Sparkles,
  request_rejected: CalendarX2,
  system: BellRing,
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToNotifications(
      user.uid,
      (list) => {
        setNotifications(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsubscribe
  }, [user])

  const unread = notifications.filter((entry) => !entry.read).length

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Notifications</h1>
          <p className="mt-1 text-ink-500">
            {unread ? `${unread} unread` : 'You are all caught up.'}
          </p>
        </div>
        {unread > 0 && user ? (
          <Button
            size="sm"
            variant="outline"
            icon={<CheckCheck size={15} />}
            onClick={() => void markAllNotificationsRead(user.uid)}
          >
            Mark all read
          </Button>
        ) : null}
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-card" />
          ))}
        </div>
      ) : notifications.length ? (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const Icon = ICONS[notification.type] ?? BellRing
            const body = (
              <div className="flex gap-3.5 p-4">
                <span
                  className={clsx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    notification.read ? 'bg-ink-100 text-ink-500' : 'bg-brand-50 text-brand-600',
                  )}
                >
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      'font-semibold',
                      notification.read ? 'text-ink-700' : 'text-ink-900',
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="text-sm text-ink-600">{notification.body}</p>
                  <p className="mt-1 text-xs text-ink-400">{formatDateTime(notification.createdAt)}</p>
                </div>
                {!notification.read ? (
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
                ) : null}
              </div>
            )

            return (
              <Card as="li" key={notification.id} className="overflow-hidden">
                {notification.eventId ? (
                  <Link
                    to={`/events/${notification.eventId}`}
                    onClick={() => {
                      if (!notification.read) void markNotificationRead(notification.id)
                    }}
                    className="block transition hover:bg-ink-50"
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full text-left transition hover:bg-ink-50"
                    onClick={() => {
                      if (!notification.read) void markNotificationRead(notification.id)
                    }}
                  >
                    {body}
                  </button>
                )}
              </Card>
            )
          })}
        </ul>
      ) : (
        <EmptyState
          emoji="🔔"
          title="No notifications yet"
          description="Registration confirmations, reminders and event updates land here."
        />
      )}
    </div>
  )
}
