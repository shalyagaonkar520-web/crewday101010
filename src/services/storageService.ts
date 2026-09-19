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
    return instance
  })
  return storagePromise
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export interface UploadResult {
  url: string
  path: string
}

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, WebP or AVIF image.'
  if (file.size > MAX_BYTES) return 'Image must be smaller than 5 MB.'
  return null
}

/**
 * Downscale in the browser before upload.
 *
 * Event images are shown at card and hero sizes, so a 4 MB phone photo is pure
 * waste — this keeps Storage costs and mobile load times down. Falls back to
 * the original file if the browser cannot decode it.
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
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
      reject,
      () => resolve(),
    )
  })

  return { url: await getDownloadURL(task.snapshot.ref), path }
}

export async function uploadEventImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const error = validateImage(file)
  if (error) throw new Error(error)
  const blob = await compressImage(file)
  const path = `events/${crypto.randomUUID()}.${extensionFor(blob, 'jpg')}`
  return upload(path, blob, onProgress)
}

export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const error = validateImage(file)
  if (error) throw new Error(error)
  const blob = await compressImage(file, 512, 0.85)
  // Storage rules scope this folder to the owning user.
  const path = `avatars/${uid}/${crypto.randomUUID()}.${extensionFor(blob, 'jpg')}`
  return upload(path, blob, onProgress)
}

export async function deleteStoredFile(path: string): Promise<void> {
  if (!path) return
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
