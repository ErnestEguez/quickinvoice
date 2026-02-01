import { useEffect, useState } from 'react'
import { mesaService } from '../services/mesaService'
import type { Mesa } from '../services/mesaService'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Users, Clock } from 'lucide-react'

interface MesaCardProps {
    mesa: Mesa
    onClick: (mesa: Mesa) => void
}

function MesaCard({ mesa, onClick }: MesaCardProps) {
    const statusColors = {
        libre: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
        ocupada: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
        reservada: 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100',
        atendida: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
    }

    const dotColors = {
        libre: 'bg-emerald-500',
        ocupada: 'bg-amber-500',
        reservada: 'bg-primary-500',
        atendida: 'bg-blue-500',
    }

    return (
        <button
            onClick={() => onClick(mesa)}
            className={cn(
                "card p-6 border-2 transition-all duration-200 text-left flex flex-col justify-between h-48",
                statusColors[mesa.estado]
            )}
        >
            <div className="flex justify-between items-start">
                <div>
                    <span className="text-3xl font-black">{mesa.numero}</span>
                    <p className="text-xs font-bold uppercase tracking-widest mt-1 opacity-70">
                        Mesa
                    </p>
                </div>
                <div className={cn("w-3 h-3 rounded-full shadow-sm animate-pulse", dotColors[mesa.estado])} />
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 opacity-60" />
                    <span className="font-medium">{mesa.capacidad} personas</span>
                </div>
                {mesa.estado !== 'libre' && (
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 opacity-60" />
                        <span className="font-medium">45 min</span>
                    </div>
                )}
            </div>

            <div className="mt-2 pt-2 border-t border-current border-opacity-10 text-xs font-bold uppercase tracking-wider text-right">
                {mesa.estado === 'libre' ? 'Disponible' : mesa.estado}
            </div>
        </button>
    )
}

import { useNavigate } from 'react-router-dom'

export function MesaGrid() {
    const navigate = useNavigate()
    const [mesas, setMesas] = useState<Mesa[]>([])
    const [loading, setLoading] = useState(true)
    const { } = useAuth()

    useEffect(() => {
        loadMesas()

        const subscription = mesaService.subscribeToMesas(() => {
            loadMesas()
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    async function loadMesas() {
        try {
            const data = await mesaService.getMesas()
            setMesas(data)
        } catch (error) {
            console.error('Error loading mesas:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleMesaClick = (mesa: Mesa) => {
        if (mesa.estado === 'reservada') {
            alert('Mesa reservada. Próximamente gestión de reservas.')
            return
        }

        // Redirigimos siempre a la toma de pedidos. 
        // Si hay un pedido activo, OrderTake lo detectará.
        navigate(`/mesas/${mesa.id}/pedido`)
    }

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="card h-48 animate-pulse bg-slate-100" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gestión de Mesas</h1>
                    <p className="text-slate-500">Vista en tiempo real del salón</p>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                {['Todas', 'Libres', 'Ocupadas', 'Reservadas'].map((filter) => (
                    <button
                        key={filter}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                            filter === 'Todas'
                                ? "bg-slate-900 text-white"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {mesas.map((mesa) => (
                    <MesaCard key={mesa.id} mesa={mesa} onClick={handleMesaClick} />
                ))}
                {mesas.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center card bg-slate-50 border-dashed">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No hay mesas configuradas</h3>
                        <p className="text-slate-500 mt-1">Empieza por añadir algunas mesas a tu salón.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
