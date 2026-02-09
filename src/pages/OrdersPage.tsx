import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { pedidoService } from '../services/pedidoService'
import { facturacionService } from '../services/facturacionService'
import { formatCurrency, cn } from '../lib/utils'
import {
    Clock,
    CheckCircle2,
    ChefHat,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Printer,
    RefreshCw,
    Search,
    UserPlus,
    Plus,
    Trash2,
    X,
    Save,
    User
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export function OrdersPage() {
    const { empresa, profile } = useAuth()
    const navigate = useNavigate()
    const [pedidos, setPedidos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedPedido, setExpandedPedido] = useState<string | null>(null)
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
    const [selectedPedido, setSelectedPedido] = useState<any>(null)
    const [clients, setClients] = useState<any[]>([])
    const [searchClient, setSearchClient] = useState('')
    const [selectedClient, setSelectedClient] = useState<any>(null)
    const [invoicePayments, setInvoicePayments] = useState<{ metodo: string, valor: number, referencia: string }[]>([])
    const [isSavingInvoice, setIsSavingInvoice] = useState(false)
    const [isClientFormOpen, setIsClientFormOpen] = useState(false)
    const [newClient, setNewClient] = useState({
        identificacion: '',
        nombre: '',
        email: '',
        direccion: '',
        telefono: ''
    })
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
    const [sriSystemFinanciero, setSriSystemFinanciero] = useState(false)

    useEffect(() => {
        console.log('OrdersPage - Current Empresa:', empresa)
        if (empresa?.id) {
            loadPedidos()
        }
    }, [empresa?.id])

    const loadPedidos = async () => {
        try {
            setLoading(true)
            setError(null)
            if (!empresa?.id) return

            // Si es mesero, solo ver sus propios pedidos
            let data
            if (profile?.rol === 'mesero') {
                data = await pedidoService.getPedidosByMesero(empresa.id, profile.id)
            } else {
                // Si hay fecha seleccionada, filtrar por ella (frontend o backend).
                // Por ahora filtro frontend del 'pedidos_pendientes' que suele traer todo lo activo.
                // Pero pedidoService.getPedidosPorEstado suele traer los NO facturados.
                // Para ver historial necesitamos otro método o ajustar. 
                // Asumimos que getPedidosPorEstado trae los ACTIVO (pendiente/preparacion/atendido)
                data = await pedidoService.getPedidosPorEstado(empresa.id)

                // Si la fecha NO es hoy, deberíamos buscar un historial. 
                // Pero el usuario pidió "Solo lo de hoy y calendario pa rezagados".
                // Filtramos por fecha de creacion aquí:
                if (filterDate) {
                    data = data.filter((p: any) => p.created_at.startsWith(filterDate))
                }
            }
            // Filtramos los pedidos que ya están facturados
            const filtered = data.filter((o: any) => o.estado !== 'facturado')
            setPedidos(filtered)
        } catch (err: any) {
            console.error('DETAILED ERROR LOADING PEDIDOS:', err)
            setError(err.message || 'Error desconocido al cargar pedidos')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (pedidoId: string, nuevoEstado: string) => {
        try {
            await pedidoService.updateEstadoPedido(pedidoId, nuevoEstado)
            if (nuevoEstado === 'en_preparacion') {
                // Navegar a impresión automática
                navigate(`/pedido/${pedidoId}/kitchen?auto=true`)
            }
            loadPedidos() // Refresh list
        } catch (error) {
            alert('Error al actualizar el estado')
        }
    }


    const handleResetMesa = async (pedido: any) => {
        if (!confirm(`¿Estás seguro de cancelar el pedido de la Mesa ${pedido.mesas?.numero || '?'}? Esto liberará la mesa.`)) return
        try {
            setLoading(true)
            await pedidoService.updateEstadoPedido(pedido.id, 'cancelado')
            if (pedido.mesa_id) {
                await supabase.from('mesas').update({ estado: 'libre' }).eq('id', pedido.mesa_id)
            }
            loadPedidos()
            alert('Mesa reseteada y pedido cancelado.')
        } catch (error: any) {
            console.error('Error resetting mesa:', error)
            alert('Error al resetear mesa')
        } finally {
            setLoading(false)
        }
    }

    const handleOpenInvoiceModal = async (pedido: any) => {
        try {
            setSelectedPedido(pedido)
            setLoading(true)
            const [clientsList, consumidor] = await Promise.all([
                facturacionService.getClientes(empresa!.id),
                facturacionService.getConsumidorFinal(empresa!.id)
            ])
            setClients(clientsList)
            setSelectedClient(consumidor)
            setInvoicePayments([{ metodo: 'efectivo', valor: pedido.total, referencia: '' }])
            setIsInvoiceModalOpen(true)
        } catch (error) {
            console.error('Error opening invoice modal:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddPaymentRow = () => {
        setInvoicePayments([...invoicePayments, { metodo: 'efectivo', valor: 0, referencia: '' }])
    }

    const handleRemovePaymentRow = (index: number) => {
        setInvoicePayments(invoicePayments.filter((_, i) => i !== index))
    }

    const handlePaymentChange = (index: number, field: string, value: any) => {
        const newPayments = [...invoicePayments]
        newPayments[index] = { ...newPayments[index], [field]: value }
        setInvoicePayments(newPayments)
    }

    const totalPagado = invoicePayments.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)

    const handleExecuteInvoicing = async () => {
        if (!selectedClient) {
            alert('Por favor selecciona un cliente')
            return
        }

        if (Math.abs(totalPagado - selectedPedido.total) > 0.01) {
            alert(`El total pagado (${formatCurrency(totalPagado)}) debe coincidir con el total de la orden (${formatCurrency(selectedPedido.total)})`)
            return
        }

        try {
            setIsSavingInvoice(true)
            await facturacionService.generarFacturaDesdePedido(selectedPedido, {
                clienteId: selectedClient.id,
                pagos: invoicePayments.map(p => ({ ...p, valor: Number(p.valor) })),
                sri_utilizacion_sistema_financiero: sriSystemFinanciero
            })
            alert('¡Factura generada exitosamente!')
            setIsInvoiceModalOpen(false)
            loadPedidos()
        } catch (error: any) {
            console.error('Error al facturar:', error)
            alert(`Error al facturar: ${error.message}`)
        } finally {
            setIsSavingInvoice(false)
        }
    }

    const handleSaveClient = async () => {
        try {
            if (!newClient.identificacion || !newClient.nombre) {
                alert('Identificación y Nombre son obligatorios')
                return
            }
            const saved = await facturacionService.createCliente({
                ...newClient,
                empresa_id: empresa!.id
            })
            setClients([...clients, saved])
            setSelectedClient(saved)
            setIsClientFormOpen(false)
            setNewClient({ identificacion: '', nombre: '', email: '', direccion: '', telefono: '' })
        } catch (error: any) {
            alert(`Error al guardar cliente: ${error.message}`)
        }
    }

    const getStatusStyles = (estado: string) => {
        switch (estado) {
            case 'pendiente': return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'en_preparacion': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'atendido': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'facturado': return 'bg-slate-100 text-slate-700 border-slate-200'
            default: return 'bg-slate-100 text-slate-700'
        }
    }

    if (!empresa) {
        return (
            <div className="card p-12 text-center">
                <h2 className="text-xl font-bold text-slate-800">No se encontró la configuración de la empresa</h2>
                <p className="text-slate-500 mt-2">Esto puede deberse a un error de conexión.</p>
                <div className="mt-6 flex justify-center gap-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primary"
                    >
                        Recargar Página
                    </button>
                    <Link to="/login" className="btn btn-outline">
                        Ir al Login
                    </Link>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Pedidos y Comandas</h1>
                    <p className="text-slate-500">Gestión de órdenes en tiempo real</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                        onClick={loadPedidos}
                        className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 border border-slate-200"
                        title="Actualizar Pedidos"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                    <strong>Error:</strong> {error}
                    <button onClick={loadPedidos} className="ml-4 underline">Reintentar</button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {!error && pedidos.length === 0 ? (
                    <div className="card p-12 text-center text-slate-500">
                        No hay pedidos registrados aún.
                    </div>
                ) : (
                    pedidos.map((pedido) => (
                        <div key={pedido.id} className="card overflow-hidden">
                            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-700">
                                        #{pedido.mesas?.numero || '?'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 text-lg">
                                                Pedido #{pedido.id.slice(0, 6)}
                                            </span>
                                            <span className={cn(
                                                "px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase",
                                                getStatusStyles(pedido.estado)
                                            )}>
                                                {pedido.estado.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-sm text-slate-500 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(pedido.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-sm font-bold text-primary-600">
                                                {formatCurrency(pedido.total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {pedido.estado === 'pendiente' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleUpdateStatus(pedido.id, 'en_preparacion')}
                                                className="btn bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 flex items-center gap-2"
                                            >
                                                <ChefHat className="w-4 h-4" />
                                                Preparar
                                            </button>
                                        </div>
                                    )}
                                    {pedido.estado === 'en_preparacion' && (
                                        <button
                                            onClick={() => handleUpdateStatus(pedido.id, 'atendido')}
                                            className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 px-4 flex items-center gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Servido
                                        </button>
                                    )}
                                    {pedido.estado === 'facturado' && (
                                        <Link
                                            to="/facturacion"
                                            className="btn bg-slate-600 hover:bg-slate-700 text-white text-sm py-2 px-4 flex items-center gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Ver Factura
                                        </Link>
                                    )}
                                    {pedido.estado === 'atendido' && profile?.rol === 'oficina' && (
                                        <button
                                            onClick={() => handleOpenInvoiceModal(pedido)}
                                            className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm py-2 px-4 flex items-center gap-2"
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            Facturar
                                        </button>
                                    )}
                                    <Link
                                        to={`/pedido/${pedido.id}/kitchen`}
                                        title="Imprimir Comanda Cocina"
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                                    >
                                        <Printer className="w-5 h-5" />
                                    </Link>
                                    <button
                                        onClick={() => setExpandedPedido(expandedPedido === pedido.id ? null : pedido.id)}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                                    >
                                        {expandedPedido === pedido.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Actions Footer for Cancel - Only for Oficina/Admin */}
                            {profile?.rol !== 'mesero' && (
                                <div className="px-6 pb-2">
                                    <button
                                        onClick={() => handleResetMesa(pedido)}
                                        className="text-xs text-red-400 hover:text-red-600 underline flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> Resetear Mesa / Cancelar Pedido
                                    </button>
                                </div>
                            )}

                            {expandedPedido === pedido.id && (
                                <div className="bg-slate-50 border-t border-slate-100 p-4 sm:p-6">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Detalle del Pedido</h4>
                                    <div className="space-y-3">
                                        {pedido.pedido_detalles?.map((detalle: any) => (
                                            <div key={detalle.id} className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-slate-900 w-6">{detalle.cantidad}x</span>
                                                    <span className="text-slate-700">{detalle.productos?.nombre}</span>
                                                </div>
                                                <span className="text-slate-500 font-medium whitespace-nowrap">
                                                    {formatCurrency(detalle.precio_unitario * detalle.cantidad)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                                        <span>Total</span>
                                        <span className="text-lg">{formatCurrency(pedido.total)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Modal de Facturación con Pagos Combinados */}
            {isInvoiceModalOpen && selectedPedido && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Finalizar Venta</h2>
                                <p className="text-sm text-slate-500">Orden #{selectedPedido.id.slice(0, 8)} - Total: <span className="font-bold text-primary-600">{formatCurrency(selectedPedido.total)}</span></p>
                            </div>
                            <button onClick={() => setIsInvoiceModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Sección Cliente */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                                    <User className="w-4 h-4 text-primary-500" />
                                    Datos del Cliente
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar cliente por nombre o RUC..."
                                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                            value={searchClient}
                                            onChange={(e) => setSearchClient(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsClientFormOpen(!isClientFormOpen)}
                                        className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            isClientFormOpen ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        )}
                                        title="Nuevo Cliente"
                                    >
                                        <UserPlus className="w-5 h-5" />
                                    </button>
                                </div>

                                {isClientFormOpen && (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                placeholder="RUC/Cédula"
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                                value={newClient.identificacion}
                                                onChange={e => setNewClient({ ...newClient, identificacion: e.target.value })}
                                            />
                                            <input
                                                placeholder="Nombre Completo"
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                                value={newClient.nombre}
                                                onChange={e => setNewClient({ ...newClient, nombre: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                placeholder="Email"
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                                value={newClient.email}
                                                onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                                            />
                                            <input
                                                placeholder="Teléfono"
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                                value={newClient.telefono}
                                                onChange={e => setNewClient({ ...newClient, telefono: e.target.value })}
                                            />
                                        </div>
                                        <input
                                            placeholder="Dirección"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                            value={newClient.direccion}
                                            onChange={e => setNewClient({ ...newClient, direccion: e.target.value })}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setIsClientFormOpen(false)} className="px-3 py-1 text-xs text-slate-500 font-bold uppercase">Cancelar</button>
                                            <button onClick={handleSaveClient} className="px-3 py-1 bg-primary-600 text-white rounded text-xs font-bold uppercase flex items-center gap-1">
                                                <Save className="w-3 h-3" /> Guardar Cliente
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {searchClient && (
                                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-32 overflow-y-auto shadow-sm">
                                        {clients.filter(c => c.nombre?.toLowerCase().includes(searchClient.toLowerCase()) || c.identificacion?.includes(searchClient)).map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    setSelectedClient(c)
                                                    setSearchClient('')
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 transition-colors flex justify-between"
                                            >
                                                <span>{c.nombre}</span>
                                                <span className="text-slate-400 font-mono">{c.identificacion}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {selectedClient && (
                                    <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-bold text-primary-900">{selectedClient.nombre}</p>
                                            <p className="text-xs text-primary-600">{selectedClient.identificacion} • {selectedClient.email || 'Sin correo'}</p>
                                        </div>
                                        <button onClick={() => setSelectedClient(null)} className="text-primary-400 hover:text-primary-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Sección Pagos */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                                        <CreditCard className="w-4 h-4 text-primary-500" />
                                        Formas de Pago
                                    </label>
                                    <button
                                        onClick={handleAddPaymentRow}
                                        className="text-xs flex items-center gap-1 font-bold text-primary-600 hover:text-primary-700"
                                    >
                                        <Plus className="w-3 h-3" /> Agregar Pago
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {invoicePayments.map((p, idx) => (
                                        <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-3 items-end bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div className="flex-1 min-w-[120px]">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Método</label>
                                                <select
                                                    value={p.metodo}
                                                    onChange={(e) => handlePaymentChange(idx, 'metodo', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                                >
                                                    <option value="efectivo">EFECTIVO</option>
                                                    <option value="tarjeta">TARJETA CREDITO/DEBITO</option>
                                                    <option value="transferencia">TRANSFERENCIA</option>
                                                    <option value="otros">OTROS</option>
                                                </select>
                                            </div>
                                            <div className="w-24 sm:w-32">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Valor</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={p.valor || ''}
                                                    onChange={(e) => handlePaymentChange(idx, 'valor', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[100px]">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ref/Notas</label>
                                                <input
                                                    type="text"
                                                    placeholder="Voucher, # transf..."
                                                    value={p.referencia}
                                                    onChange={(e) => handlePaymentChange(idx, 'referencia', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            {invoicePayments.length > 1 && (
                                                <button
                                                    onClick={() => handleRemovePaymentRow(idx)}
                                                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Requerimiento SRI */}
                                <div className="pt-4 border-t border-slate-100">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Requerimiento SRI</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setSriSystemFinanciero(false)}
                                            className={cn(
                                                "px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between",
                                                !sriSystemFinanciero ? "border-primary-600 bg-primary-50 text-primary-700 shadow-sm" : "border-slate-200 text-slate-500 hover:border-slate-300"
                                            )}
                                        >
                                            Sin Utilización Sist. Financiero
                                            {!sriSystemFinanciero && <div className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                                        </button>
                                        <button
                                            onClick={() => setSriSystemFinanciero(true)}
                                            className={cn(
                                                "px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between",
                                                sriSystemFinanciero ? "border-primary-600 bg-primary-50 text-primary-700 shadow-sm" : "border-slate-200 text-slate-500 hover:border-slate-300"
                                            )}
                                        >
                                            Con Utilización Sist. Financiero
                                            {sriSystemFinanciero && <div className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
                            <div className="flex justify-between items-center px-2">
                                <div className="text-sm font-medium text-slate-500">
                                    Total Pagado: <span className={cn("font-bold", Math.abs(totalPagado - selectedPedido.total) < 0.01 ? "text-emerald-600" : "text-red-500")}>
                                        {formatCurrency(totalPagado)}
                                    </span>
                                </div>
                                <div className="text-lg font-black text-slate-900">
                                    Total Orden: {formatCurrency(selectedPedido.total)}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsInvoiceModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleExecuteInvoicing}
                                    disabled={isSavingInvoice || Math.abs(totalPagado - selectedPedido.total) > 0.01}
                                    className="flex-2 bg-primary-600 text-white rounded-xl px-8 py-3 font-bold hover:bg-primary-700 shadow-xl shadow-primary-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale transition-all"
                                >
                                    {isSavingInvoice ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Confirmar y Emitir Factura
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
