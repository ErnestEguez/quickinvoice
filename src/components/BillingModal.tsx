import { useState, useEffect } from 'react'
import { facturacionService } from '../services/facturacionService'
import { formatCurrency, cn } from '../lib/utils'
import {
    Search,
    UserPlus,
    X,
    Save,
    CreditCard,
    User,
    Plus,
    Trash2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface BillingModalProps {
    isOpen: boolean
    onClose: () => void
    pedido: any // El pedido completo si ya existe
    onSuccess: (factura: any) => void
}

export function BillingModal({ isOpen, onClose, pedido, onSuccess }: BillingModalProps) {
    const { empresa, cajaSesion } = useAuth()
    const [clients, setClients] = useState<any[]>([])
    const [searchClient, setSearchClient] = useState('')
    const [selectedClient, setSelectedClient] = useState<any>(null)
    const [invoicePayments, setInvoicePayments] = useState<{ metodo: string, valor: number, referencia: string }[]>([])
    const [isSavingInvoice, setIsSavingInvoice] = useState(false)
    const [isClientFormOpen, setIsClientFormOpen] = useState(false)
    const [sriSystemFinanciero, setSriSystemFinanciero] = useState(false)
    const [loading, setLoading] = useState(true)
    const [newClient, setNewClient] = useState({
        identificacion: '',
        nombre: '',
        email: '',
        direccion: '',
        telefono: ''
    })

    useEffect(() => {
        if (isOpen && empresa?.id) {
            loadInitialData()
        }
    }, [isOpen, empresa?.id])

    async function loadInitialData() {
        try {
            setLoading(true)
            const [clientsList, consumidor] = await Promise.all([
                facturacionService.getClientes(empresa!.id),
                facturacionService.getConsumidorFinal(empresa!.id)
            ])
            setClients(clientsList)

            // LÓGICA DE AUTO-IDENTIFICACION PARA PEDIDOS DIVIDIDOS
            if (pedido?.identificacion_cliente_mesa) {
                const found = clientsList.find(c => c.identificacion === pedido.identificacion_cliente_mesa)
                if (found) {
                    setSelectedClient(found)
                } else if (pedido.nombre_cliente_mesa) {
                    // Si no existe pero tenemos datos, sugerir creación abriendo el form
                    setSelectedClient(null)
                    setIsClientFormOpen(true)
                    setNewClient({
                        identificacion: pedido.identificacion_cliente_mesa || '',
                        nombre: pedido.nombre_cliente_mesa || '',
                        email: pedido.email_cliente_mesa || '',
                        direccion: 'S/N',
                        telefono: '0000000000'
                    })
                }
            } else {
                setSelectedClient(consumidor)
            }

            if (pedido) {
                setInvoicePayments([{ metodo: 'efectivo', valor: pedido.total, referencia: '' }])
            }
        } catch (error) {
            console.error('Error loading billing data:', error)
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

    const handleSaveClient = async () => {
        try {
            if (!newClient.identificacion || !newClient.nombre) {
                alert('Identificación y Nombre son obligatorios')
                return
            }
            // Verificar si ya existe un cliente con esa identificación (Bug 3: no duplicar)
            const existing = clients.find(c => c.identificacion === newClient.identificacion)
            if (existing) {
                // Ya existe en la lista local → simplemente seleccionarlo
                setSelectedClient(existing)
                setIsClientFormOpen(false)
                setNewClient({ identificacion: '', nombre: '', email: '', direccion: '', telefono: '' })
                return
            }
            // Verificar también en la BD por si acaso no estuviera en la lista local
            const { data: existingInDB } = await (await import('../lib/supabase')).supabase
                .from('clientes')
                .select('*')
                .eq('empresa_id', empresa!.id)
                .eq('identificacion', newClient.identificacion)
                .maybeSingle()

            if (existingInDB) {
                // Existe en BD pero no en lista local: agregarlo a la lista local y seleccionarlo
                setClients([...clients, existingInDB])
                setSelectedClient(existingInDB)
                setIsClientFormOpen(false)
                setNewClient({ identificacion: '', nombre: '', email: '', direccion: '', telefono: '' })
                return
            }

            // No existe → crear nuevo
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

    const handleExecuteInvoicing = async () => {
        if (!selectedClient) {
            alert('Por favor selecciona un cliente')
            return
        }

        if (Math.abs(totalPagado - pedido.total) > 0.01) {
            alert(`El total pagado (${formatCurrency(totalPagado)}) debe coincidir con el total (${formatCurrency(pedido.total)})`)
            return
        }

        try {
            setIsSavingInvoice(true)
            const factura = await facturacionService.generarFacturaDesdePedido(pedido, {
                clienteId: selectedClient.id,
                pagos: invoicePayments.map(p => ({ ...p, valor: Number(p.valor) })),
                sri_utilizacion_sistema_financiero: sriSystemFinanciero,
                caja_sesion_id: cajaSesion?.id
            })
            onSuccess(factura)
        } catch (error: any) {
            console.error('Error al facturar:', error)
            alert(`Error al facturar: ${error.message}`)
        } finally {
            setIsSavingInvoice(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Finalizar Venta</h2>
                        {pedido && (
                            <p className="text-sm text-slate-500">Total a pagar: <span className="font-bold text-primary-600">{formatCurrency(pedido.total)}</span></p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
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
                            Total Pagado: <span className={cn("font-bold", Math.abs(totalPagado - pedido.total) < 0.01 ? "text-emerald-600" : "text-red-500")}>
                                {formatCurrency(totalPagado)}
                            </span>
                        </div>
                        <div className="text-lg font-black text-slate-900">
                            Total: {formatCurrency(pedido.total)}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleExecuteInvoicing}
                            disabled={isSavingInvoice || Math.abs(totalPagado - pedido.total) > 0.01}
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
    )
}
