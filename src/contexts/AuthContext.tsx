import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Profile {
    id: string
    empresa_id: string | null
    rol: 'admin_plataforma' | 'oficina' | 'mesero' | 'cocina'
    nombre: string | null
}

interface Empresa {
    id: string
    nombre: string
    ruc: string
    logo_url?: string | null
}

interface AuthContextType {
    user: User | null
    profile: Profile | null
    empresa: Empresa | null
    activeStaff: Profile | null
    loading: boolean
    signOut: () => Promise<void>
    setActiveStaff: (staff: Profile | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    const [activeStaff, setActiveStaffState] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    // Load activeStaff from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('restoflow_active_staff')
        if (saved) {
            try {
                setActiveStaffState(JSON.parse(saved))
            } catch (e) {
                console.error('Error parsing active staff', e)
            }
        }
    }, [])

    const setActiveStaff = (staff: Profile | null) => {
        setActiveStaffState(staff)
        if (staff) {
            localStorage.setItem('restoflow_active_staff', JSON.stringify(staff))
        } else {
            localStorage.removeItem('restoflow_active_staff')
        }
    }

    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setProfile(null)
                setEmpresa(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchProfile(userId: string) {
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (profileError) throw profileError
            setProfile(profileData)

            if (profileData.empresa_id) {
                const { data: empresaData, error: empresaError } = await supabase
                    .from('empresas')
                    .select('*')
                    .eq('id', profileData.empresa_id)
                    .single()

                if (empresaError) throw empresaError
                setEmpresa(empresaData)
            }
        } catch (error) {
            console.error('FULL PROFILE FETCH ERROR:', error)
            setProfile(null)
            setEmpresa(null)
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            empresa,
            activeStaff,
            loading,
            signOut,
            setActiveStaff
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
