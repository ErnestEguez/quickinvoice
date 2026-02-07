import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { staffService } from '../services/staffService'
import { LogOut, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

export function StaffOverlay() {
    const { empresa, activeStaff, setActiveStaff, signOut } = useAuth()
    const [staffList, setStaffList] = useState<any[]>([])
    const [selectedStaff, setSelectedStaff] = useState<any | null>(null)
    const [pin, setPin] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (empresa?.id) {
            loadStaff()
        }
    }, [empresa?.id])

    async function loadStaff() {
        try {
            const data = await staffService.getStaffByEmpresa(empresa!.id)
            setStaffList(data)
        } catch (error) {
            console.error('Error loading staff:', error)
        } finally {
            setLoading(false)
        }
    }

    const addDigit = (digit: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + digit)
        }
    }

    useEffect(() => {
        if (pin.length === 4 && selectedStaff) {
            // Auto submit if 4 digits
            if (pin === selectedStaff.pin) {
                setActiveStaff(selectedStaff)
                setPin('')
                setSelectedStaff(null)
            } else {
                setError('PIN incorrecto')
                setPin('')
            }
        }
    }, [pin, selectedStaff, setActiveStaff])

    if (activeStaff) return null // Don't show if already logged in as staff

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-primary-600 rounded-3xl flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4 shadow-2xl shadow-primary-900/20">
                        {empresa?.nombre?.[0] || 'R'}
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{empresa?.nombre}</h1>
                    <p className="text-slate-400">Seleccione su perfil para continuar</p>
                </div>

                {!selectedStaff ? (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                            </div>
                        ) : (
                            staffList.map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() => setSelectedStaff(member)}
                                    className="w-full flex items-center justify-between p-5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-primary-500/50 rounded-2xl transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300 font-bold group-hover:bg-primary-500 group-hover:text-white transition-colors">
                                            {member.nombre[0]}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white text-lg">{member.nombre}</p>
                                            <p className="text-sm text-slate-500 capitalize">{member.rol}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
                                </button>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl">
                        <button
                            onClick={() => { setSelectedStaff(null); setPin(''); setError(null); }}
                            className="text-primary-400 text-sm font-bold mb-6 hover:text-primary-300 flex items-center gap-1"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" /> Volver a la lista
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                                {selectedStaff.nombre[0]}
                            </div>
                            <h2 className="text-xl font-bold text-white">{selectedStaff.nombre}</h2>
                            <p className="text-slate-400 text-sm">Ingrese su PIN de 4 dígitos</p>
                        </div>

                        <div className="flex justify-center gap-4 mb-8">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-4 h-4 rounded-full border-2 transition-all duration-150",
                                        pin.length > i
                                            ? "bg-primary-500 border-primary-500 scale-110"
                                            : "border-slate-600"
                                    )}
                                />
                            ))}
                        </div>

                        {error && (
                            <p className="text-red-400 text-center text-sm mb-6 animate-shake font-medium">{error}</p>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => addDigit(n.toString())}
                                    className="h-16 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold active:scale-95 transition-all"
                                >
                                    {n}
                                </button>
                            ))}
                            <div />
                            <button
                                onClick={() => addDigit('0')}
                                className="h-16 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold active:scale-95 transition-all"
                            >
                                0
                            </button>
                            <button
                                onClick={() => setPin(prev => prev.slice(0, -1))}
                                className="h-16 rounded-2xl bg-slate-700/50 hover:bg-slate-700 text-slate-400 text-xl font-bold active:scale-95 transition-all"
                            >
                                Borrar
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-12 pt-8 border-t border-slate-800 flex justify-center">
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors py-2 px-4 rounded-xl hover:bg-slate-800"
                    >
                        <LogOut className="w-5 h-5" />
                        Cerrar sesión de {empresa?.nombre}
                    </button>
                </div>
            </div>
        </div>
    )
}
