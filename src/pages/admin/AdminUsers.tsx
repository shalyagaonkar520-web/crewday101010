import { useCallback, useEffect, useState } from 'react'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { Ban, RotateCcw, Search, Shield, ShieldOff, Trash2, UserCog } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Field'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Tabs } from '@/components/ui/Tabs'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useDebounce } from '@/hooks/useDebounce'
import { anonymiseUserProfile, listUsers, setUserRole, setUserStatus } from '@/services/userService'
import { ADMIN_PAGE_SIZE } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import type { UserProfile, UserStatus } from '@/types'

type StatusTab = 'all' | UserStatus

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { success, error: toastError } = useToast()

  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)

  const [users, setUsers] = useState<UserProfile[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [detail, setDetail] = useState<UserProfile | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<UserProfile | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listUsers({ pageSize: ADMIN_PAGE_SIZE, status: tab, search: debouncedSearch })
      .then((page) => {
        setUsers(page.users)
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      })
      .catch(() => setError('We could not load users.'))
      .finally(() => setLoading(false))
  }, [tab, debouncedSearch])

  useEffect(load, [load])

  const loadMore = () => {
    if (!cursor) return
    setLoadingMore(true)
    listUsers({ pageSize: ADMIN_PAGE_SIZE, status: tab, search: debouncedSearch, cursor })
      .then((page) => {
        setUsers((current) => [...current, ...page.users])
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      })
      .catch(() => toastError('Could not load more users.'))
      .finally(() => setLoadingMore(false))
  }

  const runAction = async (action: () => Promise<void>, message: string) => {
    setBusy(true)
    try {
      await action()
      success(message)
      setDetail(null)
      setSuspendTarget(null)
      setDeleteTarget(null)
      setSuspendReason('')
      load()
    } catch {
      toastError('That action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Users</h1>
        <p className="mt-1 text-ink-500">Search members, review activity and manage access.</p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by exact email or name prefix"
            aria-label="Search users"
            leading={<Search size={18} />}
          />
        </div>
      </div>

      <div className="mb-5 max-w-lg">
        <Tabs<StatusTab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : users.length ? (
        <>
          <ul className="space-y-3">
            {users.map((profile) => (
              <Card as="li" key={profile.uid} className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={profile.name || 'CrewDay member'} photoURL={profile.photoURL} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900">{profile.name || 'Unnamed member'}</p>
                      {profile.role === 'admin' ? <Badge tone="sunset">Admin</Badge> : null}
                      {profile.status === 'suspended' ? <Badge tone="danger">Suspended</Badge> : null}
                      {profile.status === 'deleted' ? <Badge tone="neutral">Deleted</Badge> : null}
                    </div>
                    <p className="truncate text-sm text-ink-600">{profile.email || '—'}</p>
                    <p className="text-sm text-ink-500">
                      {[profile.city, profile.area].filter(Boolean).join(', ') || 'No city'} ·{' '}
                      {profile.eventsRegistered} registered · {profile.eventsAttended} attended
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<UserCog size={15} />}
                    onClick={() => setDetail(profile)}
                  >
                    Manage
                  </Button>
                </div>
              </Card>
            ))}
          </ul>

          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <Button variant="outline" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          emoji="👥"
          title={debouncedSearch ? 'No users match that search' : 'No users yet'}
          description={
            debouncedSearch
              ? 'Firestore matches an exact email, or a name prefix like "Ana".'
              : 'Members appear here as soon as people sign up.'
          }
        />
      )}

      {/* Detail / actions */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Member'}
        description={detail?.email}
      >
        {detail ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-500">Joined</dt>
                <dd className="font-semibold text-ink-900">{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Last active</dt>
                <dd className="font-semibold text-ink-900">{formatDateTime(detail.lastActiveAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Phone</dt>
                <dd className="font-semibold text-ink-900">{detail.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Joins as</dt>
                <dd className="font-semibold text-ink-900 capitalize">{detail.participationType}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Registered</dt>
                <dd className="font-semibold text-ink-900">{detail.eventsRegistered}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Attended</dt>
                <dd className="font-semibold text-ink-900">{detail.eventsAttended}</dd>
              </div>
            </dl>

            {detail.interests.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-800">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.suspendedReason ? (
              <p className="rounded-xl bg-sunset-50 p-3 text-sm text-sunset-800">
                Suspended: {detail.suspendedReason}
              </p>
            ) : null}

            <div className="grid gap-2 border-t border-ink-100 pt-4">
              {detail.status === 'suspended' ? (
                <Button
                  variant="outline"
                  fullWidth
                  icon={<RotateCcw size={16} />}
                  loading={busy}
                  onClick={() =>
                    void runAction(() => setUserStatus(detail.uid, 'active'), 'User restored.')
                  }
                >
                  Restore account
                </Button>
              ) : detail.status === 'active' ? (
                <Button
                  variant="outline"
                  fullWidth
                  icon={<Ban size={16} />}
                  onClick={() => {
                    setSuspendTarget(detail)
                    setDetail(null)
                  }}
                >
                  Suspend account
                </Button>
              ) : null}

              {detail.uid !== currentUser?.uid ? (
                detail.role === 'admin' ? (
                  <Button
                    variant="outline"
                    fullWidth
                    icon={<ShieldOff size={16} />}
                    loading={busy}
                    onClick={() =>
                      void runAction(
                        () => setUserRole(detail.uid, 'user'),
                        'Organiser access removed.',
                      )
                    }
                  >
                    Remove organiser access
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    fullWidth
                    icon={<Shield size={16} />}
                    loading={busy}
                    onClick={() =>
                      void runAction(
                        () => setUserRole(detail.uid, 'admin'),
                        'Organiser access granted.',
                      )
                    }
                  >
                    Make organiser
                  </Button>
                )
              ) : (
                <p className="text-center text-xs text-ink-500">
                  You cannot change your own organiser access.
                </p>
              )}

              {detail.status !== 'deleted' ? (
                <Button
                  variant="ghost"
                  fullWidth
                  className="text-sunset-700 hover:bg-sunset-50"
                  icon={<Trash2 size={16} />}
                  onClick={() => {
                    setDeleteTarget(detail)
                    setDetail(null)
                  }}
                >
                  Delete personal data
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Suspend */}
      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title="Suspend this account?"
        description="They stay signed in but cannot register for events."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                suspendTarget &&
                void runAction(
                  () => setUserStatus(suspendTarget.uid, 'suspended', suspendReason),
                  'Account suspended.',
                )
              }
            >
              Suspend
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (internal)"
          rows={3}
          value={suspendReason}
          onChange={(event) => setSuspendReason(event.target.value)}
          placeholder="Repeated no-shows after registering."
        />
      </Modal>

      {/* Delete personal data */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this member's personal data?"
        description="Name, email, phone, photo and interests are removed and the profile is marked deleted. Their attendance history stays as an anonymous count. Their sign-in account itself can only be removed from the authentication console, or by the member deleting their own account."
        confirmLabel="Delete personal data"
        loading={busy}
        onConfirm={() =>
          deleteTarget &&
          void runAction(() => anonymiseUserProfile(deleteTarget.uid), 'Personal data removed.')
        }
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
