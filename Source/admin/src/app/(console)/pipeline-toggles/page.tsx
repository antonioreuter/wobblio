import { PipelineTogglesSection } from './pipeline-toggles-section'

export default function PipelineTogglesPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">Pipeline Toggles</h1>
        <p className="text-sm text-muted">
          Switch ingestion between the legacy and agentic pipelines at runtime, with an audit
          trail — no deploy, instant rollback.
        </p>
      </header>
      <PipelineTogglesSection />
    </div>
  )
}
