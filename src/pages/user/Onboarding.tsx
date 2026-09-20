import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { InlineAlert, Spinner } from '@/components/ui/Feedback'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/hooks/useAuth'
import { bumpInterestUsage, createInterest, listInterestCatalogue } from '@/services/interestService'
import { completeOnboarding } from '@/services/userService'
import { trackSync } from '@/services/analyticsService'
import { validateProfileFields } from '@/utils/validation'
import type { Interest, ParticipationType } from '@/types'

type Step = 0 | 1 | 2

const STEP_TITLES = ['What are you into?', 'How do you want to join?', 'Where are you?']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

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
    // Never rejects: the seed catalogue is the floor.
    void listInterestCatalogue().then((list) => {
      if (cancelled) return
      setInterests(list)
      setLoadingInterests(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  // What is typed in the box but not yet added. Several can be typed at
  // once, separated by commas.
  const pendingCustom = useMemo(
    () =>
      [...new Set(customInterest.split(',').map((part) => part.trim()).filter(Boolean))].filter(
        (value) => !selected.some((entry) => entry.toLowerCase() === value.toLowerCase()),
      ),
    [customInterest, selected],
  )
  const canLeaveInterests = selected.length > 0 || pendingCustom.length > 0

  const addCustomInterest = () => {
    if (!user || pendingCustom.length === 0) return
    const values = pendingCustom
    // Selected locally straight away. Saving to the shared catalogue only
    // feeds the admin "popular interests" panel, may be refused by the rules,
    // and on a project whose write quota is spent would not be acknowledged
    // for hours - so it is never awaited and nothing the person typed is lost.
    setSelected((current) => [
      ...current,
      ...values.filter(
        (value) => !current.some((entry) => entry.toLowerCase() === value.toLowerCase()),
      ),
    ])
    setCustomInterest('')
    for (const value of values) {
      trackSync('interest_selected', { interest: value })
      createInterest({ name: value, custom: true, createdBy: user.uid })
        .then((created) =>
          setInterests((current) =>
            current.some((entry) => entry.id === created.id) ? current : [...current, created],
          ),
        )
        .catch(() => undefined)
    }
  }

  // Typing something and pressing Continue without Add is the most common
  // slip on this screen, so Continue adds it rather than losing it.
  const continueFromInterests = () => {
    addCustomInterest()
    setStep(1)
  }

  // Selected interests that are not tiles in the grid: the ones people typed.
  const customSelected = selected.filter(
    (entry) => !interests.some((interest) => interest.name === entry),
  )

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
      // The write lands in the local cache instantly and the profile listener
      // picks it up from there, so a slow or quota-throttled server must not
      // keep someone on this screen: after a few seconds, move on and let the
      // SDK finish syncing in the background.
      await Promise.race([
        completeOnboarding(user.uid, {
          name,
          phone,
          city,
          area,
          interests: selected,
          participationType,
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 4000)),
      ])
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
                    <Input
                      value={customInterest}
                      onChange={(event) => setCustomInterest(event.target.value)}
                      placeholder="Table tennis, pottery, chess…"
                      aria-label="Custom interest"
                      aria-describedby="custom-interest-help"
                      enterKeyHint="done"
                      className={clsx(pendingCustom.length && 'border-brand-400 ring-4 ring-brand-100')}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addCustomInterest()
                        }
                      }}
                    />
                    {/* The state of the box is spelled out. Something typed but
                        not yet a chip is the moment people wonder what to do. */}
                    {pendingCustom.length ? (
                      <p
                        id="custom-interest-help"
                        role="status"
                        className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-brand-700"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                          <Check size={11} strokeWidth={3} aria-hidden />
                        </span>
                        <span>
                          Got it. {pendingCustom.length === 1 ? `“${pendingCustom[0]}”` : 'These'} will
                          be added when you press Continue. Press Enter to add{' '}
                          {pendingCustom.length === 1 ? 'it' : 'them'} now.
                        </span>
                      </p>
                    ) : (
                      <p id="custom-interest-help" className="mt-2 text-sm text-ink-500">
                        Just type it. No button needed. Separate several with commas.
                      </p>
                    )}
                    {customSelected.length ? (
                      <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
                        {customSelected.map((entry) => (
                          <button
                            key={entry}
                            type="button"
                            onClick={() => toggle(entry)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white"
                            aria-label={`Remove ${entry}`}
                          >
                            <Check size={14} strokeWidth={3} aria-hidden />
                            {entry}
                          </button>
                        ))}
                      </div>
                    ) : null}
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
              onClick={() =>
                step === 0 ? continueFromInterests() : setStep((current) => (current + 1) as Step)
              }
              disabled={step === 0 && !canLeaveInterests}
              icon={<ArrowRight size={18} />}
            >
              {step === 0 && !canLeaveInterests
                ? 'Pick at least one interest'
                : step === 0 && pendingCustom.length
                  ? `Add ${pendingCustom.length === 1 ? `“${pendingCustom[0]}”` : `${pendingCustom.length} interests`} & continue`
                  : 'Continue'}
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
