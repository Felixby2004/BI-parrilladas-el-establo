interface PlaceholderPageProps {
  phase: string
  emoji: string
  description: string
  comingSoon?: boolean
}

export function PlaceholderPage({ phase, emoji, description, comingSoon }: PlaceholderPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[70vh] animate-fade-in">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6 animate-float">{emoji}</div>
        <h1 className="font-display font-bold text-3xl text-arena-200 mb-3">{phase}</h1>
        <p className="text-dark-300 mb-6 text-sm leading-relaxed">{description}</p>
        {comingSoon && (
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-dark-600 border border-dark-400 text-dark-300 text-sm">
            🚧 En construcción — Próxima fase
          </span>
        )}
      </div>
    </div>
  )
}
