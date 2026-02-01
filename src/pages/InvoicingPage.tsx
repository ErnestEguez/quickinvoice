import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { sriService } from '../services/sriService'
import { facturacionService } from '../services/facturacionService'
import type { SriConfig } from '../services/facturacionService'
import type { Comprobante } from '../services/sriService'
import { formatCurrency, cn } from '../lib/utils'
import {
    FileText,
    Send,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    ExternalLink,
    Settings2,
    X,
    Save,
    Shield,
    Key,
    RotateCw,
    Printer,
    Mail
} from 'lucide-react'
import { format } from 'date-fns'

import { useAuth } from '../contexts/AuthContext'

export function InvoicingPage() {
    const { empresa } = useAuth()
    const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
    const [sriConfig, setSriConfig] = useState<Partial<SriConfig>>({})
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        if (empresa?.id) {
            loadData()
        }
    }, [empresa?.id, selectedDate])

    async function loadData() {
        try {
            setLoading(true)
            const [docsData, configData] = await Promise.all([
                sriService.getComprobantes(empresa!.id, selectedDate),
                facturacionService.getSriConfig(empresa!.id)
            ])
            console.log('DEBUG: Invoices fetched:', docsData)
            setComprobantes(docsData)
            setSriConfig(configData)
        } catch (error) {
            console.error('Error loading invoicing data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveConfig(e: React.FormEvent) {
        e.preventDefault()
        try {
            setLoading(true)

            let firmaUrl = sriConfig.firma_url || null
            if (selectedFile) {
                try {
                    firmaUrl = await sriService.uploadFirma(empresa!.id, selectedFile)
                } catch (uploadError: any) {
                    console.error('Error uploading signature:', uploadError)
                    alert(`Error al subir la firma: ${uploadError.message || 'Verifique que el bucket "firmas_electronicas" exista y tenga políticas de acceso.'}`)
                    return
                }
            }

            await facturacionService.updateSriConfig(empresa!.id, {
                ...sriConfig,
                firma_url: firmaUrl
            })

            setIsConfigModalOpen(false)
            alert('Configuración SRI actualizada correctamente')
            loadData()
        } catch (error) {
            console.error('Error updating SRI config:', error)
            alert('Error al actualizar la configuración')
        } finally {
            setLoading(false)
        }
    }

    async function handleConsultarEstado(id: string) {
        try {
            const newState = await sriService.consultarEstadoComprobante(id)
            alert(`Nuevo estado SRI: ${newState}`)
            loadData()
        } catch (error) {
            console.error('Error al consultar SRI:', error)
        }
    }

    const filtered = comprobantes.filter(c =>
        c.secuencial.includes(search) ||
        c.cliente_nombre.toLowerCase().includes(search.toLowerCase())
    )

    const statusIcons = {
        PENDIENTE: <Clock className="w-4 h-4 text-slate-400" />,
        ENVIADO: <Send className="w-4 h-4 text-blue-500" />,
        AUTORIZADO: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        RECHAZADO: <XCircle className="w-4 h-4 text-red-500" />
    }

    const statusColors = {
        PENDIENTE: "bg-slate-100 text-slate-600",
        ENVIADO: "bg-blue-100 text-blue-700",
        AUTORIZADO: "bg-emerald-100 text-emerald-700",
        RECHAZADO: "bg-red-100 text-red-700"
    }

    if (loading) return <div className="p-12 text-center">Cargando facturación...</div>

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Facturación Electrónica</h1>
                    <p className="text-slate-500">Gestión de documentos autorizados por el SRI</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsConfigModalOpen(true)}
                        className="btn bg-white border border-slate-200 text-slate-600 gap-2"
                    >
                        <Settings2 className="w-4 h-4" />
                        Configurar SRI
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Autorizados', count: comprobantes.filter(c => c.estado_sri === 'AUTORIZADO').length, color: 'text-emerald-600' },
                    { label: 'Pendientes', count: comprobantes.filter(c => c.estado_sri === 'PENDIENTE').length, color: 'text-slate-600' },
                    { label: 'Enviados', count: comprobantes.filter(c => c.estado_sri === 'ENVIADO').length, color: 'text-blue-600' },
                    { label: 'Rechazados', count: comprobantes.filter(c => c.estado_sri === 'RECHAZADO').length, color: 'text-red-600' },
                ].map((stat) => (
                    <div key={stat.label} className="card p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <p className={cn("text-2xl font-black mt-1", stat.color)}>{stat.count}</p>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por secuencial o cliente..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Fecha:</span>
                        <input
                            type="date"
                            className="px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        {selectedDate && (
                            <button
                                onClick={() => setSelectedDate('')}
                                className="text-xs text-primary-600 font-bold hover:underline"
                            >
                                Ver Todo
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Secuencial</th>
                                <th className="px-6 py-4 font-medium">Cliente</th>
                                <th className="px-6 py-4 font-medium">Fecha</th>
                                <th className="px-6 py-4 font-medium text-right">Total</th>
                                <th className="px-6 py-4 font-medium">Estado SRI</th>
                                <th className="px-6 py-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((doc) => (
                                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-sm font-bold text-slate-900">
                                        {doc.secuencial}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-slate-900">{doc.cliente_nombre}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span>{doc.tipo_comprobante}</span>
                                            {doc.pedido_info?.mesa_numero && (
                                                <>
                                                    <span>•</span>
                                                    <span className="font-bold text-primary-600">Mesa {doc.pedido_info.mesa_numero}</span>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {format(new Date(doc.fecha), 'dd/MM/yyyy HH:mm')}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                                        {formatCurrency(doc.total)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                                            statusColors[doc.estado_sri]
                                        )}>
                                            {statusIcons[doc.estado_sri]}
                                            {doc.estado_sri}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {doc.estado_sri !== 'AUTORIZADO' && (
                                                <button
                                                    onClick={() => handleConsultarEstado(doc.id)}
                                                    title="Consultar SRI"
                                                    className="p-2 hover:bg-slate-100 rounded-lg text-primary-600 transition-colors"
                                                >
                                                    <RotateCw className="w-4 h-4" />
                                                </button>
                                            )}
                                            <Link
                                                to={`/comprobante/${doc.id}/print`}
                                                title="Ver RIDE"
                                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </Link>
                                            <Link
                                                to={`/comprobante/${doc.id}/ticket`}
                                                title="Ticket 80mm"
                                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    if (doc.clave_acceso) {
                                                        navigator.clipboard.writeText(doc.clave_acceso)
                                                        alert('Clave de acceso copiada al portapapeles.\nInstrucciones: Pega la clave en el campo "Clave de Acceso" del portal SRI que se abrirá a continuación.')
                                                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/consulta/55', '_blank')
                                                    } else {
                                                        alert('Este comprobante no tiene clave de acceso asignada.')
                                                    }
                                                }}
                                                title="Ver en SRI (Copia clave y abre portal)"
                                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                                        No se encontraron documentos electrónicos.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Configuración SRI */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">Configuración SRI</h2>
                            </div>
                            <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveConfig} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ambiente</label>
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setSriConfig({ ...sriConfig, ambiente: 'PRUEBAS' })}
                                            className={cn(
                                                "flex-1 py-1.5 rounded-md text-xs font-bold transition-all",
                                                sriConfig.ambiente === 'PRUEBAS' ? "bg-white text-primary-600 shadow-sm" : "text-slate-500"
                                            )}
                                        >
                                            PRUEBAS
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSriConfig({ ...sriConfig, ambiente: 'PRODUCCION' })}
                                            className={cn(
                                                "flex-1 py-1.5 rounded-md text-xs font-bold transition-all",
                                                sriConfig.ambiente === 'PRODUCCION' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                                            )}
                                        >
                                            PRODUCCIÓN
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Secuencial Inicio</label>
                                    <input
                                        type="number"
                                        placeholder="1"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={sriConfig.secuencial_inicio || ''}
                                        onChange={(e) => setSriConfig({ ...sriConfig, secuencial_inicio: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Establecimiento</label>
                                    <input
                                        type="text"
                                        maxLength={3}
                                        placeholder="001"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                                        value={sriConfig.establecimiento || ''}
                                        onChange={(e) => setSriConfig({ ...sriConfig, establecimiento: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Punto de Emisión</label>
                                    <input
                                        type="text"
                                        maxLength={3}
                                        placeholder="001"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                                        value={sriConfig.punto_emision || ''}
                                        onChange={(e) => setSriConfig({ ...sriConfig, punto_emision: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-slate-900 font-bold mb-2">
                                    <Key className="w-4 h-4 text-primary-500" />
                                    <span>Firma Electrónica (.p12)</span>
                                </div>
                                <div className="grid gap-4">
                                    <input
                                        type="file"
                                        accept=".p12"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Contraseña de la firma"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={sriConfig.firma_password || ''}
                                        onChange={(e) => setSriConfig({ ...sriConfig, firma_password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-slate-900 font-bold mb-2">
                                    <Mail className="w-4 h-4 text-primary-500" />
                                    <span>Servidor de Correo (SMTP)</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <input
                                            type="text"
                                            placeholder="Servidor SMTP"
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                                            value={sriConfig.mail_host || ''}
                                            onChange={(e) => setSriConfig({ ...sriConfig, mail_host: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            placeholder="Puerto"
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                                            value={sriConfig.mail_port || 587}
                                            onChange={(e) => setSriConfig({ ...sriConfig, mail_port: parseInt(e.target.value) || 587 })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Usuario / Correo"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                                        value={sriConfig.mail_user || ''}
                                        onChange={(e) => setSriConfig({ ...sriConfig, mail_user: e.target.value })}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Contraseña"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 outline-none text-xs"
                                        value={sriConfig.mail_pass || ''}
                                        onChange={(e) => setSriConfig({ ...sriConfig, mail_pass: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsConfigModalOpen(false)}
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-primary-600 text-white rounded-lg px-4 py-2 font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
