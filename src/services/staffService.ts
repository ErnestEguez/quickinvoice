import { supabase } from '../lib/supabase'

export interface StaffMember {
    id: string
    nombre: string
    rol: 'oficina' | 'mesero' | 'cocina' | 'admin_plataforma'
    empresa_id: string
    email?: string
    pin?: string
}

export const staffService = {
    async getStaffByEmpresa(empresaId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('nombre', { ascending: true })

        if (error) throw error
        return data as StaffMember[]
    },

    async createStaffMember(member: Partial<StaffMember>) {
        const { data, error } = await supabase
            .from('profiles')
            .insert(member)
            .select()
            .single()

        if (error) throw error
        return data as StaffMember
    },

    async updateStaffMember(id: string, updates: Partial<StaffMember>) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as StaffMember
    },

    async deleteStaffMember(id: string) {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}
