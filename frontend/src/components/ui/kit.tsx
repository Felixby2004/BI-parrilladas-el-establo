import type { ReactNode } from 'react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { applyTheme, currentTheme } from '@/theme'

export type Tone = 'wine' | 'gold' | 'sage' | 'amber' | 'rose' | 'info' | 'neutral'

const TONES: Record<Tone, { icon: string; bar: string; text: string; badge: string }> = {
  wine:    { icon: 'border-vino-700/40 bg-vino-900/25 text-vino-300',       bar: 'bg-vino-500',  text: 'text-vino-300',  badge: 'border-vino-700/40 bg-vino-900/25 text-vino-200' },
  gold:    { icon: 'border-gold-500/30 bg-gold-500/10 text-gold-300',        bar: 'bg-gold-500',  text: 'text-gold-300',  badge: 'border-gold-500/30 bg-gold-500/10 text-gold-200' },
  sage:    { icon: 'border-sage-500/30 bg-sage-500/10 text-sage-300',        bar: 'bg-sage-500',  text: 'text-sage-300',  badge: 'border-sage-500/30 bg-sage-500/10 text-sage-200' },
  amber:   { icon: 'border-amber-500/30 bg-amber-500/10 text-amber-300',     bar: 'bg-amber-500', text: 'text-amber-300', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
  rose:    { icon: 'border-[#C46666]/30 bg-[#C46666]/10 text-[#E0A3A3]',     bar: 'bg-[#C46666]', text: 'text-[#E0A3A3]', badge: 'border-[#C46666]/30 bg-[#C46666]/10 text-[#E8B4B4]' },
  info:    { icon: 'border-[#6F9FC4]/30 bg-[#6F9FC4]/10 text-[#A8C6E0]',     bar: 'bg-[#6F9FC4]', text: 'text-[#A8C6E0]', badge: 'border-[#6F9FC4]/30 bg-[#6F9FC4]/10 text-[#BBD4E9]' },
  neutral: { icon: 'border-arena-200/10 bg-arena-200/[0.05] text-arena-300', bar: 'bg-arena-300', text: 'text-arena-300', badge: 'border-arena-200/10 bg-arena-200/[0.05] text-arena-300' },
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'wine',
  progress,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: Tone
  progress?: number
  className?: string
}) {
  const t = TONES[tone]
  const pct = Math.max(0, Math.min(100, progress ?? 0))

  return (
    <article className={clsx('stat-card group animate-slide-up', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-arena-400/75">
            {label}
          </p>
          <p className="mt-2 font-display text-[1.7rem] font-semibold leading-none tracking-tight text-arena-50 tabular">
            {value}
          </p>
        </div>
        {Icon && (
          <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-transform duration-300 group-hover:-translate-y-0.5', t.icon)}>
            <Icon size={18} strokeWidth={1.6} />
          </span>
        )}
      </div>
      {hint && <p className="mt-2.5 line-clamp-2 text-[11px] leading-snug text-arena-300/60">{hint}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-arena-200/[0.07]">
          <div className={clsx('h-full rounded-full transition-all duration-700', t.bar)} style={{ width: `${pct}%` }} />
        </div>
      )}
    </article>
  )
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; icon?: LucideIcon; badge?: ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      className={clsx(
        'inline-flex flex-wrap items-center gap-1 rounded-2xl border border-arena-200/10 bg-dark-800/70 p-1 backdrop-blur-sm',
        className,
      )}
    >
      {items.map(item => {
        const active = value === item.id
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200',
              active
                ? 'border border-vino-600/50 bg-vino-900 text-arena-50 shadow-glow-vino-sm'
                : 'border border-transparent text-arena-300/60 hover:bg-arena-200/[0.06] hover:text-arena-100',
            )}
          >
            {Icon && <Icon size={14} strokeWidth={1.8} />}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className={clsx(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular',
                active ? 'bg-black/25 text-arena-100' : 'bg-arena-200/[0.07] text-arena-300/80',
              )}>
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function StatusBadge({
  tone = 'neutral',
  children,
  dot = false,
  className,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold', TONES[tone].badge, className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', TONES[tone].bar)} />}
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  tone = 'wine',
  className,
}: {
  value: number
  tone?: Tone
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={clsx('h-1.5 overflow-hidden rounded-full bg-arena-200/[0.07]', className)}>
      <div className={clsx('h-full rounded-full transition-all duration-700', TONES[tone].bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-arena-200/10 bg-arena-200/[0.04] text-gold-400">
            <Icon size={17} strokeWidth={1.6} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-arena-50">{title}</h3>
          {description && <p className="mt-1 text-xs leading-relaxed text-arena-300/55">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-arena-200/10 bg-arena-200/[0.02] px-6 py-12 text-center', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-arena-200/10 bg-dark-800/70 text-gold-400">
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <p className="mt-4 font-display text-base font-semibold text-arena-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-arena-300/55">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-arena-200/[0.06]', className)} />
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState(currentTheme)
  const isLight = theme === 'light'
  const Icon = isLight ? Moon : Sun

  return (
    <button
      type="button"
      onClick={() => {
        const next = isLight ? 'dark' : 'light'
        applyTheme(next)
        setTheme(next)
      }}
      aria-label={isLight ? 'Activar modo oscuro' : 'Activar modo claro'}
      title={isLight ? 'Modo oscuro' : 'Modo claro'}
      className={clsx('btn-icon h-10 w-10', className)}
    >
      <Icon size={17} strokeWidth={1.8} />
    </button>
  )
}

export function IconTile({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span className={clsx(
      'grid shrink-0 place-items-center rounded-xl border',
      size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10',
      TONES[tone].icon,
      className,
    )}>
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 22 : 18} strokeWidth={1.6} />
    </span>
  )
}
