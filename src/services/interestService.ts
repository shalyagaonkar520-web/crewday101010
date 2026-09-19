import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '@/firebase/config'
import type { Interest } from '@/types'
import { slugify } from '@/utils/ids'
import { sanitiseText } from '@/utils/validation'
import { SEED_INTERESTS } from '@/utils/constants'

function mapInterest(snapshot: QueryDocumentSnapshot<DocumentData>): Interest {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name ?? snapshot.id,
    emoji: data.emoji ?? '✨',
    category: data.category ?? '',
    enabled: data.enabled !== false,
    custom: Boolean(data.custom),
    usageCount: data.usageCount ?? 0,
    createdAt: data.createdAt ?? null,
    createdBy: data.createdBy ?? '',
  }
}

export async function listInterests(includeDisabled = false): Promise<Interest[]> {
  const constraints = includeDisabled ? [] : [where('enabled', '==', true)]
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.interests), ...constraints, orderBy('name')),
  )
  return snapshot.docs.map(mapInterest)
}

export function subscribeToInterests(
  onChange: (interests: Interest[]) => void,
  includeDisabled = false,
): Unsubscribe {
  const constraints = includeDisabled ? [] : [where('enabled', '==', true)]
  return onSnapshot(
    query(collection(db, COLLECTIONS.interests), ...constraints, orderBy('name')),
    (snapshot) => onChange(snapshot.docs.map(mapInterest)),
  )
}

/**
 * Add an interest. Used both by the admin panel and by "add your own" during
 * onboarding — the latter marks the document `custom` so admins can curate it.
 * The slug is the document id, so two people typing "Table Tennis" converge on
 * one interest instead of creating duplicates.
 */
export async function createInterest(input: {
  name: string
  emoji?: string
  category?: string
  custom?: boolean
  createdBy: string
}): Promise<Interest> {
  const name = sanitiseText(input.name, 40)
  if (!name) throw new Error('Interest name is required.')
  const id = slugify(name)
  if (!id) throw new Error('That interest name cannot be used.')

  const ref = doc(db, COLLECTIONS.interests, id)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    return mapInterest(existing as QueryDocumentSnapshot<DocumentData>)
  }

  const payload = {
    name,
    emoji: input.emoji || '✨',
    category: input.category ?? '',
    enabled: true,
    custom: input.custom ?? false,
    usageCount: 0,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
  }
  await setDoc(ref, payload)
  const created = await getDoc(ref)
  return mapInterest(created as QueryDocumentSnapshot<DocumentData>)
}

export async function updateInterest(
  id: string,
  patch: Partial<Pick<Interest, 'name' | 'emoji' | 'category' | 'enabled' | 'custom'>>,
): Promise<void> {
  const clean: Record<string, unknown> = {}
  if (patch.name !== undefined) clean.name = sanitiseText(patch.name, 40)
  if (patch.emoji !== undefined) clean.emoji = patch.emoji
  if (patch.category !== undefined) clean.category = sanitiseText(patch.category, 40)
  if (patch.enabled !== undefined) clean.enabled = patch.enabled
  if (patch.custom !== undefined) clean.custom = patch.custom
  await updateDoc(doc(db, COLLECTIONS.interests, id), clean)
}

/**
 * Disabling hides an interest from onboarding but leaves it on existing
 * profiles, so nobody's saved data breaks. Deleting is only offered by the UI
 * when `usageCount` is 0.
 */
export async function deleteInterest(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.interests, id))
}

export async function bumpInterestUsage(ids: string[], delta = 1): Promise<void> {
  if (!ids.length) return
  const batch = writeBatch(db)
  for (const id of ids.slice(0, 30)) {
    batch.set(
      doc(db, COLLECTIONS.interests, id),
      { usageCount: increment(delta) },
      { merge: true },
    )
  }
  await batch.commit()
}

/**
 * Bootstrap an empty `interests` collection so the very first onboarding is
 * not a blank screen. Safe to call repeatedly: it no-ops once seeded. Requires
 * admin privileges, so it runs from the admin panel, not from user sign up.
 */
export async function seedInterestsIfEmpty(adminUid: string): Promise<number> {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.interests)))
  if (!snapshot.empty) return 0

  const batch = writeBatch(db)
  for (const seed of SEED_INTERESTS) {
    batch.set(doc(db, COLLECTIONS.interests, slugify(seed.name)), {
      name: seed.name,
      emoji: seed.emoji,
      category: seed.category,
      enabled: true,
      custom: false,
      usageCount: 0,
      createdAt: serverTimestamp(),
      createdBy: adminUid,
    })
  }
  await batch.commit()
  return SEED_INTERESTS.length
}
