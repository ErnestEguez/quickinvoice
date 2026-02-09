# README_MESEROS_MOBILE.md

## Contexto y Análisis Inicial
La aplicación actual utiliza un diseño responsivo estándar que funciona bien en escritorio pero presenta fricciones en móviles para el rol de mesero:
1. **MesaGrid:** El grid de mesas puede resultar denso en pantallas pequeñas.
2. **OrderTake:** La vista divide pantalla (izquierda productos, derecha carrito). En móvil, el carrito queda al final del scroll, lo que dificulta ver qué se está pidiendo sin hacer scroll constante.

## Estrategia de Implementación
Se crearán componentes específicos para la experiencia móvil del mesero, priorizando la usabilidad táctil y la claridad.

### Archivos Modificados
- `src/pages/MesaGrid.tsx`: Se condicionalizará la vista. Si el usuario es **mesero** (y preferiblemente en viewport móvil), se mostrará `WaiterTableListMobile`.
- `src/pages/OrderTake.tsx`: Se condicionalizará la vista. Si el usuario es **mesero**, se mostrará `WaiterOrderTakeMobile`.

### Nuevos Componentes (en `src/components/mobile/`)
1. **`WaiterTableListMobile.tsx`**:
   - Vista de lista/tarjetas grandes para fácil selección.
   - Indicadores de estado (Libre/Ocupada) con colores de alto contraste.
   - Filtros grandes y accesibles.

2. **`WaiterOrderTakeMobile.tsx`**:
   - **Navegación por Categorías:** Tabs horizontales con scroll (tipo Instagram/Apps de delivery) en lugar de dropdown.
   - **Lista de Productos:** Tarjetas grandes con botón directo de "+".
   - **Carrito Flotante (Sticky Footer):** Barra inferior fija que muestra "X ítems | Total $..." y un botón para "Ver Pedido / Confirmar".
   - **Modal de Carrito:** Al tocar la barra inferior, se abre un modal/drawer para editar cantidades o eliminar ítems antes de confirmar.

## Cómo Probar
1. Iniciar sesión como mesero.
2. Navegar a la lista de mesas (debe ver el nuevo diseño de lista grandes).
3. Entrar a una mesa (debe ver la interfaz de toma de pedidos con categorías superiores y barra inferior de total).
4. Usar el modo de inspección de Chrome (Device Toolbar) simulando un iPhone o Android.

---
**Nota:** No se ha tocado lógica de negocio (SRI, Auth, Roles). Solo UI/UX.
