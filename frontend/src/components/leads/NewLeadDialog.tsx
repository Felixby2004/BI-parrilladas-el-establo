import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X, UserPlus } from 'lucide-react'
import { captacionService } from '@/services/api'
import { apiErrorMessage } from '@/services/errors'
import type { InteresLead } from '@/types'

export function NewLeadDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', interes: 'reserva', personas: '', fecha: '', canal: 'registro_manual' })
  useEffect(() => { dialog.current?.showModal() }, [])
  const change = (name: keyof typeof form, value: string) => setForm(current => ({ ...current, [name]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!form.nombre.trim() || !form.telefono.trim()) { setError('Indica nombre y teléfono.'); return }
    setSaving(true)
    setError('')
    try {
      const response = await captacionService.enviarFormulario({
        nombre: form.nombre.trim(), telefono: form.telefono.trim(), email: form.email.trim() || undefined,
        interes: form.interes as InteresLead, canal: form.canal,
        personas_aproximadas: form.personas ? Number(form.personas) : undefined, fecha_preferida: form.fecha || undefined,
      })
      if (!response.id_lead) throw new Error('No se recibió identificador del lead')
      onCreated(response.id_lead)
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo confirmar la creación. Revisa el tablero antes de volver a intentarlo.'))
    } finally { setSaving(false) }
  }
  return (
    <dialog ref={dialog} onCancel={event => { if (saving) event.preventDefault(); else onClose() }} aria-labelledby="new-lead-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-arena-200/15 bg-dark-800 p-5 text-arena-100 shadow-2xl backdrop:bg-black/70 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4"><div><p className="eyebrow">Captación manual</p><h2 id="new-lead-title" className="mt-1 font-display text-xl">Nuevo lead</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar nuevo lead" className="btn-icon h-9 w-9"><X size={17} /></button></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs">Nombre completo *<input autoFocus required minLength={2} maxLength={150} value={form.nombre} onChange={e => change('nombre', e.target.value)} autoComplete="name" className="input-field mt-1.5" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs">Teléfono *<input required type="tel" minLength={7} maxLength={30} value={form.telefono} onChange={e => change('telefono', e.target.value)} autoComplete="tel" className="input-field mt-1.5" /></label>
          <label className="block text-xs">Correo<input type="email" maxLength={150} value={form.email} onChange={e => change('email', e.target.value)} autoComplete="email" className="input-field mt-1.5" /></label>
          <label className="block text-xs">Interés<select value={form.interes} onChange={e => change('interes', e.target.value)} className="input-field mt-1.5"><option value="reserva">Reserva de mesa</option><option value="informacion">Información general</option><option value="evento">Evento privado</option><option value="otro">Otro</option></select></label>
          <label className="block text-xs">Canal registrado<select value={form.canal} onChange={e => change('canal', e.target.value)} className="input-field mt-1.5"><option value="registro_manual">Registro manual</option><option value="telefono">Teléfono</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="presencial">Presencial</option></select></label>
          <label className="block text-xs">Personas estimadas<input type="number" min={1} max={500} value={form.personas} onChange={e => change('personas', e.target.value)} className="input-field mt-1.5" /></label>
          <label className="block text-xs">Fecha preferida<input type="date" value={form.fecha} onChange={e => change('fecha', e.target.value)} className="input-field mt-1.5" /></label>
        </div>
        <p className="text-[11px] leading-relaxed text-arena-300/65">Los contactos nuevos inician en estado Nuevo. Si el contacto ya existe, se intentará vincular por teléfono o correo sin duplicarlo.</p>
        {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-arena-200/10 pt-4"><button type="button" disabled={saving} onClick={onClose} className="btn-secondary">Cancelar</button><button disabled={saving} className="btn-primary"><UserPlus size={15} />{saving ? 'Guardando…' : 'Crear lead'}</button></div>
      </form>
    </dialog>
  )
}
