import './FantacalcioShell.css'

export function FantacalcioShell({ onReturnToFpl }: { readonly onReturnToFpl: () => void }) {
  return (
    <main className="fantacalcio-shell">
      <div className="fantacalcio-shell-layout">
        <aside className="fantacalcio-sidebar" aria-label="Fantacalcio workspace">
          <span className="fantacalcio-brand-mark" aria-hidden="true">F</span>
          <div>
            <strong>Fantacalcio</strong>
            <span>Auction Assistant</span>
          </div>
          <p>Private workspace</p>
        </aside>
        <section className="fantacalcio-welcome" aria-labelledby="fantacalcio-title">
          <span className="fantacalcio-eyebrow">2026/27 · Workspace foundation</span>
          <h1 id="fantacalcio-title">Your auction space is ready.</h1>
          <p>The auction recorder and decision tools will arrive in later phases. There are no players, bids, or recommendations in this workspace yet.</p>
          <button type="button" onClick={onReturnToFpl}>Return to FPL Draft</button>
        </section>
      </div>
    </main>
  )
}
