export function ConnectionError() {
  return (
    <div className="flex flex-col items-center justify-center mb-6 py-5">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-cyan-200 text-sm opacity-80">Waiting for aircraft to load...</p>
      <span className="text-xs text-cyan-400/70 mt-3 animate-pulse">Auto-reconnecting</span>
    </div>
  )
}
