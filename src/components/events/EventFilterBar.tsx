import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Tabs'
import { EMPTY_FILTERS, type DateFilter, type EventFilters } from '@/types'
import { EVENT_CATEGORIES } from '@/utils/constants'

const DATE_CHIPS: { value: DateFilter; label: string }[] = [
  { value: 'any', label: 'Anytime' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'sunday', label: 'Sundays' },
  { value: 'custom', label: 'Pick dates' },
]

/**
 * The filter form. It edits a local draft and only calls `onChange` on Apply,
 * so half-typed values never trigger a Firestore query.
 *
 * `embedded` exists because the caller supplies the surface — Explore renders
 * this inside its own sheet rather than the component owning a modal.
 */
export function EventFilterBar({
  filters,
  onChange,
  cities,
  embedded = false,
}: {
  filters: EventFilters
  onChange: (filters: EventFilters) => void
  cities: string[]
  embedded?: boolean
}) {
  const [draft, setDraft] = useState(filters)

  useEffect(() => setDraft(filters), [filters])

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-5 rounded-card bg-white p-5 shadow-soft'}>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-800">When</p>
        <div className="flex flex-wrap gap-2">
          {DATE_CHIPS.map((chip) => (
            <Chip
              key={chip.value}
              active={draft.dateFilter === chip.value}
              onClick={() => setDraft({ ...draft, dateFilter: chip.value })}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      </div>

      {draft.dateFilter === 'custom' ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label="From"
            value={draft.customDateFrom}
            onChange={(event) => setDraft({ ...draft, customDateFrom: event.target.value })}
          />
          <Input
            type="date"
            label="To"
            value={draft.customDateTo}
            onChange={(event) => setDraft({ ...draft, customDateTo: event.target.value })}
          />
        </div>
      ) : null}

      <Select
        label="Category"
        placeholder="All categories"
        value={draft.category}
        onChange={(event) => setDraft({ ...draft, category: event.target.value })}
        options={EVENT_CATEGORIES.map((category) => ({ value: category, label: category }))}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-ink-800">Price</p>
        <div className="flex flex-wrap gap-2">
          {(['any', 'free', 'paid', 'custom'] as const).map((value) => (
            <Chip
              key={value}
              active={draft.priceFilter === value}
              onClick={() => setDraft({ ...draft, priceFilter: value })}
            >
              {value === 'any' ? 'Any price' : value === 'custom' ? 'Custom range' : value}
            </Chip>
          ))}
        </div>
      </div>

      {draft.priceFilter === 'custom' ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            min={0}
            label="Min ₹"
            value={String(draft.priceMin)}
            onChange={(event) => setDraft({ ...draft, priceMin: Number(event.target.value) || 0 })}
          />
          <Input
            type="number"
            min={0}
            label="Max ₹"
            value={String(draft.priceMax)}
            onChange={(event) => setDraft({ ...draft, priceMax: Number(event.target.value) || 0 })}
          />
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-semibold text-ink-800">I want to join as</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={draft.role === 'any'} onClick={() => setDraft({ ...draft, role: 'any' })}>
            Either
          </Chip>
          <Chip
            active={draft.role === 'participant'}
            onClick={() => setDraft({ ...draft, role: 'participant' })}
          >
            🎤 Participant
          </Chip>
          <Chip
            active={draft.role === 'audience'}
            onClick={() => setDraft({ ...draft, role: 'audience' })}
          >
            👀 Audience
          </Chip>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="City"
          placeholder="Any city"
          value={draft.city}
          onChange={(event) => setDraft({ ...draft, city: event.target.value })}
          options={cities.map((city) => ({ value: city, label: city }))}
        />
        <Input
          label="Area"
          placeholder="e.g. Koramangala"
          value={draft.area}
          onChange={(event) => setDraft({ ...draft, area: event.target.value })}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          variant="ghost"
          onClick={() => setDraft({ ...EMPTY_FILTERS, search: draft.search })}
        >
          Reset
        </Button>
        <Button className="flex-1" onClick={() => onChange(draft)}>
          Show events
        </Button>
      </div>
    </div>
  )
}
