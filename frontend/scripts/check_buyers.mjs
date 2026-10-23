/**
 * Local-only Buyers checks: SSR, event handlers, Blob lifecycle and API contract.
 * Uses existing TypeScript/React dependencies; never calls Google or the backend.
 * This is not a browser/layout test and does not verify real image generation.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
const pagePath = 'src/pages/buyers/DashboardMarketing.tsx'
const pageSource = fs.readFileSync(path.join(root, pagePath), 'utf8')

function compile(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: relativePath,
  }).outputText
  const module = { exports: {} }
  // Explicit mocks prevent importing the live API client from page/service tests.
  const localRequire = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name)
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports)
  return module.exports
}

// Resolve state names from the AST rather than relying on hardcoded hook indices.
const stateNames = []
const ast = ts.createSourceFile(pagePath, pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function findState(node) {
  if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
      && node.initializer && ts.isCallExpression(node.initializer)
      && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'useState') {
    const first = node.name.elements[0]
    assert(ts.isBindingElement(first) && ts.isIdentifier(first.name))
    stateNames.push(first.name.text)
  }
  ts.forEachChild(node, findState)
}
findState(ast)
assert(stateNames.includes('config') && stateNames.includes('resultUrl'), 'Expected Buyers state declarations')

const errors = compile('src/services/errors.ts')
let configCalls = 0
let generationCalls = []
let clipboardCalls = []
let confirmed = true
let rejectGeneration = false
const image = {
  proveedor: 'Google Gemini', modelo: 'local-test-model', formato: '4:5', mime_type: 'image/png',
  imagen_base64: Buffer.from('local-test-image-bytes').toString('base64'),
  ancho: 800, alto: 1000, texto: '', brief: 'Local test brief', advertencia: 'Revisar IA',
}
const mockService = {
  configuracion: async () => { configCalls++; return { configurado: false } },
  generar: async payload => {
    generationCalls.push(payload)
    if (rejectGeneration) throw { isAxiosError: true, response: { data: { detail: 'Error de cuota visible' } } }
    return image
  },
}

function mount(overrides = {}) {
  for (const name of Object.keys(overrides)) assert(stateNames.includes(name), `Unknown state: ${name}`)
  let cursor = 0
  const updates = []
  const effects = []
  const hooks = {
    ...React,
    useState(initial) {
      const name = stateNames[cursor++]
      const current = Object.hasOwn(overrides, name) ? overrides[name] : initial
      return [current, value => updates.push({ name, value: typeof value === 'function' ? value(current) : value })]
    },
    useEffect(effect) { effects.push(effect) },
  }
  const Page = compile(pagePath, {
    react: hooks,
    '@/services/creativosService': { creativosService: mockService },
    '@/services/errors': errors,
  }).default
  const tree = Page()
  assert.equal(cursor, stateNames.length)
  const nodes = []
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node && typeof node === 'object') { nodes.push(node); visit(node.props?.children) }
  }
  visit(tree)
  return {
    html: renderToStaticMarkup(tree), updates, effects,
    form: nodes.find(node => node.type === 'form'),
    copy: nodes.find(node => node.type === 'button' && JSON.stringify(node.props.children).includes('Copiar brief para Google Labs Pomelli')),
  }
}
const hasUpdate = (instance, name, predicate) => instance.updates.some(item => item.name === name && predicate(item.value))
const event = () => ({ preventDefault() {} })
const submitDisabled = /<button[^>]*type="submit"[^>]*disabled=""/

async function checkSSRAndBlob() {
  const initial = mount()
  assert.equal(configCalls, 0, 'Rendering must not issue API calls')
  assert.equal(generationCalls.length, 0)
  assert.match(initial.html, /textarea[^>]+id="creative-prompt"/)
  assert.match(initial.html, /minLength="15"/)
  assert.match(initial.html, /maxLength="5000"/)
  assert.match(initial.html, />9:16</)
  assert.match(initial.html, />4:5</)
  assert.match(initial.html, submitDisabled)
  assert.match(initial.html, /https:\/\/labs.google.com\/pomelli\/about\//)
  assert.doesNotMatch(initial.html, /<table|CTR |tasaConv|Ribeye Premium|Contactado|Kanban/)
  assert.doesNotMatch(initial.html, /<img\s/)
  console.log('PASS SSR initial: free prompt, vertical formats, disabled generation, no leads/KPI/fake result')

  const noKey = mount({ config: { configurado: false }, loadingConfig: false, showSetup: true })
  assert.match(noKey.html, /Configura la clave para generar/)
  assert.match(noKey.html, /nunca en VITE_/)
  assert.match(noKey.html, /No se ha conectado una API de Pomelli/)
  assert.match(noKey.html, /GEMINI_API_KEY=tu_clave_de_google/)
  assert.match(noKey.html, submitDisabled)
  console.log('PASS missing key: backend setup guide and explicit external Pomelli distinction')

  const configured = mount({
    config: { configurado: true, modelo: 'local-test-model' }, loadingConfig: false,
    prompt: '<img src=x onerror=alert(1)> & libre', error: 'Error de cuota <script>x</script>',
  })
  assert.doesNotMatch(configured.html, submitDisabled)
  assert.match(configured.html, /Google Gemini configurado/)
  assert.match(configured.html, /role="alert"/)
  assert.match(configured.html, /&lt;script&gt;x&lt;\/script&gt;/)
  assert.doesNotMatch(configured.html, /<img src=x onerror/)
  console.log('PASS configured/errors: enabled submit, visible errors and escaped user text')

  const output = mount({ config: { configurado: true }, loadingConfig: false, result: image, resultUrl: 'blob:local-test-image' })
  assert.match(output.html, /src="blob:local-test-image"/)
  assert.match(output.html, /href="blob:local-test-image"/)
  assert.match(output.html, /download="el-establo-anuncio-4x5.png"/)
  assert.match(output.html, /800 × 1000 px/)
  assert.match(output.html, /Revisar IA/)
  assert.equal(output.effects.length, 2, 'Expected config effect and image URL effect')
  const cleanup = output.effects[1]()
  const blobUpdate = output.updates.find(item => item.name === 'resultUrl')
  assert(blobUpdate?.value.startsWith('blob:'))
  try {
    const response = await fetch(blobUpdate.value)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(await response.text(), 'local-test-image-bytes')
  } finally { cleanup() }
  await assert.rejects(fetch(blobUpdate.value), 'Cleanup must revoke the object URL')
  console.log('PASS Blob: exact decoded bytes, MIME/filename, downloadable URL and revocation')
}

async function checkService() {
  const calls = []
  const api = {
    get: async (...args) => { calls.push(['get', ...args]); return { data: { configurado: false } } },
    post: async (...args) => { calls.push(['post', ...args]); return { data: image } },
  }
  const service = compile('src/services/creativosService.ts', { './api': { default: api } }).creativosService
  await service.configuracion()
  const payload = { prompt: 'Una idea libre suficientemente larga', formato: '4:5', texto_publicitario: 'Texto exacto', llamada_accion: 'Reservar' }
  assert.equal((await service.generar(payload)).formato, '4:5')
  assert.deepEqual(calls, [
    ['get', '/creativos/configuracion'],
    ['post', '/creativos/generar', payload, { timeout: 135000 }],
  ])
  console.log('PASS service: exact backend endpoints/payload, 135s timeout, no key headers or retries')
}

async function checkHandlers() {
  let instance = mount({ config: { configurado: false }, loadingConfig: false, prompt: 'Una idea de anuncio libre' })
  await instance.form.props.onSubmit(event())
  assert.equal(generationCalls.length, 0)
  assert(hasUpdate(instance, 'showSetup', value => value === true))
  assert(hasUpdate(instance, 'error', value => value.includes('GEMINI_API_KEY')))
  console.log('PASS submit without key: no generation call, visible setup/error')

  confirmed = false
  instance = mount({ config: { configurado: true }, loadingConfig: false, prompt: 'Una idea de anuncio libre' })
  await instance.form.props.onSubmit(event())
  assert.equal(generationCalls.length, 0)
  console.log('PASS declined cost confirmation: no generation request')

  confirmed = true
  instance = mount({ config: { configurado: true }, loadingConfig: false, prompt: 'Una idea de anuncio libre', formato: '4:5', texto: 'Texto exacto', cta: 'Reservar' })
  await instance.form.props.onSubmit(event())
  assert.deepEqual(generationCalls, [{ prompt: 'Una idea de anuncio libre', formato: '4:5', texto_publicitario: 'Texto exacto', llamada_accion: 'Reservar' }])
  assert(hasUpdate(instance, 'result', value => value === image))
  assert.deepEqual(instance.updates.filter(item => item.name === 'generating').map(item => item.value), [true, false])
  console.log('PASS success: exact prompt/format/copy/CTA, busy state and real service result')

  rejectGeneration = true
  instance = mount({ config: { configurado: true }, loadingConfig: false, prompt: 'Una idea de anuncio libre', result: { previous: true } })
  await instance.form.props.onSubmit(event())
  assert.equal(generationCalls.length, 2, 'Failure must not retry')
  assert(!instance.updates.some(item => item.name === 'result'), 'Failure must preserve previous result')
  assert(hasUpdate(instance, 'error', value => value === 'Error de cuota visible'))
  console.log('PASS failure: single request, backend error visible, prior result preserved, no fake fallback')

  instance = mount({ prompt: 'corta' })
  await instance.copy.props.onClick()
  assert.equal(clipboardCalls.length, 0)
  assert(hasUpdate(instance, 'error', value => value.includes('15 caracteres')))
  instance = mount({ prompt: 'Una idea de anuncio libre', formato: '4:5', texto: 'Texto exacto', cta: 'Reservar' })
  await instance.copy.props.onClick()
  assert.equal(clipboardCalls.length, 1)
  assert.match(clipboardCalls[0], /Formato: fotografía vertical 4:5/)
  assert.match(clipboardCalls[0], /Texto exacto: Texto exacto/)
  assert.doesNotMatch(clipboardCalls[0], /GEMINI_API_KEY|VITE_/)
  console.log('PASS copy brief: minimum length, exact fields and no credential references')

  navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied') }
  instance = mount({ prompt: 'Una idea de anuncio libre' })
  await instance.copy.props.onClick()
  assert(hasUpdate(instance, 'notice', value => value.includes('cópialo manualmente')))
  console.log('PASS clipboard denial: visible manual copy fallback')
}

const globals = new Map(['window', 'navigator', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
const nativeFetch = globalThis.fetch
try {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { confirm: () => confirmed, setTimeout: () => 0 } })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { clipboardCalls.push(text) } } } })
  // Block HTTP even if future component changes accidentally introduce a request.
  globalThis.fetch = (url, ...args) => {
    assert(String(url).startsWith('blob:'), 'Network requests are forbidden in this local-only check')
    return nativeFetch(url, ...args)
  }
  await checkSSRAndBlob()
  await checkService()
  await checkHandlers()
  assert.equal(configCalls, 0, 'SSR/event tests must not call configuration automatically')
  console.log('\nALL BUYERS CHECKS PASS — local mocks/SSR only; no Google/backend calls or browser layout verification.')
} finally {
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}
