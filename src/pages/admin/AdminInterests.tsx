import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  createInterest,
  deleteInterest,
  listInterests,
  seedInterestsIfEmpty,
  updateInterest,
} from '@/services/interestService'
import type { Interest } from '@/types'

export default function AdminInterestsPage() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [interests, setInterests] = useState<Interest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Interest | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Interest | null>(null)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listInterests(true)
      .then(setInterests)
      .catch(() => setError('We could not load interests.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const grouped = useMemo(() => {
    const groups = new Map<string, Interest[]>()
    for (const interest of interests) {
      const key = interest.category || 'Uncategorised'
      groups.set(key, [...(groups.get(key) ?? []), interest])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [interests])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setEmoji('')
    setCategory('')
    setFormOpen(true)
  }

  const openEdit = (interest: Interest) => {
    setEditing(interest)
    setName(interest.name)
    setEmoji(interest.emoji)
    setCategory(interest.category)
    setFormOpen(true)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateInterest(editing.id, { name, emoji, category })
        success('Interest updated.')
      } else {
        await createInterest({ name, emoji, category, createdBy: user.uid })
        success('Interest added.')
      }
      setFormOpen(false)
      load()
    } catch {
      toastError('We could not save that interest.')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (interest: Interest) => {
    setBusyId(interest.id)
    try {
      await updateInterest(interest.id, { enabled: !interest.enabled })
      success(
        interest.enabled
          ? 'Interest disabled. Existing profiles keep it.'
          : 'Interest enabled.',
      )
      load()
    } catch {
      toastError('Could not update that interest.')
    } finally {
      setBusyId(null)
    }
  }

  const onDelete = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      await deleteInterest(deleteTarget.id)
      success('Interest deleted.')
      setDeleteTarget(null)
      load()
    } catch {
      toastError('Could not delete that interest.')
    } finally {
      setBusyId(null)
    }
  }

  const onSeed = async () => {
    if (!user) return
    setSeeding(true)
    try {
      const count = await seedInterestsIfEmpty(user.uid)
      success(count ? `Added ${count} starter interests.` : 'Interests already exist.')
      load()
    } catch {
      toastError('Could not seed interests.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Interests</h1>
          <p className="mt-1 text-ink-500">
            What members can pick during onboarding. Disabling hides an interest without breaking
            anyone&apos;s saved profile.
          </p>
        </div>
        <Button icon={<Plus size={17} />} onClick={openCreate}>
          Add interest
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : interests.length ? (
        <div className="space-y-6">
          {grouped.map(([groupName, items]) => (
            <section key={groupName}>
              <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">
                {groupName}
              </h2>
              <Card className="divide-y divide-ink-100">
                {items.map((interest) => (
                  <div key={interest.id} className="flex flex-wrap items-center gap-3 p-3.5">
                    <span className="text-2xl" aria-hidden>
                      {interest.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink-900">{interest.name}</p>
                        {!interest.enabled ? <Badge tone="neutral">Disabled</Badge> : null}
                        {interest.custom ? <Badge tone="brand">Member added</Badge> : null}
                      </div>
                      <p className="text-sm text-ink-500">
                        {interest.usageCount} member{interest.usageCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${interest.name}`}
                        onClick={() => openEdit(interest)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === interest.id}
                        aria-label={interest.enabled ? `Disable ${interest.name}` : `Enable ${interest.name}`}
                        onClick={() => void toggleEnabled(interest)}
                      >
                        {interest.enabled ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                      {interest.usageCount === 0 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-sunset-700"
                          aria-label={`Delete ${interest.name}`}
                          onClick={() => setDeleteTarget(interest)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          emoji="🎯"
          title="No interests yet"
          description="Seed the starter list so the very first member does not see an empty onboarding screen."
          action={
            <Button loading={seeding} icon={<Sparkles size={17} />} onClick={() => void onSeed()}>
              Seed starter interests
            </Button>
          }
        />
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit interest' : 'Add interest'}
        size="sm"
      >
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <Input
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Badminton"
          />
          <Input
            label="Emoji"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            placeholder="🏸"
            maxLength={4}
          />
          <Input
            label="Group"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Sports"
            hint="Interests are grouped by this in onboarding."
          />
          <Button type="submit" fullWidth loading={saving} disabled={!name.trim()}>
            {editing ? 'Save changes' : 'Add interest'}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Nobody has selected this interest, so deleting it is safe. Interests in use can only be disabled."
        confirmLabel="Delete"
        loading={busyId === deleteTarget?.id}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
