import { Suspense } from 'react'
import ClaimedIssuesClient from './ClaimedIssuesClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading claimed issues…</div>}>
      <ClaimedIssuesClient />
    </Suspense>
  )
}
