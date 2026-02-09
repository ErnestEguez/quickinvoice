import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface Profile {
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
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!isMounted) return;

                if (session?.user) {
                    console.log('📦 Initial session found:', session.user.email);
                    setUser(session?.user ?? null);
                    await fetchProfile(session.user.id);
                } else {
                    console.log('Empty initial session');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Initialization error:', err);
                if (isMounted) setLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;
            console.log('🔔 Auth Event:', _event, session?.user?.email);

            if (_event === 'SIGNED_IN') {
                setUser(session?.user ?? null);
                if (session?.user) await fetchProfile(session.user.id);
            } else if (_event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
                setEmpresa(null);
                setLoading(false);
            }
        });

        const timer = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('Auth timeout reached');
                setLoading(false);
            }
        }, 10000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, [])

    async function fetchProfile(userId: string) {
        // Avoid fetching if we already have the profile for this user
        if (profile?.id === userId && empresa) {
            console.log('⚡ Profile already loaded for', userId)
            setLoading(false)
            return
        }

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
        );

        try {
            console.log('🔄 Fetching profile for:', userId);

            const { data: profileData, error: profileError } = await Promise.race([
                supabase.from('profiles').select('*').eq('id', userId).single(),
                timeoutPromise as any
            ]) as any;

            if (profileError) {
                console.error('❌ Profile Fetch Error:', profileError)
                if (profileError.code === 'PGRST116' || profileError.status === 406) {
                    console.warn('⚠️ User has no profile in DB yet')
                    setProfile(null)
                    setEmpresa(null)
                }
                setLoading(false)
                return
            }

            const data = profileData || {}
            console.log('✅ Profile loaded:', data.rol);
            setProfile(data)

            if (data.empresa_id) {
                const { data: empresaData, error: empresaError } = await supabase
                    .from('empresas')
                    .select('*')
                    .eq('id', data.empresa_id)
                    .single()

                if (!empresaError && empresaData) {
                    setEmpresa(empresaData)
                } else {
                    console.error('❌ Empresa Fetch Error:', empresaError)
                    setEmpresa(null)
                }
            } else {
                setEmpresa(null)
            }
        } catch (error: any) {
            console.error('🔥 CRITICAL Auth context fetch error:', error.message);
            // Do NOT clear state immediately on generic errors to prevent UI flashing "No Config"
            // unless it's the first load
            if (!profile) {
                setProfile(null)
                setEmpresa(null)
            }
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        console.log('Emergency SignOut triggered');
        try {
            // Intentar cerrar sesión en Supabase (puede fallar si no hay internet o sesion rota)
            await supabase.auth.signOut().catch(() => { });
        } finally {
            // Limpieza TOTAL y FORZADA
            console.log('Clearing local caches and redirecting...');
            localStorage.clear();
            sessionStorage.clear();

            // Usar reload forzado para asegurar que todo rastro de memoria se limpie
            window.location.replace('/login');
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-8 animate-pulse">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg animate-spin"></div>
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">RestoFlow</h1>
                <p className="text-slate-500 font-medium">
                    {user ? 'Validando tu perfil de acceso...' : 'Iniciando sistema...'}
                </p>

                <div className="mt-12 max-w-xs w-full space-y-4">
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-600 animate-[loading_10s_ease-in-out_infinite]"></div>
                    </div>
                </div>

                {user && (
                    <div className="mt-12 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-400 mb-3">Si la carga tarda demasiado, puede haber un problema con tu conexión o perfil.</p>
                        <button
                            onClick={() => signOut()}
                            className="text-sm text-red-600 font-bold hover:underline py-2 px-4 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            Ignorar y Cerrar Sesión
                        </button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            empresa,
            loading,
            signOut
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
