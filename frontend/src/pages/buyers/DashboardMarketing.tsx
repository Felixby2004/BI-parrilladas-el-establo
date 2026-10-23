import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, Check, Copy, ExternalLink, ImagePlus, KeyRound, LoaderCircle, Megaphone, RefreshCw, ScanLine, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { creativosService, type CreativeConfig, type CreativeResult, type FormatoCreativo } from '@/services/creativosService'
import { apiErrorMessage } from '@/services/errors'

const POMELLI_URL = 'https://labs.google.com/pomelli/about/'
const SUGGESTIONS = [
  { title: 'El corte protagonista', text: 'Una fotografía publicitaria vertical de un Tomahawk recién salido de la parrilla, corteza dorada, jugos visibles y humo sutil. Fondo de restaurante oscuro y elegante con luz cálida lateral. Enfoque cercano en la carne, sin personas ni precios inventados.' },
  { title: 'Domingo en familia', text: 'Fotografía publicitaria vertical de una parrillada abundante al centro de una mesa rústica, manos compartiendo comida y ambiente familiar cálido. Mostrar cortes, guarniciones y la experiencia de reunirse. Composición premium, natural y apetecible.' },
  { title: 'Una noche especial', text: 'Fotografía publicitaria vertical para una cena de celebración: un corte al punto en primer plano, copas al fondo desenfocadas y luz de fuego cálida. Ambiente íntimo, elegante y acogedor. Reservar aire en la parte superior para un titular corto.' },
]

function makeBrief(prompt: string, formato: FormatoCreativo, texto: string, cta: string) {
  return `BRIEF PUBLICITARIO · PARRILLADAS EL ESTABLO\n\nFormato: fotografía vertical ${formato}.\nEstilo: fotografía gastronómica realista, cálida, artesanal y premium.\nPaleta: vino #7F011F, arena #F5EBD0, dorado #C9A25A.\nComposición: una pieza final para redes, zona segura 12% arriba y abajo.\n\nIdea: ${prompt.trim()}\n\nTexto exacto: ${texto.trim() || 'Sin texto superpuesto'}.\nCTA: ${cta.trim() || 'Sin CTA superpuesto'}.\n\nNo inventar precios, promociones, direcciones, disponibilidad ni métricas. No usar logos de terceros. Revisar datos, texto y calidad antes de publicar.`
}

export default function DashboardMarketing() {
  const [config, setConfig] = useState<CreativeConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [configError, setConfigError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [formato, setFormato] = useState<FormatoCreativo>('9:16')
  const [texto, setTexto] = useState('El fuego tiene su punto. Tú, tu mesa.')
  const [cta, setCta] = useState('Reserva tu mesa')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState<CreativeResult | null>(null)
  const [resultUrl, setResultUrl] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [copied, setCopied] = useState(false)
  const brief = makeBrief(prompt, formato, texto, cta)

  const loadConfig = async () => {
    setLoadingConfig(true); setConfigError('')
    try { setConfig(await creativosService.configuracion()) }
    catch (e) { setConfig(null); setConfigError(apiErrorMessage(e, 'No se pudo consultar la configuración del estudio.')) }
    finally { setLoadingConfig(false) }
  }
  useEffect(() => { void loadConfig() }, [])
  useEffect(() => {
    if (!result) { setResultUrl(''); return }
    const bytes = Uint8Array.from(atob(result.imagen_base64), char => char.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: result.mime_type }))
    setResultUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])

  const copyBrief = async () => {
    setError(''); setNotice('')
    if (prompt.trim().length < 15) { setError('Escribe una idea de al menos 15 caracteres antes de copiar el brief.'); return }
    try {
      await navigator.clipboard.writeText(brief)
      setCopied(true); setNotice('Brief copiado. Puedes pegarlo en Pomelli con tu cuenta Google.')
      window.setTimeout(() => setCopied(false), 2500)
    } catch { setNotice('El navegador bloqueó el portapapeles. Abre «Ver brief», selecciona el texto y cópialo manualmente.') }
  }
  const generate = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('')
    if (!config?.configurado) { setShowSetup(true); setError('Falta configurar GEMINI_API_KEY en el backend. Puedes usar Pomelli externamente con el brief.'); return }
    if (!window.confirm('Se enviará este brief a Google Gemini para generar una fotografía. Puede consumir cuota o generar un coste en tu proyecto Google. ¿Continuar?')) return
    setGenerating(true)
    try { setResult(await creativosService.generar({ prompt, formato, texto_publicitario: texto, llamada_accion: cta })) }
    catch (e) { setError(apiErrorMessage(e, 'No se pudo generar la fotografía. No se mostrará una imagen de ejemplo como resultado.')) }
    finally { setGenerating(false) }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-col gap-4 border-b border-arena-200/[0.07] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Buyers / Campañas y contenido</p>
          <h1 className="page-title mt-2">Ideas que abren el apetito.</h1>
          <p className="page-subtitle">Estudio de fotografías publicitarias verticales. Escribe tu idea, define el formato y prepara tu próxima campaña.</p>
        </div>
        <a href={POMELLI_URL} target="_blank" rel="noreferrer" className="btn-secondary shrink-0 text-xs"><ExternalLink size={15} /> Abrir Google Labs Pomelli <ArrowUpRight size={13} /></a>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-arena-200/10 bg-dark-800/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={clsx('h-2 w-2 rounded-full', config?.configurado ? 'bg-sage-400' : 'bg-gold-400')} />
          <span className="text-arena-200">{loadingConfig ? 'Consultando conexión…' : config?.configurado ? 'Google Gemini configurado' : 'Generación en la app pendiente de credencial'}</span>
          {config?.configurado && <span className="hidden text-arena-400/60 sm:inline">· {config.modelo}</span>}
        </div>
        <button type="button" onClick={() => setShowSetup(!showSetup)} className="btn-ghost px-2 py-1 text-xs"><KeyRound size={13} /> {showSetup ? 'Ocultar configuración' : 'Credenciales y Pomelli'}</button>
      </div>
      {configError && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{configError}</p>}
      {showSetup && (
        <section className="card space-y-3 text-sm text-arena-300" aria-label="Configuración Google">
          <h2 className="font-semibold text-arena-100">Dos caminos, sin confundir las herramientas</h2>
          <p><strong className="text-gold-300">En esta app:</strong> generación mediante la API oficial de Gemini. Crea una clave en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline underline-offset-4">Google AI Studio</a>, habilita acceso/cuota al modelo de imágenes y configura el backend:</p>
          <pre className="overflow-x-auto rounded-xl bg-dark-950 p-3 text-xs text-arena-200">{'# backend/.env — nunca en VITE_*\nGEMINI_API_KEY=tu_clave_de_google\nGEMINI_IMAGE_MODEL=gemini-3.1-flash-image'}</pre>
          <p className="text-xs">Reinicia el backend después de editar el archivo. La clave no se envía al navegador ni se guarda en el brief. Google puede requerir facturación o no ofrecer el modelo en tu región/proyecto.</p>
          <p><strong className="text-gold-300">En Pomelli:</strong> abre su sitio e inicia sesión con Google. Copia el brief de aquí y pégalo allí. No se ha conectado una API de Pomelli: una clave de AI Studio no habilita automáticamente tu acceso a Pomelli.</p>
          <button type="button" className="btn-secondary py-2 text-xs" onClick={() => void loadConfig()} disabled={loadingConfig}><RefreshCw size={13} className={loadingConfig ? 'animate-spin' : ''} /> Volver a comprobar</button>
        </section>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form className="card space-y-6" onSubmit={generate}>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold-500/20 bg-gold-500/10 text-gold-300"><Sparkles size={20} /></span>
            <div><p className="eyebrow">On-brand studio</p><h2 className="mt-1 font-display text-xl text-arena-100">De tu prompt a una fotografía publicitaria</h2><p className="mt-1 text-xs text-arena-400">Una pieza vertical para Stories, estados de WhatsApp o publicaciones de campaña.</p></div>
          </div>
          <div>
            <label htmlFor="creative-prompt" className="label">¿Qué anuncio quieres crear?</label>
            <textarea id="creative-prompt" className="input-field min-h-[190px] resize-y leading-relaxed" placeholder="Describe el plato, el ambiente, la luz y la emoción. Por ejemplo: un Tomahawk a la brasa en primer plano, luz cálida, fondo oscuro y espacio para un titular…" value={prompt} onChange={event => setPrompt(event.target.value)} minLength={15} maxLength={5000} required disabled={generating} />
            <div className="mt-2 flex justify-between text-[10px] text-arena-400"><span>Tu idea manda. Sin selectores de cortes predefinidos.</span><span>{prompt.length}/5000</span></div>
            <div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map(item => <button type="button" key={item.title} disabled={generating} className="rounded-full border border-arena-200/10 px-3 py-1.5 text-[11px] text-arena-300 transition hover:border-gold-500/40 hover:text-gold-300" onClick={() => setPrompt(item.text)}>{item.title}</button>)}</div>
          </div>
          <fieldset disabled={generating}>
            <legend className="label">Formato vertical de salida</legend>
            <div className="grid grid-cols-2 gap-3">
              {(['9:16', '4:5'] as const).map(ratio => <button key={ratio} type="button" aria-pressed={formato === ratio} onClick={() => setFormato(ratio)} className={clsx('flex items-center gap-3 rounded-xl border p-3 text-left transition', formato === ratio ? 'border-gold-500/50 bg-gold-500/[0.07]' : 'border-arena-200/10 hover:border-arena-200/20')}><span className={clsx('block shrink-0 rounded border-2', formato === ratio ? 'border-gold-400' : 'border-arena-400/50')} style={{ width: ratio === '9:16' ? 18 : 25, height: 32 }} /><span><span className="block text-sm font-semibold text-arena-100">{ratio}</span><span className="text-[10px] text-arena-400">{ratio === '9:16' ? 'Stories y estados' : 'Feed vertical'}</span></span></button>)}
            </div>
          </fieldset>
          <div className="space-y-4">
            <div><label className="label" htmlFor="creative-copy">Texto sobre la fotografía · opcional</label><input id="creative-copy" className="input-field" value={texto} onChange={e => setTexto(e.target.value)} maxLength={300} disabled={generating} placeholder="Déjalo vacío si quieres solo la fotografía" /></div>
            <div><label className="label" htmlFor="creative-cta">Llamada a la acción · opcional</label><input id="creative-cta" className="input-field" value={cta} onChange={e => setCta(e.target.value)} maxLength={100} disabled={generating} /></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-arena-200/[0.07] bg-dark-900/50 p-3 text-xs text-arena-400"><span className="flex shrink-0 gap-1.5"><i className="h-4 w-4 rounded-full bg-[#7F011F]" /><i className="h-4 w-4 rounded-full bg-[#F5EBD0]" /><i className="h-4 w-4 rounded-full bg-[#C9A25A]" /></span><span>Identidad El Establo · fotografía cálida, vino, arena y dorado.</span></div>
          {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-gold-500/25 bg-gold-500/[0.06] p-3 text-xs text-gold-200">{notice}</p>}
          <div className="space-y-3">
            <button className="btn-primary w-full" type="submit" disabled={generating || loadingConfig || !config?.configurado}>{generating ? <LoaderCircle size={17} className="animate-spin" /> : <ImagePlus size={17} />}{generating ? 'Generando fotografía con Google…' : 'Generar fotografía vertical'}</button>
            {!config?.configurado && !loadingConfig && <p className="text-center text-xs text-gold-300">Configura la clave para generar aquí, o lleva tu brief a Pomelli.</p>}
            <button className="btn-secondary w-full text-xs" type="button" onClick={() => void copyBrief()} disabled={generating}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Brief copiado' : 'Copiar brief para Google Labs Pomelli'}</button>
            <p className="text-center text-[10px] leading-relaxed text-arena-400/60">Cada generación puede consumir cuota o tener un coste en Google. No se publica automáticamente ni se reintenta una solicitud fallida.</p>
          </div>
          <details className="border-t border-arena-200/10 pt-4"><summary className="cursor-pointer text-xs text-arena-300">Ver brief completo para campaña</summary><pre className="mt-3 whitespace-pre-wrap rounded-xl bg-dark-950 p-4 font-mono text-[11px] leading-relaxed text-arena-300">{brief}</pre></details>
        </form>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <div className="flex items-center justify-between"><div><p className="eyebrow">Vista de campaña</p><h2 className="mt-1 font-display text-lg text-arena-100">{result ? 'Tu fotografía generada' : 'El próximo antojo empieza aquí'}</h2></div><ScanLine size={18} className="text-gold-400" /></div>
          <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[24px] border border-arena-200/10 bg-dark-900 shadow-card">
            {result && resultUrl ? <img src={resultUrl} alt={`Fotografía publicitaria generada con IA para El Establo, ${result.formato}`} className="block h-auto w-full" /> : <div className="relative flex flex-col items-center justify-center gap-5 overflow-hidden p-8 text-center" style={{ aspectRatio: formato === '9:16' ? '9 / 16' : '4 / 5' }}><div className="absolute inset-0 bg-gradient-to-b from-vino-950/30 via-dark-900 to-dark-950" /><div className="relative grid h-20 w-20 place-items-center rounded-[24px] border border-gold-500/15 bg-gold-500/[0.04] text-gold-400/80">{generating ? <LoaderCircle size={32} className="animate-spin" /> : <ImagePlus size={32} strokeWidth={1.2} />}</div><div className="relative"><p className="font-display text-2xl text-arena-200">{generating ? 'Una idea toma forma.' : 'Tu idea. Nuestra esencia.'}</p><p className="mt-3 text-xs leading-relaxed text-arena-400">{generating ? 'Google está creando la pieza. Puede tardar hasta dos minutos.' : 'Aquí aparecerá la fotografía devuelta por Google. No es una imagen de muestra ni una simulación.'}</p></div><span className="relative rounded-full border border-arena-200/10 px-3 py-1 text-[10px] tracking-widest text-arena-400">FOTOGRAFÍA VERTICAL · {formato}</span></div>}
          </div>
          {result && resultUrl && <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-arena-400"><span>{result.ancho} × {result.alto} px · {result.formato}</span><span>{result.proveedor}</span></div><a className="btn-arena w-full text-xs" href={resultUrl} download={`el-establo-anuncio-${result.formato.replace(':', 'x')}.${result.mime_type === 'image/jpeg' ? 'jpg' : result.mime_type.split('/')[1]}`}><ArrowDownToLine size={15} /> Descargar fotografía</a><p className="text-[10px] leading-relaxed text-arena-400">{result.advertencia} El resultado permanece solo en esta sesión; descárgalo para conservarlo.</p>{generating && <p className="text-xs text-gold-300">La vista anterior se conserva mientras generas una nueva pieza.</p>}</div>}
          <div className="rounded-2xl border border-arena-200/[0.07] bg-dark-800/50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-arena-200"><Megaphone size={15} className="text-gold-400" /> Diseñado para campañas, no para gestionar contactos</div><p className="mt-2 text-xs leading-relaxed text-arena-400">Prepara tu fotografía, revisa los datos y úsala en tu campaña. El seguimiento de contactos y las conversaciones están en la sección Leads.</p></div>
        </aside>
      </div>
    </div>
  )
}
