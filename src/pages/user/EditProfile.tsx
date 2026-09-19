import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Check, Plus } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { InlineAlert, Spinner } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createInterest, listInterests } from '@/services/interestService'
import { updateUserProfile } from '@/services/userService'
import { uploadProfilePhoto } from '@/services/storageService'
import { validateProfileFields } from '@/utils/validation'
import type { Interest, ParticipationType } from '@/types'

export default function EditProfilePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { success, error: toastError } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [participationType, setParticipationType] = useState<ParticipationType>('participant')
  const [selected, setSelected] = useState<string[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [loadingInterests, setLoadingInterests] = useState(true)
  const [customInterest, setCustomInterest] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setName(profile.name)
    setPhone(profile.phone)
    setCity(profile.city)
    setArea(profile.area)
    setPhotoURL(profile.photoURL)
    setParticipationType(profile.participationType)
    setSelected(profile.interests)
  }, [profile])

  useEffect(() => {
    listInterests()
      .then(setInterests)
      .catch(() => undefined)
      .finally(() => setLoadingInterests(false))
  }, [])

  const errors = touched ? validateProfileFields({ name, phone, city }) : {}

  const onPickPhoto = async (file: File | undefined) => {
    if (!file || !user) return
    setUploading(true)
    try {
      const result = await uploadProfilePhoto(user.uid, file)
      setPhotoURL(result.url)
      success('Photo updated. Remember to save.')
    } catch (caught) {
      toastError(caught instanceof Error ? caught.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const addCustomInterest = async () => {
    const value = customInterest.trim()
    if (!value || !user) return
    try {
      const created = await createInterest({ name: value, custom: true, createdBy: user.uid })
      setInterests((current) =>
        current.some((entry) => entry.id === created.id) ? current : [...current, created],
      )
      setSelected((current) => (current.includes(created.name) ? current : [...current, created.name]))
    } catch {
      setSelected((current) => (current.includes(value) ? current : [...current, value]))
    } finally {
      setCustomInterest('')
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    setTouched(true)

    const validation = validateProfileFields({ name, phone, city })
    if (Object.keys(validation).length) {
      setFormError('Please fix the highlighted fields.')
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      await updateUserProfile(user.uid, {
        name,
        phone,
        city,
        area,
        photoURL,
        interests: selected,
        participationType,
      })
      success('Profile updated.')
      navigate('/profile')
    } catch {
      setFormError('We could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/profile"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} aria-hidden /> Profile
      </Link>

      <h1 className="font-display text-3xl font-extrabold text-ink-900">Edit profile</h1>

      <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-5" noValidate>
        <Card className="flex items-center gap-4 p-4">
          <Avatar name={name || 'CrewDay'} photoURL={photoURL} size="lg" />
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={uploading ? undefined : <Camera size={15} />}
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              Change photo
            </Button>
            <p className="mt-1 text-xs text-ink-500">JPG, PNG or WebP. Max 5 MB.</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void onPickPhoto(event.target.files?.[0])}
            />
          </div>
        </Card>

        <Input
          label="Name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          autoComplete="name"
        />
        <Input
          label="Phone number"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={errors.phone}
          inputMode="tel"
          autoComplete="tel"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="City"
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
            error={errors.city}
          />
          <Input label="Area" value={area} onChange={(event) => setArea(event.target.value)} />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-800">How do you want to join?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: 'participant' as const, emoji: '🎤', title: 'Participant' },
                { value: 'audience' as const, emoji: '👀', title: 'Audience' },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setParticipationType(option.value)}
                aria-pressed={participationType === option.value}
                className={clsx(
                  'rounded-2xl border-2 p-4 text-left font-semibold transition',
                  participationType === option.value
                    ? 'border-brand-600 bg-brand-50 text-ink-900'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300',
                )}
              >
                <span className="mr-2" aria-hidden>
                  {option.emoji}
                </span>
                {option.title}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-800">Interests</legend>
          {loadingInterests ? (
            <Spinner className="h-5 w-5" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => {
                const active = selected.includes(interest.name)
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() =>
                      setSelected((current) =>
                        active
                          ? current.filter((entry) => entry !== interest.name)
                          : [...current, interest.name],
                      )
                    }
                    aria-pressed={active}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition',
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300',
                    )}
                  >
                    <span aria-hidden>{interest.emoji}</span>
                    {interest.name}
                    {active ? <Check size={14} aria-hidden /> : null}
                  </button>
                )
              })}

              {/* Interests that were saved before an admin disabled them stay selectable. */}
              {selected
                .filter((entry) => !interests.some((interest) => interest.name === entry))
                .map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setSelected((current) => current.filter((item) => item !== entry))}
                    className="flex items-center gap-1.5 rounded-full border border-brand-600 bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white"
                  >
                    {entry}
                    <Check size={14} aria-hidden />
                  </button>
                ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Input
              value={customInterest}
              onChange={(event) => setCustomInterest(event.target.value)}
              placeholder="Add your own interest"
              aria-label="Add your own interest"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void addCustomInterest()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!customInterest.trim()}
              onClick={() => void addCustomInterest()}
              icon={<Plus size={16} />}
            >
              Add
            </Button>
          </div>
        </fieldset>

        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/profile')}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" size="lg" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}
