import { useState, useEffect } from 'react'
import { Plus, Minus, Trash2, ChevronRight, ChevronLeft, Check, Split, X, Mail, Search } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { pedidoService } from '../services/pedidoService'
import { facturacionService } from '../services/facturacionService'
import { useAuth } from '../contexts/AuthContext'

interface SplitCheckModalProps {
    isOpen: boolean
    onClose: () => void
    pedido: any
    onSuccess: () => void
}

interface ItemSplit {
    producto_id: string
    nombre: string
    precio: number
    cantidad: number
    original_qty_ref: number
}

interface ClienteSplit {
    id: string
    nombre: string
    identificacion?: string
    email?: string
    items: ItemSplit[]
    total: number
    clienteExistenteId?: string // ID del cliente en BD si fue seleccionado
}

export function SplitCheckModal({ isOpen, onClose, pedido, onSuccess }: SplitCheckModalProps) {
    const { empresa } = useAuth()
    const [step, setStep] = useState(1)
    const [clientes, setClientes] = useState<ClienteSplit[]>([])
    const [itemsOriginales, setItemsOriginales] = useState<ItemSplit[]>([])
    const [loading, setLoading] = useState(false)
    const [nombreOriginal, setNombreOriginal] = useState('')

    // Para búsqueda de clientes existentes
    const [clientesBD, setClientesBD] = useState<any[]>([])
    const [busquedas, setBusquedas] = useState<Record<number, string>>({})
    const [busquedaOriginal, setBusquedaOriginal] = useState('')

    useEffect(() => {
        if (isOpen && pedido) {
            const items = (pedido.pedido_detalles || []).map((d: any) => ({
                producto_id: d.producto_id,
                nombre: d.productos?.nombre || 'Producto',
                precio: Number(d.precio_unitario || 0),
                cantidad: Number(d.cantidad || 0),
                original_qty_ref: Number(d.cantidad || 0)
            }))
            setItemsOriginales(items)

            setClientes([
                { id: `c-${Date.now()}`, nombre: 'Cliente 2', items: [], total: 0 }
            ])
            setStep(1)
            setLoading(false)
            setBusquedas({})
            setBusquedaOriginal('')
            setNombreOriginal(pedido.nombre_cliente_mesa || `Mesa ${pedido?.mesas?.numero || ''}`)

            // Cargar clientes existentes para búsqueda
            if (empresa?.id) {
                facturacionService.getClientes(empresa.id).then(setClientesBD).catch(console.error)
            }
        }
    }, [isOpen, pedido])

    const handleAddClient = () => {
        const nextId = clientes.length + 2
        setClientes([...clientes, {
            id: `c-${Date.now()}`,
            nombre: `Cliente ${nextId}`,
            items: [],
            total: 0
        }])
    }

    const handleRemoveClient = (idx: number) => {
        const cliente = clientes[idx]
        if (cliente.items.length > 0) {
            const newOriginales = [...itemsOriginales]
            cliente.items.forEach(cItem => {
                const origIdx = newOriginales.findIndex(oi => oi.producto_id === cItem.producto_id)
                if (origIdx >= 0) {
                    newOriginales[origIdx].cantidad += cItem.cantidad
                }
            })
            setItemsOriginales(newOriginales)
        }

        const newClientes = [...clientes]
        newClientes.splice(idx, 1)
        setClientes(newClientes)

        // Limpiar búsqueda
        const newBusquedas = { ...busquedas }
        delete newBusquedas[idx]
        setBusquedas(newBusquedas)
    }

    const updateCliente = (idx: number, field: 'nombre' | 'identificacion' | 'email', value: string) => {
        const newClientes = [...clientes]
        newClientes[idx] = { ...newClientes[idx], [field]: value }
        setClientes(newClientes)
    }

    // Seleccionar cliente existente de la BD para un slot adicional
    const seleccionarClienteExistente = (idx: number, cliente: any) => {
        const newClientes = [...clientes]
        newClientes[idx] = {
            ...newClientes[idx],
            nombre: cliente.nombre,
            identificacion: cliente.identificacion,
            email: cliente.email || '',
            clienteExistenteId: cliente.id
        }
        setClientes(newClientes)
        setBusquedas({ ...busquedas, [idx]: '' })
    }

    const moveToClient = (itemIdx: number, clientIdx: number, cantidad: number = 1) => {
        const item = itemsOriginales[itemIdx]
        if (item.cantidad < cantidad) return

        const newOriginales = [...itemsOriginales]
        newOriginales[itemIdx].cantidad -= cantidad
        setItemsOriginales(newOriginales)

        const newClientes = [...clientes]
        const cliente = newClientes[clientIdx]
        const existingItemIdx = cliente.items.findIndex(i => i.producto_id === item.producto_id)

        if (existingItemIdx >= 0) {
            cliente.items[existingItemIdx].cantidad += cantidad
        } else {
            cliente.items.push({
                ...item,
                cantidad: cantidad,
                original_qty_ref: 0
            })
        }

        cliente.total = cliente.items.reduce((sum, i) => sum + (i.precio * i.cantidad), 0)
        setClientes(newClientes)
    }

    const returnToOriginal = (clientIdx: number, itemIdx: number) => {
        const newClientes = [...clientes]
        const cliente = newClientes[clientIdx]
        const item = cliente.items[itemIdx]

        const newOriginales = [...itemsOriginales]
        const originalIdx = newOriginales.findIndex(i => i.producto_id === item.producto_id)
        if (originalIdx >= 0) {
            newOriginales[originalIdx].cantidad += 1
        }
        setItemsOriginales(newOriginales)

        if (item.cantidad > 1) {
            item.cantidad -= 1
        } else {
            cliente.items.splice(itemIdx, 1)
        }

        cliente.total = cliente.items.reduce((sum, i) => sum + (i.precio * i.cantidad), 0)
        setClientes(newClientes)
    }

    // Validar si el original tiene al menos algún item (Bug 2: opción B)
    const originalTieneItems = itemsOriginales.some(i => i.cantidad > 0)

    const handleNextStep = () => {
        if (step === 1 && clientes.length === 0) {
            alert('Agrega al menos una persona adicional')
            return
        }
        if (step === 2) {
            // Validar que el pedido original tenga al menos un ítem (Bug 2)
            if (!originalTieneItems) {
                alert('El pedido original (Mesa Principal) no puede quedar vacío. Por favor devuelve al menos un producto al cliente principal.')
                return
            }
        }
        setStep(step + 1)
    }

    const handleConfirm = async () => {
        if (!pedido) return

        // Doble validación antes de confirmar
        if (!originalTieneItems) {
            alert('El pedido original no puede quedar sin items. Devuelve al menos un producto al cliente principal.')
            return
        }

        setLoading(true)
        try {
            const nuevosPedidosPayload = clientes.map(c => ({
                nombre_cliente: c.nombre,
                identificacion_cliente: c.identificacion,
                email_cliente: c.email,
                items: c.items.filter(i => i.cantidad > 0).map(i => ({
                    producto_id: i.producto_id,
                    cantidad: i.cantidad,
                    precio: i.precio
                }))
            })).filter(p => p.items.length > 0)

            if (nuevosPedidosPayload.length === 0) {
                alert('No has asignado items a ningún cliente adicional. Si no necesitas dividir, cierra este modal.')
                setLoading(false)
                return
            }

            await pedidoService.dividirPedido(pedido.id, nuevosPedidosPayload, nombreOriginal)
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error dividiendo pedido:', error)
            alert('Error al dividir la cuenta: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    // Filtrar clientes de BD para búsqueda
    const filtrarClientesBD = (query: string) => {
        if (!query || query.length < 2) return []
        const q = query.toLowerCase()
        return clientesBD.filter(c =>
            c.nombre?.toLowerCase().includes(q) ||
            c.identificacion?.includes(query)
        ).slice(0, 5)
    }

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Split className="w-5 h-5 text-primary-600" />
                        Dividir Cuenta
                        <span className="text-sm font-normal text-slate-500 ml-2"> Paso {step} de 3</span>
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-bold text-slate-700">¿Entre cuántas personas quieres dividir los ítems?</h3>
                                <p className="text-slate-500 text-sm">El pedido original quedará para la Mesa/Cliente principal. Agrega las personas ADICIONALES.</p>
                            </div>

                            <div className="space-y-4 max-w-lg mx-auto">
                                {/* Cliente original */}
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-bold text-xs">1</div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mesa Principal (Original)</span>
                                    </div>
                                    {/* Búsqueda de cliente existente para el original */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                        <input
                                            type="text"
                                            value={busquedaOriginal || nombreOriginal}
                                            onFocus={() => setBusquedaOriginal(nombreOriginal)}
                                            onChange={(e) => {
                                                setBusquedaOriginal(e.target.value)
                                                setNombreOriginal(e.target.value)
                                            }}
                                            className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                            placeholder="Nombre Cliente Principal o buscar..."
                                        />
                                        {busquedaOriginal && filtrarClientesBD(busquedaOriginal).length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto">
                                                {filtrarClientesBD(busquedaOriginal).map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setNombreOriginal(c.nombre)
                                                            setBusquedaOriginal('')
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex justify-between"
                                                    >
                                                        <span className="font-medium">{c.nombre}</span>
                                                        <span className="text-slate-400 font-mono text-xs">{c.identificacion}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 italic">Los ítems que no asignes a otros clientes quedarán en este pedido.</p>
                                </div>

                                {/* Clientes adicionales */}
                                {clientes.map((cliente, idx) => (
                                    <div key={cliente.id} className="p-4 border border-slate-200 rounded-xl flex flex-col gap-3 relative group">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveClient(idx)}
                                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>

                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xs">{idx + 2}</div>
                                            <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">Cliente Adicional</span>
                                        </div>

                                        <div className="space-y-2">
                                            {/* Búsqueda de cliente existente */}
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={busquedas[idx] !== undefined ? busquedas[idx] : cliente.nombre}
                                                    onFocus={() => setBusquedas({ ...busquedas, [idx]: '' })}
                                                    onChange={(e) => {
                                                        setBusquedas({ ...busquedas, [idx]: e.target.value })
                                                        updateCliente(idx, 'nombre', e.target.value)
                                                    }}
                                                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                                    placeholder="Nombre o buscar cliente existente..."
                                                />
                                                {busquedas[idx] !== undefined && busquedas[idx].length >= 2 && filtrarClientesBD(busquedas[idx]).length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto">
                                                        {filtrarClientesBD(busquedas[idx]).map(c => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => seleccionarClienteExistente(idx, c)}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex justify-between"
                                                            >
                                                                <span className="font-medium">{c.nombre}</span>
                                                                <span className="text-slate-400 font-mono text-xs">{c.identificacion}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {cliente.clienteExistenteId && (
                                                <p className="text-xs text-emerald-600 font-medium">✓ Cliente existente seleccionado</p>
                                            )}
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    value={cliente.identificacion || ''}
                                                    onChange={(e) => updateCliente(idx, 'identificacion', e.target.value)}
                                                    className="px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none text-sm font-mono"
                                                    placeholder="C.I. / RUC"
                                                />
                                                <input
                                                    type="email"
                                                    value={cliente.email || ''}
                                                    onChange={(e) => updateCliente(idx, 'email', e.target.value)}
                                                    className="px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                                    placeholder="Correo Electrónico"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddClient}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-500 rounded-xl font-bold hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Agregar Persona
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col lg:flex-row gap-6 h-full">
                            <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                                <div className="p-3 bg-slate-100 font-bold text-slate-700 text-center border-b border-slate-200">
                                    Mesa Principal (Original)
                                    {!originalTieneItems && (
                                        <span className="ml-2 text-xs text-red-500 font-normal">(⚠ sin ítems — debe tener al menos uno)</span>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {itemsOriginales.map((item, idx) => (item.cantidad > 0 && (
                                        <div key={idx} className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <span className="font-medium text-slate-800">{item.nombre}</span>
                                                <span className="font-bold text-slate-900">{formatCurrency(item.precio)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-slate-500">
                                                <span>Disponibles: <strong>{item.cantidad}</strong></span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {clientes.map((client, cIdx) => (
                                                    <button
                                                        key={client.id}
                                                        onClick={() => moveToClient(idx, cIdx, 1)}
                                                        className="flex-1 py-1 px-2 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs rounded border border-primary-200 transition-colors truncate"
                                                        title={`Mover 1 a ${client.nombre}`}
                                                    >
                                                        → {client.nombre}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )))}
                                    {itemsOriginales.every(i => i.cantidad === 0) && (
                                        <div className="text-center p-8 text-red-400 font-medium">
                                            ⚠ No quedan ítems en el pedido original.<br />
                                            <span className="text-xs">Devuelve al menos un ítem antes de continuar.</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                                {clientes.map((client, cIdx) => (
                                    <div key={client.id} className="border border-primary-100 rounded-xl bg-white shadow-sm flex flex-col">
                                        <div className="p-3 bg-primary-50 border-b border-primary-100 font-bold text-primary-800 flex justify-between items-center">
                                            <div className="flex-1 pr-2">
                                                <div className="text-sm truncate">{client.nombre}</div>
                                                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                                    {client.identificacion && <span className="text-[10px] font-normal text-primary-600">ID: {client.identificacion}</span>}
                                                    {client.email && <span className="text-[10px] font-normal text-primary-600">@: {client.email}</span>}
                                                </div>
                                            </div>
                                            <span className="text-primary-900 whitespace-nowrap">{formatCurrency(client.total)}</span>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            {client.items.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Sin items asignados</p>}
                                            {client.items.map((item, iIdx) => (
                                                <div key={iIdx} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded group">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-slate-800">{item.nombre}</div>
                                                        <div className="text-xs text-slate-500">{formatCurrency(item.precio)} x {item.cantidad}</div>
                                                    </div>
                                                    <div className="font-bold text-slate-700 mr-2">{formatCurrency(item.precio * item.cantidad)}</div>
                                                    <button
                                                        onClick={() => returnToOriginal(cIdx, iIdx)}
                                                        className="text-slate-300 hover:text-red-500 p-1"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center max-w-lg mx-auto py-6">
                            <Check className="w-16 h-16 text-green-500 mx-auto mb-4 bg-green-100 rounded-full p-4" />
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Resumen de la División</h3>
                            <p className="text-slate-600 mb-8">
                                Se crearán {clientes.filter(c => c.items.length > 0).length} nuevos pedidos adicionales.
                            </p>

                            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-8">
                                <div className="flex justify-between font-bold text-slate-400 uppercase text-[10px] tracking-widest border-b border-slate-200 pb-2">
                                    <span>Cliente</span>
                                    <span>Total</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>{nombreOriginal} (Restante)</span>
                                    <span className="font-mono">{formatCurrency(itemsOriginales.reduce((sum, i) => sum + (i.precio * i.cantidad), 0))}</span>
                                </div>
                                {clientes.map(c => c.items.length > 0 && (
                                    <div key={c.id} className="flex justify-between text-sm text-slate-700 font-medium">
                                        <div className="flex flex-col">
                                            <span>{c.nombre}</span>
                                            <div className="flex gap-2 items-center">
                                                {c.identificacion && <span className="text-[10px] text-slate-400 font-mono">ID: {c.identificacion}</span>}
                                                {c.email && (
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Mail className="w-2 h-2" /> {c.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="font-mono">{formatCurrency(c.total)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-between bg-slate-50">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep(step - 1)}
                            className="px-6 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-white transition-colors flex items-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Atrás
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
                        <button
                            type="button"
                            onClick={handleNextStep}
                            className="px-6 py-2 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition-colors flex items-center gap-2"
                        >
                            Siguiente
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={loading}
                            className="px-8 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg shadow-green-200 disabled:opacity-50"
                        >
                            {loading ? 'Confirmando...' : 'Dividir Ahora'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
