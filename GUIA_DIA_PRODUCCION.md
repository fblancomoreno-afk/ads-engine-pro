# GUÍA DÍA DE PRODUCCIÓN — Ads Engine Pro
# ============================================================
# Yo te guío en cada paso. Tú eres mis ojos.
# Tiempo estimado: 2-3 horas con calma.
# ============================================================


## PASO 1 — NEON (Base de datos)
----------------------------------------
Qué es: Neon es donde se guardan todos los usuarios,
créditos y campañas. Es la memoria del sistema.

1. Abre el navegador y ve a: https://console.neon.tech
2. Haz clic en "Sign up" — regístrate con tu Gmail
3. Cuando entres, haz clic en "New Project"
4. Nombre del proyecto: AdsEnginePro
5. Región: Europe West (la más cercana a España)
6. Haz clic en "Create Project"
7. Verás una pantalla con una cadena de texto larga
   que empieza por "postgresql://"
   → CÓPIALA. La necesitamos para el paso 3.
8. Ve a la pestaña "SQL Editor"
9. Pega todo el contenido del archivo schema_FINAL.sql
10. Haz clic en "Run"
    → Verás "Success". La base de datos está creada.


## PASO 2 — ANTHROPIC (API Key de Claude)
----------------------------------------
Qué es: La llave que permite al motor V8 llamar a Claude.

1. Ve a: https://console.anthropic.com
2. Inicia sesión o crea cuenta
3. En el menú izquierdo haz clic en "API Keys"
4. Haz clic en "Create Key"
5. Nombre: AdsEnginePro
6. Copia la clave. Empieza por "sk-ant-api03-..."
   → GUÁRDALA. Solo se muestra una vez.


## PASO 3 — LEMON SQUEEZY (Pagos)
----------------------------------------
Qué es: La pasarela de pago. Gestiona cobros y facturas.

1. Ve a: https://app.lemonsqueezy.com
2. Crea tu cuenta y rellena tus datos fiscales y bancarios
3. Crea tu tienda: Settings → Stores → Add Store
   Nombre: Ads Engine Pro
4. Crea los 3 productos: Products → Add Product
   - Producto 1: "Starter"  — Precio: 249€ — One-time
   - Producto 2: "Pro"      — Precio: 590€ — One-time
   - Producto 3: "Agency"   — Precio: 1490€ — One-time
5. Apunta el ID de cada producto (número que aparece en la URL)
6. Ve a: Settings → Webhooks → Add Webhook
   URL: https://tu-servidor.vercel.app/api/webhooks/lemon
   (la URL de Vercel la tendremos en el paso 4)
   Eventos a activar: order_created
7. Copia el Webhook Secret que te genera


## PASO 4 — VERCEL (El servidor en internet)
----------------------------------------
Qué es: Donde vive el servidor. Lo pone en internet.

1. Ve a: https://vercel.com
2. Regístrate con tu Gmail
3. Haz clic en "Add New Project"
4. Elige "Upload" (subir archivos directamente)
5. Sube todos los archivos de la carpeta AdsEnginePro
   (todos los días juntos: adsengine-backend + files + dia4 + dia5 + dia6)
6. Antes de hacer Deploy, haz clic en "Environment Variables"
   y añade estas variables una a una:

   DATABASE_URL        = (la de Neon del paso 1)
   JWT_SECRET          = (inventa una frase larga, ej: MiClaveAdsEngine2025Pro)
   ANTHROPIC_API_KEY   = (la del paso 2)
   LEMON_WEBHOOK_SECRET = (la del paso 3)
   LEMON_PRODUCT_STARTER = (ID del paso 3)
   LEMON_PRODUCT_PRO     = (ID del paso 3)
   LEMON_PRODUCT_AGENCY  = (ID del paso 3)

7. Haz clic en "Deploy"
8. Vercel te dará una URL tipo: adsengine-pro.vercel.app
   → CÓPIALA.


## PASO 5 — CONECTAR TODO
----------------------------------------
1. Vuelve a Lemon Squeezy → Webhooks
   Actualiza la URL con la real de Vercel del paso 4

2. Abre los archivos HTML (login, dashboard, etc.)
   Busca esta línea en cada uno:
   const SERVER_URL = ... : '';
   Sustituye el '' por 'https://adsengine-pro.vercel.app'
   (yo te ayudo con esto)

3. Sube los HTML actualizados a Vercel


## PASO 6 — PRUEBA FINAL
----------------------------------------
1. Abre: https://adsengine-pro.vercel.app/login.html
2. Entra con: fblancomoreno@gmail.com / password
3. Cambia la contraseña inmediatamente desde el panel admin
4. Crea un cliente de prueba
5. Genera una campaña de prueba
6. Verifica que se descuenta 1 crédito
7. Haz una compra de prueba en Lemon Squeezy (con tarjeta real)
8. Verifica que llega el webhook y se crean los créditos

SI TODO FUNCIONA → estás en producción. 🚀

============================================================
ANTE CUALQUIER PROBLEMA — me lo dices y lo resuelvo yo.
============================================================
