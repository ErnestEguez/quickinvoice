import { supabase } from '../lib/supabase'

export interface Pedido {
    id: string
    mesa_id: string
    mesero_id: string
    estado: 'pendiente' | 'en_preparacion' | 'atendido' | 'facturado'
    total: number
    empresa_id: string
    created_at?: string
}

export interface PedidoDetalle {
    id: string
    pedido_id: string
    producto_id: string
    cantidad: number
    precio_unitario: number
    notas?: string
}

export const pedidoService = {
    async crearPedido(mesaId: string, meseroId: string, empresaId: string, items: any[], total: number) {
        // En una transacción real usaríamos un RPC de Supabase, 
        // pero para este MVP lo hacemos en dos pasos.

        // 1. Crear la cabecera del pedido
        const { data: pedido, error: pedidoError } = await supabase
            .from('pedidos')
            .insert({
                mesa_id: mesaId,
                mesero_id: meseroId,
                empresa_id: empresaId,
                total: total,
                estado: 'pendiente'
            })
            .select()
            .single()

        if (pedidoError) throw pedidoError

        // 2. Crear los detalles
        const detalles = items.map(item => {
            const precio_unitario = Number(item.precio_venta || 0)
            const cantidad = Number(item.cantidad || 0)
            const subtotal = precio_unitario * cantidad

            return {
                pedido_id: pedido.id,
                producto_id: item.id,
                cantidad: cantidad,
                precio_unitario: precio_unitario,
                subtotal: subtotal
            }
        })

        console.log('Inserting details with subtotal (minified):', detalles)
        const { error: detallesError } = await supabase
            .from('pedido_detalles')
            .insert(detalles)

        if (detallesError) throw detallesError

        // 3. Actualizar estado de la mesa a 'ocupada'
        const { error: mesaError } = await supabase
            .from('mesas')
            .update({ estado: 'ocupada' })
            .eq('id', mesaId)

        if (mesaError) throw mesaError

        return pedido
    },

    async getPedidosRecientes(limit = 5) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                mesas (numero)
            `)
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return data
    },

    async getPedidosByMesero(empresaId: string, meseroId: string) {
        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                mesas (numero),
                pedido_detalles (
                    *,
                    productos (nombre)
                )
            `)
            .eq('empresa_id', empresaId)
            .eq('mesero_id', meseroId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    async getEstadisticas(empresaId: string) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Ventas del día (desde comprobantes oficiales)
        const { data: sales, error: salesError } = await supabase
            .from('comprobantes')
            .select('total')
            .eq('empresa_id', empresaId)
            .gte('created_at', today.toISOString())

        if (salesError) throw salesError

        // Pedidos activos
        const { count: pedidosActivos, error: countError } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .neq('estado', 'facturado')

        if (countError) throw countError

        // Mesas ocupadas
        const { count: mesasOcupadas, error: mesaCountError } = await supabase
            .from('mesas')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('estado', 'ocupada')

        if (mesaCountError) throw mesaCountError

        const totalVentas = sales?.reduce((sum, p) => sum + Number(p.total), 0) || 0
        const promedioTicket = sales?.length ? totalVentas / sales.length : 0

        return {
            totalVentas,
            pedidosActivos: pedidosActivos || 0,
            mesasOcupadas: mesasOcupadas || 0,
            promedioTicket
        }
    },

    async getPedidosPorEstado(empresaId: string, estados?: string[]) {
        let query = supabase
            .from('pedidos')
            .select(`
                *,
                mesas (numero),
                pedido_detalles (
                    *,
                    productos (nombre)
                )
            `)
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false })

        if (estados && estados.length > 0) {
            query = query.in('estado', estados)
        }

        const { data, error } = await query

        console.log('PEDIDOS RETRIEVED:', data)
        if (error) {
            console.error('QUERY ERROR:', error)
            throw error
        }
        return data
    },

    async updateEstadoPedido(pedidoId: string, nuevoEstado: string) {
        const { data, error } = await supabase
            .from('pedidos')
            .update({ estado: nuevoEstado })
            .eq('id', pedidoId)
            .select()
            .single()

        if (error) throw error

        // Si el pedido se marca como 'facturado' o se cancela, 
        // podríamos liberar la mesa, pero eso suele hacerse en el flujo de factura.

        return data
    },

    async getPedidoActivoPorMesa(mesaId: string) {
        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                pedido_detalles (
                    *,
                    productos (*)
                )
            `)
            .eq('mesa_id', mesaId)
            .neq('estado', 'facturado')
            .neq('estado', 'cancelado')  // Fix: Exclude cancelled orders
            .order('created_at', { ascending: false })
            .maybeSingle()

        if (error) throw error
        return data
    },

    async getPedidoById(pedidoId: string) {
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select(`
                    *,
                    mesas(numero),
                    profiles(nombre),
                    pedido_detalles(
                        *,
                        productos(
                            nombre,
                            categorias(tipo)
                        )
                    )
                `)
                .eq('id', pedidoId)
                .single()

            if (error) {
                console.warn('Error in getPedidoById join:', error)
                // Reintento sin el join de tipo o perfiles por si la columna/tabla no existe
                const { data: simpleData, error: simpleError } = await supabase
                    .from('pedidos')
                    .select(`
                        *,
                        mesas(numero),
                        pedido_detalles(
                            *,
                            productos(
                                nombre,
                                categorias(nombre)
                            )
                        )
                    `)
                    .eq('id', pedidoId)
                    .single()

                if (simpleError) throw simpleError
                return simpleData
            }
            return data
        } catch (err) {
            console.error('Fatal error in getPedidoById:', err)
            throw err
        }
    },

    async agregarItemsAPedido(pedidoId: string, nuevosItems: any[], nuevoTotal: number) {
        // 1. Insertar los nuevos detalles
        const detalles = nuevosItems.map(item => {
            const precio_unitario = Number(item.precio_venta || 0)
            const cantidad = Number(item.cantidad || 0)
            const subtotal = precio_unitario * cantidad

            return {
                pedido_id: pedidoId,
                producto_id: item.id,
                cantidad: cantidad,
                precio_unitario: precio_unitario,
                subtotal: subtotal
            }
        })

        const { error: detallesError } = await supabase
            .from('pedido_detalles')
            .insert(detalles)

        if (detallesError) throw detallesError

        // 2. Actualizar el total del pedido
        const { error: pedidoError } = await supabase
            .from('pedidos')
            .update({ total: nuevoTotal })
            .eq('id', pedidoId)

        if (pedidoError) throw pedidoError

        return true
    }
}
