import { supabase } from '../lib/supabase'

export interface MovimientoKardex {
    id: string
    empresa_id: string
    producto_id: string
    fecha: string
    tipo_movimiento: 'ENTRADA' | 'SALIDA'
    motivo: string
    documento_referencia?: string
    cantidad: number
    costo_unitario?: number
    saldo_cantidad: number
    saldo_costo_promedio?: number
    created_at?: string
}

export interface KardexConProducto extends MovimientoKardex {
    producto?: {
        nombre: string
        codigo: string
    }
}

export const kardexService = {
    async getKardexByProducto(
        productoId: string,
        fechaInicio?: string,
        fechaFin?: string
    ): Promise<KardexConProducto[]> {
        let query = supabase
            .from('kardex')
            .select(`
                *,
                producto:productos(nombre)
            `)
            .eq('producto_id', productoId)
            .order('fecha', { ascending: true })

        if (fechaInicio) {
            query = query.gte('fecha', fechaInicio)
        }
        if (fechaFin) {
            query = query.lte('fecha', fechaFin)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    },

    async getKardexByEmpresa(
        empresaId: string,
        fechaInicio?: string,
        fechaFin?: string
    ): Promise<KardexConProducto[]> {
        let query = supabase
            .from('kardex')
            .select(`
                *,
                producto:productos(nombre)
            `)
            //.eq('empresa_id', empresaId)
            .order('fecha', { ascending: false })

        if (fechaInicio) {
            query = query.gte('fecha', fechaInicio)
        }
        if (fechaFin) {
            query = query.lte('fecha', fechaFin)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    },

    async getResumenStock(empresaId: string) {
        const { data, error } = await supabase
            .from('productos')
            .select('id, nombre, stock, costo_promedio, maneja_stock')
            //.eq('empresa_id', empresaId)
            .eq('maneja_stock', true)
            .order('nombre')

        if (error) throw error
        return data || []
    }
}
