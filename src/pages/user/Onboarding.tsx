import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { InlineAlert, Spinner } from '@/components/ui/Feedback'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { bumpInterestUsage, createInterest, listInterests } from '@/services/interestService'
import { completeOnboarding } from '@/services/userService'
import { trackSync } from '@/services/analyticsService'
import { SEED_INTERESTS } from '@/utils/constants'
import { validateProfileFields } from '@/utils/validation'
import type { Interest, ParticipationType } from '@/types'

type Step = 0 | 1 | 2

const STEP_TITLES = ['What are you into?', 'How do you want to join?', 'Where are you?']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { error: toastError } = useToast()

  const [step, setStep] = useState<Step>(0)
  const [interests, setInterests] = useState<Interest[]>([])
  const [loadingInterests, setLoadingInterests] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [participationType, setParticipationType] = useState<ParticipationType>('participant')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [customInterest, setCustomInterest] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!profile) return
    setName((current) => current || profile.name)
    setPhone((current) => current || profile.phone)
    setCity((current) => current || profile.city)
    setArea((current) => current || profile.area)
    if (profile.interests.length) setSelected((current) => (current.length ? current : profile.interests))
  }, [profile])

  useEffect(() => {
    let cancelled = false
    listInterests()
      .then((list) => {
        if (cancelled) return
        // An empty `interests` collection (brand new project) still needs to
        // show something, so fall back to the seed list read-only.
        setInterests(
          list.length
            ? list
            : SEED_INTERESTS.map((seed) => ({
                id: seed.name,
                name: seed.name,
                emoji: seed.emoji,
                category: seed.category,
                enabled: true,
                custom: false,
                usageCount: 0,
                createdAt: null,
                createdBy: '',
              })),
        )
      })
      .catch(() => {
        if (!cancelled) toastError('We could not load interests. You can still continue.')
      })
      .finally(() => {
        if (!cancelled) setLoadingInterests(false)
      })
    return () => {
      cancelled = true
    }
  }, [toastError])

  const grouped = useMemo(() => {
    const groups = new Map<string, Interest[]>()
    for (const interest of interests) {
      const key = interest.category || 'More'
      groups.set(key, [...(groups.get(key) ?? []), interest])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [interests])

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name],
    )
    trackSync('interest_selected', { interest: name })
  }

  const addCustomInterest = async () => {
    const value = customInterest.trim()
    if (!value || !user) return
    setAddingCustom(true)
    try {
      const created = await createInterest({ name: value, custom: true, createdBy: user.uid })
      setInterests((current) =>
        current.some((entry) => entry.id === created.id) ? current : [...current, created],
      )
      setSelected((current) =>
        current.includes(created.name) ? current : [...current, created.name],
      )
      setCustomInterest('')
    } catch {
      // Interests are admin-writable in some rule setups; keep the choice local
      // rather than losing what the person typed.
      setSelected((current) => (current.includes(value) ? current : [...current, value]))
      setCustomInterest('')
    } finally {
      setAddingCustom(false)
    }
  }

  const finish = async () => {
    if (!user) return
    setTouched(true)
    const errors = validateProfileFields({ name, phone, city })
    if (Object.keys(errors).length) {
      setFormError(Object.values(errors)[0])
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      await completeOnboarding(user.uid, {
        name,
        phone,
        city,
        area,
        interests: selected,
        participationType,
      })
      // Usage counts drive the admin "popular interests" panel. Best effort.
      void bumpInterestUsage(
        selected
          .map((entry) => interests.find((interest) => interest.name === entry)?.id)
          .filter((id): id is string => Boolean(id)),
      ).catch(() => undefined)

      trackSync('profile_completed', { interests: selected.length, role: participationType })
      navigate('/home', { replace: true })
    } catch {
      setFormError('We could not save your profile. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const profileErrors = touched ? validateProfileFields({ name, phone, city }) : {}

  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <p className="text-sm font-semibold text-ink-500">Step {step + 1} of 3</p>
        </div>

        <div className="mb-8 flex gap-2" role="progressbar" aria-valuenow={step + 1} aria-valuemax={3}>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={clsx(
                'h-1.5 flex-1 rounded-full transition',
                index <= step ? 'bg-brand-600' : 'bg-ink-200',
              )}
            />
          ))}
        </div>

        <div className="flex-1">
          {step === 0 ? (
            <section className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold text-ink-900">
                What are your interests?
              </h1>
              <p className="mt-2 text-ink-500">
                Select the hobbies and activities you love. We will match you with the right events
                and people.
              </p>

              {loadingInterests ? (
                <div className="flex justify-center py-12">
                  <Spinner className="h-7 w-7" />
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {grouped.map(([category, items]) => (
                    <div key={category}>
                      <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">
                        {category}
                      </h2>
                      <div className="grid grid-cols-3 gap-3">
                        {items.map((interest, tileIndex) => {
                          const active = selected.includes(interest.name)
                          // Rotating pastels keep the grid lively without
                          // assigning a colour to every possible interest.
                          const tints = [
                            'bg-brand-50',
                            'bg-sky-50',
                            'bg-grape-50',
                            'bg-mint-50',
                            'bg-sunset-50',
                          ]
                          return (
                            <button
                              key={interest.id}
                              type="button"
                              onClick={() => toggle(interest.name)}
                              aria-pressed={active}
                              className={clsx(
                                'relative flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl transition-all duration-200 active:scale-95',
                                tints[tileIndex % tints.length],
                                active
                                  ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-[#fdf7fb]'
                                  : 'ring-1 ring-ink-100 hover:ring-brand-200',
                              )}
                            >
                              <span className="text-3xl" aria-hidden>
                                {interest.emoji}
                              </span>
                              <span className="px-1 text-center text-xs leading-tight font-semibold text-ink-700">
                                {interest.name}
                              </span>
                              {active ? (
                                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                                  <Check size={12} strokeWidth={3} aria-hidden />
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="rounded-card border border-dashed border-ink-200 bg-white p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800">
                      <Sparkles size={16} className="text-brand-500" aria-hidden />
                      Add your own interest
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={customInterest}
                        onChange={(event) => setCustomInterest(event.target.value)}
                        placeholder="Table tennis, pottery, chess…"
                        aria-label="Custom interest"
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
                        loading={addingCustom}
                        disabled={!customInterest.trim()}
                        onClick={() => void addCustomInterest()}
                        icon={<Plus size={16} />}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="animate-fade-up">
              <h1 className="font-display text-3xl font-extrabold text-ink-900">
                {STEP_TITLES[1]}
              </h1>
              <p className="mt-2 text-ink-500">You can change this any time from your profile.</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'participant' as const,
                      emoji: '🎤',
                      title: 'Participant',
                      body: 'I want to participate.',
                    },
                    {
                      value: 'audience' as const,
                      emoji: '👀',
                      title: 'Audience',
                      body: 'I want to watch and enjoy.',
                    },
                  ] satisfies { value: ParticipationType; emoji: string; title: string; body: string }[]
                ).map((option) => {
                  const active = participationType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setParticipationType(option.value)}
                      aria-pressed={active}
                      className={clsx(
                        'rounded-card border-2 p-6 text-left transition',
                        active
                          ? 'border-brand-600 bg-brand-50 shadow-lift'
                          : 'border-ink-200 bg-white hover:border-brand-300',
                      )}
                    >
                      <span className="text-3xl" aria-hidden>
                        {option.emoji}
                      </span>
                      <h2 className="mt-3 font-display text-lg font-bold text-ink-900">
                        {option.title}
                      </h2>
                      <p className="mt-1 text-sm text-ink-600">{option.body}</p>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="animate-fade-up space-y-4">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-ink-900">
                  {STEP_TITLES[2]}
                </h1>
                <p className="mt-2 text-ink-500">
                  So we can show events close to you. Your phone number stays private — organisers
                  only see it for events you register for.
                </p>
              </div>

              <Input
                label="Your name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={profileErrors.name}
                placeholder="Anaya Sharma"
                autoComplete="name"
              />
              <Input
                label="Phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                error={profileErrors.phone}
                placeholder="9876543210"
                inputMode="tel"
                autoComplete="tel"
                hint="Optional now, required when you register for an event."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="City"
                  required
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  error={profileErrors.city}
                  placeholder="Bengaluru"
                  autoComplete="address-level2"
                />
                <Input
                  label="Area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder="Electronic City"
                  autoComplete="address-level3"
                />
              </div>

              {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-8 flex gap-3 bg-ink-50 py-4">
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => setStep((current) => (current - 1) as Step)}
              icon={<ArrowLeft size={18} />}
            >
              Back
            </Button>
          ) : null}
          {step < 2 ? (
            <Button
              fullWidth
              size="lg"
              onClick={() => setStep((current) => (current + 1) as Step)}
              disabled={step === 0 && selected.length === 0}
              icon={<ArrowRight size={18} />}
            >
              {step === 0 && selected.length === 0 ? 'Pick at least one interest' : 'Continue'}
            </Button>
          ) : (
            <Button fullWidth size="lg" loading={saving} onClick={() => void finish()}>
              Save & Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
