import type { FirebaseStorage } from 'firebase/storage'
import { firebaseApp, useEmulators } from '@/firebase/config'

/**
 * `firebase/storage` is imported on demand. Only organisers upload, so paying
 * for it in every member's first load was pure weight.
 */
let storagePromise: Promise<FirebaseStorage> | null = null

function getStorageLazily(): Promise<FirebaseStorage> {
  storagePromise ??= import('firebase/storage').then(({ getStorage, connectStorageEmulator }) => {
    const instance = getStorage(firebaseApp)
    if (useEmulators) connectStorageEmulator(instance, '127.0.0.1', 9199)
    // The SDK's defaults retry a failed upload for ten minutes, which is what
    // left the admin form on "Uploading… 0%" indefinitely. Give up in well
    // under a minute and let the error reach the person instead.
    instance.maxUploadRetryTime = 30_000
    instance.maxOperationRetryTime = 15_000
    return instance
  })
  return storagePromise
}

/**
 * `imagePath` value for an image that is stored inside the Firestore document
 * (as a data URL in `imageURL`) rather than in Cloud Storage. See
 * `storageAvailable`.
 */
export const INLINE_IMAGE_PATH = 'inline'

export function isInlineImage(path: string | undefined | null): boolean {
  return path === INLINE_IMAGE_PATH
}

/**
 * Whether the project has a Cloud Storage bucket at all.
 *
 * On the free plan a project created after October 2024 gets no default
 * bucket; uploads then fail with 404 and the resumable-upload SDK retries them
 * for ages, so the progress bar never moved off 0%. A one-off probe answers
 * the question in one round trip: 404 means no bucket, anything else (200 or
 * 403 from the rules) means it exists. Without a bucket, images are shrunk hard
 * and saved inside the event document instead, so organisers can still put a
 * poster on an event today and nothing else has to change.
 */
let availabilityPromise: Promise<boolean> | null = null

export function storageAvailable(): Promise<boolean> {
  availabilityPromise ??= (async () => {
    if (useEmulators) return true
    const bucket = firebaseApp.options.storageBucket
    if (!bucket) return false
    try {
      const response = await fetch(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=1`,
        { method: 'GET' },
      )
      return response.status !== 404
    } catch {
      // Offline or blocked: let the SDK try and report its own error.
      return true
    }
  })()
  return availabilityPromise
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Budget for an inline image. Firestore documents are capped at 1 MiB and the
 * event document already carries description and search tokens; every card on
 * Explore downloads its image too, so smaller is better on both counts.
 */
const INLINE_BUDGET_BYTES = 280 * 1024

export interface UploadResult {
  url: string
  path: string
}

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, WebP or AVIF image.'
  if (file.size > MAX_BYTES) return 'Image must be smaller than 5 MB.'
  return null
}

/** Decode, scale to fit `maxEdge` and re-encode as WebP. Null if the browser cannot. */
async function renderWebp(file: Blob, maxEdge: number, quality: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return null
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )
  } catch {
    return null
  }
}

/**
 * Downscale in the browser before upload.
 *
 * Event images are shown at card and hero sizes, so a 4 MB phone photo is pure
 * waste — this keeps Storage costs and mobile load times down. Falls back to
 * the original file if the browser cannot decode it.
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  if (file.size < 600 * 1024) {
    try {
      const bitmap = await createImageBitmap(file)
      const fits = Math.max(bitmap.width, bitmap.height) <= maxEdge
      bitmap.close()
      if (fits) return file
    } catch {
      return file
    }
  }
  const blob = await renderWebp(file, maxEdge, quality)
  return blob && blob.size < file.size ? blob : file
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Shrink until the image fits the inline budget, then return it as a data URL.
 * Posters with text stay legible at 1000 px; photos rarely need less than 800.
 */
async function encodeInline(file: File, startEdge: number): Promise<string> {
  const edges = [startEdge, 1000, 800, 640, 480].filter((edge) => edge <= startEdge)
  let best: Blob | null = null
  for (const edge of edges) {
    for (const quality of [0.74, 0.6]) {
      const blob = await renderWebp(file, edge, quality)
      if (!blob) continue
      if (!best || blob.size < best.size) best = blob
      if (blob.size <= INLINE_BUDGET_BYTES) return blobToDataURL(blob)
    }
  }
  if (best && best.size <= INLINE_BUDGET_BYTES * 1.5) return blobToDataURL(best)
  throw new Error('That image is too detailed to save without Cloud Storage. Try a simpler or smaller one.')
}

function extensionFor(blob: Blob, fallback: string): string {
  if (blob.type === 'image/webp') return 'webp'
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/avif') return 'avif'
  if (blob.type === 'image/jpeg') return 'jpg'
  return fallback
}

async function upload(
  path: string,
  blob: Blob,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const [storage, { ref, uploadBytesResumable, getDownloadURL }] = await Promise.all([
    getStorageLazily(),
    import('firebase/storage'),
  ])
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
  })

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) =>
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => {
        const code = 'code' in error ? String(error.code) : ''
        reject(
          new Error(
            code === 'storage/unauthorized'
              ? 'You are not allowed to upload images. Only organisers can.'
              : code === 'storage/retry-limit-exceeded' || code === 'storage/unknown'
                ? 'The upload could not reach Cloud Storage. Check your connection and try again.'
                : 'Upload failed.',
          ),
        )
      },
      () => resolve(),
    )
  })

  return { url: await getDownloadURL(task.snapshot.ref), path }
}

async function uploadOrInline(
  file: File,
  options: { path: string; maxEdge: number; quality: number },
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const error = validateImage(file)
  if (error) throw new Error(error)

  if (!(await storageAvailable())) {
    onProgress?.(10)
    const url = await encodeInline(file, options.maxEdge)
    onProgress?.(100)
    return { url, path: INLINE_IMAGE_PATH }
  }

  const blob = await compressImage(file, options.maxEdge, options.quality)
  return upload(`${options.path}.${extensionFor(blob, 'jpg')}`, blob, onProgress)
}

export function uploadEventImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return uploadOrInline(
    file,
    { path: `events/${crypto.randomUUID()}`, maxEdge: 1600, quality: 0.82 },
    onProgress,
  )
}

export function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  // Storage rules scope this folder to the owning user.
  return uploadOrInline(
    file,
    { path: `avatars/${uid}/${crypto.randomUUID()}`, maxEdge: 512, quality: 0.85 },
    onProgress,
  )
}

export async function deleteStoredFile(path: string): Promise<void> {
  if (!path || isInlineImage(path)) return
  try {
    const [storage, { ref, deleteObject }] = await Promise.all([
      getStorageLazily(),
      import('firebase/storage'),
    ])
    await deleteObject(ref(storage, path))
  } catch {
    // A missing object is not an error worth surfacing to the admin.
  }
}
