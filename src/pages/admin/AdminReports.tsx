import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/hooks/useToast'
import { listProblemReports, setReportStatus } from '@/services/feedbackService'
import { formatDateTime } from '@/utils/format'
import type { ProblemReport } from '@/types'

type Tab = 'open' | 'resolved' | 'all'

export default function AdminReportsPage() {
  const { success, error: toastError } = useToast()
  const [tab, setTab] = useState<Tab>('open')
  const [reports, setReports] = useState<ProblemReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listProblemReports(tab)
      .then(setReports)
      .catch(() => setError('We could not load reports.'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(load, [load])

  const toggleStatus = async (report: ProblemReport) => {
    setBusyId(report.id)
    const next = report.status === 'open' ? 'resolved' : 'open'
    try {
      await setReportStatus(report.id, next)
      success(next === 'resolved' ? 'Marked as resolved.' : 'Reopened.')
      load()
    } catch {
      toastError('Could not update that report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Reports</h1>
        <p className="mt-1 text-ink-500">Problems members have reported from Settings.</p>
      </header>

      <div className="mb-5 max-w-sm">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : reports.length ? (
        <ul className="space-y-3">
          {reports.map((report) => (
            <Card as="li" key={report.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink-900">
                      {report.subject || 'No subject'}
                    </p>
                    <Badge tone={report.status === 'open' ? 'warning' : 'success'}>
                      {report.status === 'open' ? 'Open' : 'Resolved'}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink-700">{report.message}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    {report.email || 'no email'} · {formatDateTime(report.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busyId === report.id}
                  icon={report.status === 'open' ? <CheckCircle2 size={15} /> : <RotateCcw size={15} />}
                  onClick={() => void toggleStatus(report)}
                >
                  {report.status === 'open' ? 'Resolve' : 'Reopen'}
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="📮"
          title={tab === 'open' ? 'Nothing to deal with' : 'No reports'}
          description="Reports members send from Settings land here."
        />
      )}
    </div>
  )
}
