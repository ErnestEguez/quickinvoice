import { supabase } from '../lib/supabase'

export interface Mesa {
    id: string
    empresa_id: string
    numero: string
    capacidad: number
    estado: 'libre' | 'ocupada' | 'reservada' | 'atendida'
}

export const mesaService = {
    async getMesas() {
        const { data, error } = await supabase
            .from('mesas')
            .select('*')
            .order('numero', { ascending: true })

        if (error) throw error
        return data as Mesa[]
    },

    async getMesaById(id: string) {
        const { data, error } = await supabase
            .from('mesas')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        return data as Mesa
    },

    async createMesa(mesa: Partial<Mesa>) {
        const { data, error } = await supabase
            .from('mesas')
            .insert(mesa)
            .select()
            .single()

        if (error) throw error
        return data as Mesa
    },

    async updateMesa(id: string, updates: Partial<Mesa>) {
        const { data, error } = await supabase
            .from('mesas')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Mesa
    },

    async deleteMesa(id: string) {
        const { error } = await supabase
            .from('mesas')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    },

    subscribeToMesas(callback: (payload: any) => void) {
        return supabase
            .channel('mesas_changes')
            .on('postgres_changes' as any, { event: '*', table: 'mesas' }, callback)
            .subscribe()
    }
}
