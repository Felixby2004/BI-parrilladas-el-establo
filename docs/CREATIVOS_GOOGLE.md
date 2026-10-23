# Buyers: fotografías publicitarias por prompt

Buyers ya no contiene leads, tablero de contactos ni métricas inventadas. El seguimiento está en `/leads`. El estudio permite un prompt libre, texto/CTA opcionales y fotografías verticales **9:16** (Stories/estados) o **4:5** (feed). La descarga conserva la imagen original devuelta por Google; no se estira una imagen cuadrada mediante CSS.

## Pomelli y Gemini son dos herramientas distintas

- **Google Labs Pomelli:** [sitio oficial](https://labs.google.com/pomelli/about/) y [anuncio oficial de Google](https://blog.google/innovation-and-ai/models-and-research/google-labs/pomelli/). Se abre externamente e inicia sesión con Google, sujeto a disponibilidad de cuenta/región. En esta entrega no se ha verificado ni implementado una API pública de Pomelli: el botón copia un brief que puedes llevar a esa herramienta. No simula generación o publicación de Pomelli.
- **Generación dentro de esta app:** usa la [API oficial de imágenes de Gemini](https://ai.google.dev/gemini-api/docs/image-generation?hl=en) y necesita una [clave de Google AI Studio](https://aistudio.google.com/apikey). Una clave de AI Studio no equivale a acceso a Pomelli. Se usa [GenerateContent REST](https://ai.google.dev/api/generate-content?hl=en) con `imageConfig.aspectRatio`.

## Credenciales

Configura únicamente [backend/.env](../backend/.env), nunca un `VITE_*` ni el prompt:

```dotenv
GEMINI_API_KEY=tu_clave_google
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

Reinicia el backend después de cambiar ese archivo. La pantalla «Credenciales y Pomelli» muestra si el backend tiene una clave, pero nunca revela su valor. Esa comprobación **no certifica** que la clave tenga acceso, facturación o cuota. Google puede requerir un proyecto con facturación, permisos y disponibilidad regional para el modelo; consulta sus [instrucciones oficiales de claves](https://ai.google.dev/gemini-api/docs/api-key?hl=en).

No se ha proporcionado una clave Google en este proyecto: la generación real queda pendiente de configurarla. No se realizaron llamadas de generación ni cargos para verificar el código. Las pruebas usan respuestas Google simuladas y comprueban el contrato REST, errores y formatos.

## Flujo

1. Escribe el prompt: producto, composición, ambiente, luz, público y objetivo.
2. Elige 9:16 o 4:5 y texto/CTA, si quieres incluirlos en la foto.
3. Genera en Gemini y confirma el posible consumo de cuota/coste, **o** copia el brief y abre Pomelli.
4. Revisa la pieza: texto, precios, logo y calidad pueden necesitar correcciones.
5. Descarga el archivo original. Se mantiene solo en memoria de esa sesión; no hay galería persistente ni publicación automática.

El estilo de marca se transmite en el brief (vino/arena/dorado, fotografía cálida y premium). No hay escaneo automático del negocio, entrenamiento de marca ni subida de referencias/logo. Las fotos son generadas con IA: no deben anunciarse como fotos verificadas del restaurante real.

La aplicación rechaza respuestas sin imagen, archivos no reconocidos y resultados que no correspondan al formato vertical solicitado. No los sustituye por imágenes de catálogo o ejemplos. No hace reintentos automáticos para evitar gastos duplicados. Si hay timeout, verifica el consumo en Google antes de intentar otra vez.

## API

- `GET /api/v1/creativos/configuracion`: estado booleano de configuración, modelo y formatos.
- `POST /api/v1/creativos/generar`: `{ "prompt": "...mínimo 15 caracteres...", "formato": "9:16", "texto_publicitario": "", "llamada_accion": "Reserva tu mesa" }`.

La respuesta contiene proveedor, modelo, formato, `mime_type`, `imagen_base64`, dimensiones reales, brief y advertencia. Con clave ausente devuelve 503; no devuelve éxito simulado. Solo se permite una generación simultánea por proceso.

## Seguridad y pruebas

Este proyecto local todavía no incorpora autenticación de usuarios para el estudio. **No expongas el estudio ni el resto de la API a Internet con una clave de pago configurada** sin añadir autenticación, límites persistentes por usuario y controles de cuota. Si publicas el webhook Hermes con un túnel/reverse proxy, expón únicamente su ruta protegida con Bearer, no todo el frontend/backend.

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\check_creativos.py
```

Esta prueba no utiliza la clave real ni envía prompts a Google. La interfaz también dispone de pruebas reproducibles locales (SSR, Blob, descarga, portapapeles, errores y confirmación de coste):

```powershell
cd frontend
npm run test:buyers
```

Son 11 grupos de pruebas con mocks y no sustituyen una prueba visual de navegador ni una generación real con cuota.
