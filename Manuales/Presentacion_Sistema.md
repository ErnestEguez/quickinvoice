# PRESENTACIÓN DEL SISTEMA: RESTOFLOW

## 1. Visión General
RestoFlow es una plataforma SaaS (Software as a Service) diseñada para la gestión integral de restaurantes y negocios gastronómicos. Su arquitectura permite manejar múltiples empresas de forma aislada bajo una única infraestructura tecnológica, optimizando procesos desde la toma de pedidos hasta la facturación electrónica.

## 2. Fortalezas Principales

### A. Seguridad de Grado Bancario (RLS)
El sistema implementa **Row Level Security (RLS)** directamente en la base de datos PostgreSQL. Esto garantiza que la información de cada restaurante sea totalmente invisible para otros usuarios de la plataforma, incluso si comparten la misma infraestructura.

### B. Control de Fugas de Dinero
Diseñado con una lógica estricta de jerarquías:
- Los meseros **NO pueden cancelar pedidos** ni resetear mesas una vez que se ha iniciado un servicio.
- Cualquier eliminación de ítems o anulación de mesas debe ser autorizada y ejecutada por el **Usuario Oficina** o el **Super Admin**.
- Esto asegura que cada consumo en el salón termine obligatoriamente en una factura o sea debidamente justificado por la administración.

### C. Gestión Visual e Intuitiva
- **Plano de Mesas Interactiva:** Estados de mesa actualizados en tiempo real (Disponible, Ocupada, Atendida, Facturada).
- **Flujo de Comanda:** Notificación automática a cocina para agilizar el servicio.

### D. Escalabilidad Multi-Empresa
Permite al administrador global supervisar múltiples locales y empresas con una sola cuenta, facilitando la expansión del negocio.

## 3. Beneficios para el Negocio
- Reducción de errores humanos en la facturación.
- Eliminación de mermas financieras por pedidos "no registrados".
- Reportes consolidados de ventas y rendimiento de personal.
- Cumplimiento de normativas SRI (Facturación Electrónica).

---
**RestoFlow: Tecnología que fluye con tu negocio.**
