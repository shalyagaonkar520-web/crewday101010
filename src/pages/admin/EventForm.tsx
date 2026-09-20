import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Link2, Rocket, Save, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea, Toggle } from "@/components/ui/Field";
import { InlineAlert, LoadingScreen } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { createEvent, getEvent, updateEvent } from "@/services/eventService";
import { deleteStoredFile } from "@/services/storageService";
import { notifyEventAudience } from "@/services/notificationService";
import { trackSync } from "@/services/analyticsService";
import { DEFAULT_CURRENCY, EVENT_CATEGORIES } from "@/utils/constants";
import { formatPrice, isoDaysFromNow } from "@/utils/format";
import {
  hasErrors,
  validateEventDraft,
  type FieldErrors,
} from "@/utils/validation";
import type { EventAudienceType, EventDraft, EventStatus } from "@/types";

const PRICE_PRESETS = [0, 99, 199, 499, 999];

function emptyDraft(): EventDraft {
  return {
    title: "",
    description: "",
    imageURL: "",
    imagePath: "",
    category: "",
    date: isoDaysFromNow(7),
    startTime: "17:00",
    endTime: "",
    venue: "",
    address: "",
    // CrewDay is launching in one neighbourhood, so new events default there
    // rather than starting blank. Both remain editable.
    city: "Bengaluru",
    area: "Electronic City",
    mapsURL: "",
    capacity: 50,
    price: 0,
    currency: DEFAULT_CURRENCY,
    eventTypes: ["both"],
    status: "draft",
    featured: false,
    waitlistEnabled: true,
    tags: [],
  };
}

export default function EventFormPage() {
  const { eventId } = useParams();
  const isEdit = Boolean(eventId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success } = useToast();

  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [originalImagePath, setOriginalImagePath] = useState("");
  const [originalStatus, setOriginalStatus] = useState<EventStatus>("draft");
  const [originalDateTime, setOriginalDateTime] = useState("");
  const [originalVenue, setOriginalVenue] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [checkingLink, setCheckingLink] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<EventDraft>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [imageLinkError, setImageLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    getEvent(eventId)
      .then((event) => {
        if (cancelled) return;
        if (!event) {
          setFormError("That event no longer exists.");
          return;
        }
        setDraft({
          title: event.title,
          description: event.description,
          imageURL: event.imageURL,
          imagePath: event.imagePath,
          category: event.category,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          venue: event.venue,
          address: event.address,
          city: event.city,
          area: event.area,
          mapsURL: event.mapsURL,
          capacity: event.capacity,
          price: event.price,
          currency: event.currency,
          eventTypes: event.eventTypes,
          status: event.status,
          featured: event.featured,
          waitlistEnabled: event.waitlistEnabled,
          tags: event.tags,
        });
        setTagsInput(event.tags.join(", "));
        setOriginalImagePath(event.imagePath);
        setOriginalStatus(event.status);
        setOriginalDateTime(`${event.date}T${event.startTime}`);
        setOriginalVenue(event.venue);
      })
      .catch(() => {
        if (!cancelled) setFormError("We could not load this event.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const patch = (next: Partial<EventDraft>) =>
    setDraft((current) => ({ ...current, ...next }));

  // A pasted link is used as-is: nothing is uploaded, and `imagePath` stays
  // empty so nothing is ever deleted from Storage for it. The browser loading
  // the picture is the validation — a link that does not show an image is
  // refused before it can reach the event.
  const applyImageLink = async () => {
    const value = imageLink.trim();
    if (!value) return;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      setImageLinkError(
        "That does not look like a link. It should start with https://",
      );
      return;
    }
    if (url.protocol !== "https:") {
      setImageLinkError("Image links must start with https://");
      return;
    }
    setImageLinkError(null);
    setCheckingLink(true);
    const loads = await new Promise<boolean>((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = url.href;
    });
    setCheckingLink(false);
    if (!loads) {
      setImageLinkError(
        "That link does not open as an image. Use a direct link to the picture (ending in .jpg, .png or .webp usually).",
      );
      return;
    }
    if (draft.imagePath && draft.imagePath !== originalImagePath) {
      await deleteStoredFile(draft.imagePath);
    }
    patch({ imageURL: url.href, imagePath: "" });
    setImageLink("");
    success("Image link added. Remember to save.");
  };

  const removeImage = async () => {
    // Only delete from Storage if this upload is not the one already saved on
    // the event — otherwise an abandoned edit would break the live listing.
    if (draft.imagePath && draft.imagePath !== originalImagePath) {
      await deleteStoredFile(draft.imagePath);
    }
    patch({ imageURL: "", imagePath: "" });
  };

  const save = async (mode: "draft" | "publish") => {
    if (!user) return;

    const status: EventStatus =
      mode === "publish"
        ? "open"
        : draft.status === "open" || draft.status === "closed"
          ? draft.status
          : "draft";

    const candidate: EventDraft = { ...draft, status };
    const validation = validateEventDraft(candidate);
    setErrors(validation);
    if (hasErrors(validation)) {
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setFormError(null);
    setSaving(mode);
    try {
      if (isEdit && eventId) {
        await updateEvent(eventId, candidate);

        // Tell attendees when something they planned around actually moved.
        const timeChanged =
          originalDateTime !== `${candidate.date}T${candidate.startTime}`;
        const venueChanged = originalVenue !== candidate.venue;
        if ((timeChanged || venueChanged) && originalStatus !== "draft") {
          await notifyEventAudience({
            eventId,
            type: "event_updated",
            title: `${candidate.title} has been updated`,
            body: timeChanged
              ? `New time: ${candidate.date} at ${candidate.startTime}.`
              : `New venue: ${candidate.venue}.`,
          }).catch(() => undefined);
        }

        if (mode === "publish" && originalStatus !== "open") {
          trackSync("event_published", { eventId });
        }
        success(
          mode === "publish"
            ? "Event published. It is live now."
            : "Changes saved.",
        );
        navigate("/admin/events");
      } else {
        const createdId = await createEvent(candidate, user.uid);
        if (mode === "publish")
          trackSync("event_published", { eventId: createdId });
        success(
          mode === "publish"
            ? "Event published. It is live in the app now."
            : "Draft saved. Publish it when you are ready.",
        );
        navigate("/admin/events");
      }
    } catch {
      setFormError(
        "We could not save this event. Check your connection and try again.",
      );
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <LoadingScreen label="Loading event…" />;

  const audienceOptions: {
    value: EventAudienceType;
    emoji: string;
    label: string;
    hint: string;
  }[] = [
    {
      value: "participant",
      emoji: "🎤",
      label: "Participant",
      hint: "People who perform or play",
    },
    {
      value: "audience",
      emoji: "👀",
      label: "Audience",
      hint: "People who come to watch",
    },
    {
      value: "both",
      emoji: "🤝",
      label: "Both",
      hint: "Attendee picks at registration",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/admin/events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} aria-hidden /> All events
      </Link>

      <h1 className="font-display text-3xl font-extrabold text-ink-900">
        {isEdit ? "Edit event" : "Create Event"}
      </h1>
      <p className="mt-1 text-ink-500">
        {isEdit
          ? "Changes go live as soon as you save."
          : "Published events appear in the user app immediately."}
      </p>

      {formError ? (
        <div className="mt-5">
          <InlineAlert tone="danger">{formError}</InlineAlert>
        </div>
      ) : null}

      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void save("publish");
        }}
        className="mt-6 space-y-6"
        noValidate
      >
        {/* Basics */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">
            The basics
          </h2>

          <Input
            label="Event name"
            required
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            error={errors.title}
            placeholder="Sunday Guitar Jam"
          />

          <Textarea
            label="Description"
            required
            rows={6}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
            error={errors.description}
            placeholder={
              "What happens at this event?\n\nWho should come?\nWhat should they bring?"
            }
            hint="Line breaks are preserved."
          />

          <Select
            label="Category"
            required
            placeholder="Choose a category"
            value={draft.category}
            onChange={(event) => patch({ category: event.target.value })}
            error={errors.category}
            options={EVENT_CATEGORIES.map((category) => ({
              value: category,
              label: category,
            }))}
          />

          <Input
            label="Tags"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            onBlur={() =>
              patch({
                tags: tagsInput
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            hint="Comma separated. Tags improve search, e.g. acoustic, beginners welcome."
            placeholder="acoustic, beginners, open mic"
          />
        </Card>

        {/* Image */}
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              Event image
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Paste a link to the poster. Right-click a picture anywhere on the
              web and choose “Copy image address”.
            </p>
          </div>

          {draft.imageURL ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={draft.imageURL}
                alt=""
                className="aspect-16/9 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => void removeImage()}
                className="absolute top-3 right-3 rounded-full bg-ink-950/70 p-2 text-white transition hover:bg-ink-950"
                aria-label="Remove image"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  value={imageLink}
                  onChange={(event) => {
                    setImageLink(event.target.value);
                    if (imageLinkError) setImageLinkError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void applyImageLink();
                    }
                  }}
                  placeholder="https://…"
                  aria-label="Image link"
                  inputMode="url"
                  autoComplete="off"
                  leading={<Link2 size={16} aria-hidden />}
                  error={imageLinkError ?? undefined}
                  hint={checkingLink ? "Checking the link…" : undefined}
                />
              </div>
              <Button
                type="button"
                className="h-12 shrink-0"
                onClick={() => void applyImageLink()}
                loading={checkingLink}
                disabled={!imageLink.trim() || checkingLink}
              >
                Use link
              </Button>
            </div>
          )}

          <p className="text-xs text-ink-500">
            The picture is shown straight from its source, so keep it online for
            as long as the event is listed. Without an image the card falls back
            to a branded gradient.
          </p>
        </Card>

        {/* When */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">When</h2>
          <p className="-mt-2 text-sm text-ink-500">
            Any date works — Sundays, Saturdays, festivals, weekdays or one-off
            workshops.
          </p>

          <Input
            type="date"
            label="Date"
            required
            value={draft.date}
            onChange={(event) => patch({ date: event.target.value })}
            error={errors.date}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="time"
              label="Start time"
              required
              value={draft.startTime}
              onChange={(event) => patch({ startTime: event.target.value })}
              error={errors.startTime}
            />
            <Input
              type="time"
              label="End time"
              value={draft.endTime}
              onChange={(event) => patch({ endTime: event.target.value })}
              error={errors.endTime}
              hint="Optional"
            />
          </div>
        </Card>

        {/* Where */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Where</h2>

          <Input
            label="Venue name"
            required
            value={draft.venue}
            onChange={(event) => patch({ venue: event.target.value })}
            error={errors.venue}
            placeholder="The Hangout Café"
          />
          <Textarea
            label="Full address"
            required
            rows={3}
            value={draft.address}
            onChange={(event) => patch({ address: event.target.value })}
            error={errors.address}
            placeholder="Neeladri Rd, Electronic City Phase 1, Bengaluru 560100"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="City"
              required
              value={draft.city}
              onChange={(event) => patch({ city: event.target.value })}
              error={errors.city}
              placeholder="Bengaluru"
            />
            <Input
              label="Area"
              value={draft.area}
              onChange={(event) => patch({ area: event.target.value })}
              placeholder="Electronic City"
            />
          </div>
          <Input
            type="url"
            label="Google Maps link"
            value={draft.mapsURL}
            onChange={(event) => patch({ mapsURL: event.target.value })}
            error={errors.mapsURL}
            hint="Optional"
            placeholder="https://maps.app.goo.gl/…"
          />
        </Card>

        {/* Capacity and price */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">
            Seats & price
          </h2>

          <Input
            type="number"
            label="Maximum capacity"
            required
            min={1}
            value={String(draft.capacity)}
            onChange={(event) =>
              patch({ capacity: Number(event.target.value) })
            }
            error={errors.capacity}
            hint="Registration stops automatically once this is reached."
          />

          <div>
            <Input
              type="number"
              label="Price"
              required
              min={0}
              value={String(draft.price)}
              onChange={(event) => patch({ price: Number(event.target.value) })}
              error={errors.price}
              leading={<span className="font-semibold">₹</span>}
              hint={`Enter 0 for a free event. Currently: ${formatPrice(draft.price, draft.currency)}`}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {PRICE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => patch({ price: preset })}
                  className={clsx(
                    "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
                    draft.price === preset
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:border-brand-300",
                  )}
                >
                  {preset === 0 ? "Free" : `₹${preset}`}
                </button>
              ))}
            </div>
            {draft.price > 0 ? (
              <div className="mt-3">
                <InlineAlert tone="warning">
                  Paid registrations are held as{" "}
                  <strong>payment pending</strong> until a payment provider
                  confirms them — they are never auto-confirmed.
                </InlineAlert>
              </div>
            ) : null}
          </div>

          <Toggle
            label="Enable waitlist"
            description="When the event sells out, let people queue for a freed seat."
            checked={draft.waitlistEnabled}
            onChange={(next) => patch({ waitlistEnabled: next })}
          />
        </Card>

        {/* Who */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">
            Who can join
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            {audienceOptions.map((option) => {
              const active = draft.eventTypes[0] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => patch({ eventTypes: [option.value] })}
                  aria-pressed={active}
                  className={clsx(
                    "rounded-2xl border-2 p-4 text-left transition",
                    active
                      ? "border-brand-600 bg-brand-50"
                      : "border-ink-200 bg-white hover:border-brand-300",
                  )}
                >
                  <span className="text-2xl" aria-hidden>
                    {option.emoji}
                  </span>
                  <p className="mt-1.5 font-bold text-ink-900">
                    {option.label}
                  </p>
                  <p className="text-xs text-ink-500">{option.hint}</p>
                </button>
              );
            })}
          </div>
          {errors.eventTypes ? (
            <p className="text-sm font-medium text-sunset-700">
              {errors.eventTypes}
            </p>
          ) : null}

          <Toggle
            label="Featured event"
            description="Pin this to the featured rail on the home screen."
            checked={draft.featured}
            onChange={(next) => patch({ featured: next })}
          />
        </Card>

        {/* Status + actions */}
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">
            Registration status
          </h2>
          <Select
            label="Status"
            value={draft.status}
            onChange={(event) =>
              patch({ status: event.target.value as EventStatus })
            }
            options={[
              { value: "draft", label: "Draft — hidden from the app" },
              {
                value: "open",
                label: "Open — visible, accepting registrations",
              },
              {
                value: "closed",
                label: "Closed — visible, registration closed",
              },
              ...(isEdit
                ? [
                    {
                      value: "completed",
                      label: "Completed — event has happened",
                    },
                    { value: "cancelled", label: "Cancelled" },
                  ]
                : []),
            ]}
          />
        </Card>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-ink-100 bg-ink-50 py-4 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            size="lg"
            icon={<Save size={18} />}
            loading={saving === "draft"}
            disabled={saving !== null}
            onClick={() => void save("draft")}
          >
            {isEdit ? "Save changes" : "Save as draft"}
          </Button>
          <Button
            type="submit"
            className="sm:flex-1"
            size="lg"
            icon={<Rocket size={18} />}
            loading={saving === "publish"}
            disabled={saving !== null}
          >
            Publish event
          </Button>
        </div>
      </form>
    </div>
  );
}
