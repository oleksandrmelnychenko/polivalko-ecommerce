import type { SyncRun } from '../api/integrationApi'

export function RunErrors({ run }: { run: SyncRun }) {
  return (
    <>
      <ol className="integration-errors">
        {run.errors.map((error, index) => (
          <li key={index}>
            {error.item ? <span className="integration-code">{error.item}</span> : null} {error.message}
          </li>
        ))}
      </ol>
      {run.errors.length < run.errorCount ? (
        <p className="integration-muted integration-note">
          Показано {run.errors.length} з {run.errorCount}.
        </p>
      ) : null}
    </>
  )
}
