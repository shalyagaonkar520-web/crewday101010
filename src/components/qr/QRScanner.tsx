import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, SwitchCamera } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InlineAlert } from '@/components/ui/Feedback'

const REGION_ID = 'crewday-qr-region'

export interface QRScannerProps {
  /** Called for every decoded string. The parent decides what is valid. */
  onScan: (value: string) => void
  /** Pause decoding while the parent shows a result. */
  paused?: boolean
}

/**
 * Live camera QR scanner backed by `html5-qrcode`.
 *
 * The library is imported lazily so the ~300 KB decoder never loads for people
 * who are not checking anyone in, and the scanner is torn down properly on
 * unmount — a leaked camera stream keeps the phone's LED on and drains battery.
 */
export function QRScanner({ onScan, paused }: QRScannerProps) {
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const runningRef = useRef(false)
  const onScanRef = useRef(onScan)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Kept in a ref so restarting the camera is never needed just because the
  // parent re-rendered with a new callback identity.
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const stop = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      if (runningRef.current) await scanner.stop()
      scanner.clear()
    } catch {
      // Already stopped — nothing to clean up.
    }
    runningRef.current = false
    scannerRef.current = null
    setActive(false)
  }, [])

  const start = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
    setError(null)
    setStarting(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      await stop()

      const scanner = new Html5Qrcode(REGION_ID, { verbose: false })
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: mode },
        {
          fps: 10,
          qrbox: (width, height) => {
            const edge = Math.floor(Math.min(width, height) * 0.7)
            return { width: edge, height: edge }
          },
          aspectRatio: 1,
        },
        (decoded) => onScanRef.current(decoded),
        () => {
          // Per-frame "no QR found" callback — intentionally silent.
        },
      )
      runningRef.current = true
      setActive(true)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(
        /permission|NotAllowed/i.test(message)
          ? 'Camera access was blocked. Allow camera permission in your browser settings and try again.'
          : /NotFound|no camera/i.test(message)
            ? 'No camera was found on this device.'
            : 'The camera could not be started. Check that no other app is using it.',
      )
      await stop()
    } finally {
      setStarting(false)
    }
    },
    [facingMode, stop],
  )

  // Always release the camera when the screen goes away.
  useEffect(() => () => void stop(), [stop])

  // Pausing keeps the preview alive but stops decoding, so the result screen
  // does not get overwritten by the same ticket being re-read 10 times a second.
  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || !runningRef.current) return
    try {
      if (paused) scanner.pause(true)
      else scanner.resume()
    } catch {
      // Pause/resume throws if the scanner is mid-transition; safe to ignore.
    }
  }, [paused])

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-card bg-ink-950">
        <div id={REGION_ID} className="min-h-[260px] w-full [&_video]:!w-full [&_video]:object-cover" />

        {!active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera size={32} className="text-white/70" aria-hidden />
            <p className="text-sm text-white/70">
              Start the camera and point it at the attendee&apos;s CrewDay QR code.
            </p>
            <Button onClick={() => void start()} loading={starting} icon={<Camera size={18} />}>
              Start scanning
            </Button>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(11,11,18,0.45)]" />
          </div>
        )}
      </div>

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      {active ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void stop()} icon={<CameraOff size={16} />} size="sm">
            Stop camera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<SwitchCamera size={16} />}
            onClick={() => {
              const next = facingMode === 'environment' ? 'user' : 'environment'
              setFacingMode(next)
              void start(next)
            }}
          >
            Flip camera
          </Button>
        </div>
      ) : null}
    </div>
  )
}
