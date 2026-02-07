import { useEffect, useState } from 'react'
import { mesaService, type Mesa } from '../services/mesaService'
import { reservaService, type Reserva } from '../services/reservaService'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Users, Clock, RefreshCcw } from 'lucide-react'

interface MesaCardProps {
    mesa: Mesa
    proximaReserva?: Reserva
    onClick: (mesa: Mesa) => void
    onReset: (mesa: Mesa) => void
}

function MesaCard({ mesa, proximaReserva, onClick, onReset }: MesaCardProps) {
    // If it's free but has a reservation soon, we treat it as reserved
    const ambientEstado = (mesa.estado === 'libre' && proximaReserva) ? 'reservada' : mesa.estado

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
        <div className="relative group">
            <button
                onClick={() => onClick(mesa)}
                className={cn(
                    "card p-6 border-2 transition-all duration-200 text-left flex flex-col justify-between h-48 w-full",
                    statusColors[ambientEstado]
                )}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <span className="text-3xl font-black">{mesa.numero}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className={cn("w-2 h-2 rounded-full", dotColors[ambientEstado])} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                {ambientEstado}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-xs font-bold opacity-60">
                            <Users className="w-3 h-3" />
                            {mesa.capacidad}
                        </div>
                        {proximaReserva && (
                            <div className="flex items-center gap-1 text-[10px] font-black bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(proximaReserva.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-2 pt-2 border-t border-current border-opacity-10 text-xs font-bold uppercase tracking-wider text-right">
                    {ambientEstado === 'libre' ? 'Disponible' : ambientEstado}
                </div>
            </button>
            {mesa.estado !== 'libre' && (
                <button
                    onClick={(e) => { e.stopPropagation(); onReset(mesa); }}
                    title="Resetear mesa / Liberar"
                    className="absolute -top-2 -right-2 p-2 bg-white rounded-full shadow-lg border border-slate-200 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                    <RefreshCcw className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

import { useNavigate } from 'react-router-dom'

export function MesaGrid() {
    const navigate = useNavigate()
    const [mesas, setMesas] = useState<Mesa[]>([])
    const [reservas, setReservas] = useState<Reserva[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'Todas' | 'Libres' | 'Ocupadas' | 'Reservadas'>('Todas')
    const { empresa } = useAuth()

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

            if (empresa?.id) {
                const resData = await reservaService.getReservasProximas(empresa.id)
                setReservas(resData)
            }
        } catch (error) {
            console.error('Error loading mesas:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleMesaClick = async (mesa: Mesa) => {
        const reserva = getMesaReserva(mesa.id)
        if (mesa.estado === 'reservada' || (mesa.estado === 'libre' && reserva)) {
            const ok = confirm(`Esta mesa tiene una reserva para las ${new Date(reserva?.fecha_hora || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ¿Deseas atender esta reserva ahora?`)
            if (!ok) return

            // Marcar reserva como completada si existe
            if (reserva) {
                await reservaService.cambiarEstado(reserva.id, 'completada')
            }
            // Cambiar mesa a ocupada
            await mesaService.setMesaEstado(mesa.id, 'ocupada')
        }

        navigate(`/mesas/${mesa.id}/pedido`)
    }

    const getMesaReserva = (mesaId: string) => {
        const ahora = new Date()
        const limite = new Date(ahora.getTime() + 90 * 60000) // 90 minutos

        return reservas.find(r =>
            r.mesa_id === mesaId &&
            new Date(r.fecha_hora) >= ahora &&
            new Date(r.fecha_hora) <= limite
        )
    }

    const handleResetMesa = async (mesa: Mesa) => {
        if (!confirm(`¿Estás seguro de resetear la Mesa ${mesa.numero}? Se cancelarán pedidos pendientes no facturados.`)) return
        try {
            await mesaService.resetMesa(mesa.id)
            loadMesas()
        } catch (error) {
            alert('Error al resetear la mesa')
        }
    }

    const filteredMesas = mesas.filter(m => {
        const hasReserva = getMesaReserva(m.id)
        const ambientEstado = (m.estado === 'libre' && hasReserva) ? 'reservada' : m.estado

        if (filter === 'Libres') return ambientEstado === 'libre'
        if (filter === 'Ocupadas') return ambientEstado === 'ocupada' || ambientEstado === 'atendida'
        if (filter === 'Reservadas') return ambientEstado === 'reservada'
        return true
    })

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
                {['Todas', 'Libres', 'Ocupadas', 'Reservadas'].map((f: any) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                            f === filter
                                ? "bg-slate-900 text-white"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredMesas.map((mesa) => (
                    <MesaCard
                        key={mesa.id}
                        mesa={mesa}
                        proximaReserva={getMesaReserva(mesa.id)}
                        onClick={handleMesaClick}
                        onReset={handleResetMesa}
                    />
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
