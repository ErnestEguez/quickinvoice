import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { staffService } from '../services/staffService'
import { sriService } from '../services/sriService'
import { mesaService, type Mesa } from '../services/mesaService'
import type { StaffMember } from '../services/staffService'
import {
    Users,
    Building2,
    Save,
    Plus,
    Trash2,
    Edit2,
    Shield,
    Percent,
    Image as ImageIcon,
    Loader2,
    Grid,
    Utensils
} from 'lucide-react'
import { cn } from '../lib/utils'

export function ConfigurationPage() {
    const { empresa, profile } = useAuth()
    const [activeTab, setActiveTab] = useState<'empresa' | 'staff' | 'mesas' | 'plataforma'>('empresa')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Empresa State
    const [companyData, setCompanyData] = useState<any>({
        nombre: '',
        ruc: '',
        direccion_matriz: '',
        logo_url: '',
        config_iva: 15.0,
        config_propina: 10.0
    })

    // Staff State
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
    const [editingStaff, setEditingStaff] = useState<Partial<StaffMember> | null>(null)

    // Mesas State
    const [mesas, setMesas] = useState<Mesa[]>([])
    const [isMesaModalOpen, setIsMesaModalOpen] = useState(false)
    const [editingMesa, setEditingMesa] = useState<Partial<Mesa> | null>(null)

    // Plataforma State (Admin)
    const [allEmpresas, setAllEmpresas] = useState<any[]>([])
    const [isEmpresaModalOpen, setIsEmpresaModalOpen] = useState(false)
    const [editingEmpresa, setEditingEmpresa] = useState<any>(null)

    useEffect(() => {
        if (profile?.rol === 'admin_plataforma') {
            setActiveTab('plataforma')
        }
    }, [profile?.rol])

    useEffect(() => {
        if (empresa?.id) {
            loadData()
        }
    }, [empresa?.id])

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setSaving(true)
            const publicUrl = await sriService.uploadLogo(empresa!.id, file)
            setCompanyData({ ...companyData, logo_url: publicUrl })

            // Auto-guardar en DB
            await supabase
                .from('empresas')
                .update({ logo_url: publicUrl })
                .eq('id', empresa!.id)

            alert('Logo subido y actualizado con éxito')
        } catch (error: any) {
            if (error.message?.includes('Bucket not found')) {
                alert('ERROR: No se encontró el bucket "logos" en Supabase. Por favor, crea el bucket manualmente en el panel de Supabase Storage con el nombre "logos" y marca la opción "Public".')
            } else {
                alert(`Error al subir logo: ${error.message}`)
            }
        } finally {
            setSaving(false)
        }
    }

    async function loadData() {
        try {
            setLoading(true)

            // Si es plataforma admin, podemos ver todo
            if (profile?.rol === 'admin_plataforma') {
                const { data: emps } = await supabase.from('empresas').select('*').order('nombre')
                setAllEmpresas(emps || [])
            }

            if (empresa?.id) {
                const [empData, staffData, mesasData] = await Promise.all([
                    supabase.from('empresas').select('*').eq('id', empresa!.id).single(),
                    staffService.getStaffByEmpresa(empresa!.id),
                    mesaService.getMesas()
                ])
                if (empData.data) setCompanyData(empData.data)
                setStaff(staffData.filter(s => s.rol !== 'admin_plataforma'))
                setMesas(mesasData)
            }
        } catch (error) {
            console.error('Error loading config:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveEmpresaFull() {
        try {
            setSaving(true)
            if (editingEmpresa.id) {
                await supabase.from('empresas').update(editingEmpresa).eq('id', editingEmpresa.id)
            } else {
                await supabase.from('empresas').insert(editingEmpresa)
            }
            setIsEmpresaModalOpen(false)
            setEditingEmpresa(null)
            loadData()
            alert('Empresa guardada con éxito')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveCompany(e: React.FormEvent) {
        e.preventDefault()
        try {
            setSaving(true)
            const { error } = await supabase
                .from('empresas')
                .update({
                    nombre: companyData.nombre,
                    ruc: companyData.ruc,
                    direccion_matriz: companyData.direccion_matriz,
                    logo_url: companyData.logo_url,
                    config_iva: companyData.config_iva,
                    config_propina: companyData.config_propina
                })
                .eq('id', empresa!.id)

            if (error) throw error
            alert('Configuración de empresa guardada')
        } catch (error: any) {
            alert(`Error al guardar: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveStaffMember() {
        try {
            setSaving(true)
            if (!editingStaff?.nombre || !editingStaff?.rol) {
                alert('Nombre y Rol son obligatorios')
                return
            }

            if (editingStaff.id) {
                await staffService.updateStaffMember(editingStaff.id, editingStaff)
            } else {
                await staffService.createStaffMember({
                    ...editingStaff,
                    empresa_id: empresa!.id
                })
            }

            setIsStaffModalOpen(false)
            setEditingStaff(null)
            loadData()
        } catch (error: any) {
            alert(`Error al guardar staff: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteStaff(id: string) {
        if (!confirm('¿Estás seguro de eliminar a este miembro del personal?')) return
        try {
            await staffService.deleteStaffMember(id)
            loadData()
        } catch (error: any) {
            alert(`Error al eliminar: ${error.message}`)
        }
    }

    async function handleSaveMesa() {
        try {
            setSaving(true)
            if (!editingMesa?.numero || !editingMesa?.capacidad) {
                alert('Número y Capacidad son obligatorios')
                return
            }

            if (editingMesa.id) {
                await mesaService.updateMesa(editingMesa.id, editingMesa)
            } else {
                await mesaService.createMesa({
                    ...editingMesa,
                    empresa_id: empresa!.id,
                    estado: 'libre'
                } as any)
            }

            setIsMesaModalOpen(false)
            setEditingMesa(null)
            loadData()
        } catch (error: any) {
            alert(`Error al guardar mesa: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteMesa(id: string) {
        if (!confirm('¿Estás seguro de eliminar esta mesa?')) return
        try {
            await mesaService.deleteMesa(id)
            loadData()
        } catch (error: any) {
            alert(`Error al eliminar mesa: ${error.message}`)
        }
    }

    if (loading) return <div className="p-12 text-center">Cargando configuración...</div>

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
                    <p className="text-slate-500">Gestiona tu empresa y personal</p>
                </div>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('empresa')}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'empresa' ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Building2 className="w-4 h-4" />
                    Empresa
                </button>
                <button
                    onClick={() => setActiveTab('staff')}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'staff' ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Users className="w-4 h-4" />
                    Personal
                </button>
                <button
                    onClick={() => setActiveTab('mesas')}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'mesas' ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Grid className="w-4 h-4" />
                    Mesas
                </button>
                {profile?.rol === 'admin_plataforma' && (
                    <button
                        onClick={() => setActiveTab('plataforma')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                            activeTab === 'plataforma' ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Shield className="w-4 h-4" />
                        Plataforma
                    </button>
                )}
            </div>

            {activeTab === 'empresa' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSaveCompany} className="card p-8 space-y-8">
                            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                                <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Datos Generales</h2>
                                    <p className="text-sm text-slate-500">Información legal y visual del negocio</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Razón Social</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500"
                                        value={companyData.nombre}
                                        onChange={e => setCompanyData({ ...companyData, nombre: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">RUC</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500"
                                        value={companyData.ruc}
                                        onChange={e => setCompanyData({ ...companyData, ruc: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Dirección Matriz</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500"
                                        value={companyData.direccion_matriz}
                                        onChange={e => setCompanyData({ ...companyData, direccion_matriz: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" /> Logo del Negocio
                                    </label>
                                    <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                        {companyData.logo_url ? (
                                            <img src={companyData.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg border bg-white" />
                                        ) : (
                                            <div className="w-20 h-20 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                                <ImageIcon className="w-8 h-8" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-700">Subir nuevo logo</p>
                                            <p className="text-xs text-slate-500 mb-3">Recomendado: PNG fondo transparente</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-4 pb-4 border-b border-slate-100">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                                    <Percent className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Impuestos y Servicios</h2>
                                    <p className="text-sm text-slate-500">Valores aplicados a los pedidos</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">IVA por Defecto (%)</label>
                                    <div className="flex gap-2">
                                        {[0, 8, 15].map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setCompanyData({ ...companyData, config_iva: v })}
                                                className={cn(
                                                    "flex-1 py-2 rounded-lg text-sm font-bold border transition-all",
                                                    companyData.config_iva === v
                                                        ? "bg-primary-50 border-primary-200 text-primary-600"
                                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                                )}
                                            >
                                                {v}%
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Propina Sugerida (%)</label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500"
                                        value={companyData.config_propina}
                                        onChange={e => setCompanyData({ ...companyData, config_propina: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn btn-primary w-full py-4 text-lg font-black flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6" /> Guardar Todo</>}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="card p-6 bg-primary-600 text-white">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <Shield className="w-5 h-5 text-primary-200" />
                                Resumen
                            </h3>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between border-b border-primary-500 pb-2">
                                    <span className="text-primary-100">IVA</span>
                                    <span className="font-bold">{companyData.config_iva}%</span>
                                </div>
                                <div className="flex justify-between border-b border-primary-500 pb-2">
                                    <span className="text-primary-100">Propina</span>
                                    <span className="font-bold">{companyData.config_propina}%</span>
                                </div>
                                <div className="flex justify-between pb-2">
                                    <span className="text-primary-100">RUC</span>
                                    <span className="font-bold">{companyData.ruc || 'N/D'}</span>
                                </div>
                            </div>
                        </div>

                        {companyData.logo_url && (
                            <div className="card p-6 flex flex-col items-center">
                                <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-4">Logo</p>
                                <img src={companyData.logo_url} alt="Logo" className="max-h-32 object-contain rounded-xl" />
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'staff' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Personal de Servicio</h2>
                            <p className="text-sm text-slate-500">Administra los meseros y personal de cocina</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingStaff({ rol: 'mesero' })
                                setIsStaffModalOpen(true)
                            }}
                            className="btn btn-primary py-2 px-4 text-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nuevo Miembro
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {staff.map(member => (
                            <div key={member.id} className="card p-6 group">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg",
                                            member.rol === 'oficina' ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-600"
                                        )}>
                                            {member.nombre[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">{member.nombre}</h3>
                                            <p className="text-xs text-slate-500">{member.rol}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingStaff(member); setIsStaffModalOpen(true) }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteStaff(member.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeTab === 'mesas' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Configuración de Mesas</h2>
                            <p className="text-sm text-slate-500">Administra la distribución de tu restaurante</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingMesa({ capacidad: 4, estado: 'libre' })
                                setIsMesaModalOpen(true)
                            }}
                            className="btn btn-primary py-2 px-4 text-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nueva Mesa
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {mesas.map(mesa => (
                            <div key={mesa.id} className="card p-4 group relative hover:shadow-lg transition-all">
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingMesa(mesa); setIsMesaModalOpen(true) }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeleteMesa(mesa.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-red-400">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                                        <Utensils className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg">Mesa {mesa.numero}</h3>
                                    <p className="text-xs text-slate-500 font-medium">{mesa.capacidad} Pers.</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeTab === 'mesas' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Configuración de Mesas</h2>
                            <p className="text-sm text-slate-500">Administra la distribución de tu restaurante</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingMesa({ capacidad: 4, estado: 'libre' })
                                setIsMesaModalOpen(true)
                            }}
                            className="btn btn-primary py-2 px-4 text-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nueva Mesa
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {mesas.map(mesa => (
                            <div key={mesa.id} className="card p-4 group relative hover:shadow-lg transition-all">
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingMesa(mesa); setIsMesaModalOpen(true) }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeleteMesa(mesa.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-red-400">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                                        <Utensils className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg">Mesa {mesa.numero}</h3>
                                    <p className="text-xs text-slate-500 font-medium">{mesa.capacidad} Pers.</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Gestión de Empresas (SaaS)</h2>
                            <p className="text-sm text-slate-500">Administra todos los negocios registrados en la plataforma</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingEmpresa({ nombre: '', ruc: '' })
                                setIsEmpresaModalOpen(true)
                            }}
                            className="btn btn-primary py-2 px-4 text-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nueva Empresa
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allEmpresas.map(emp => (
                            <div key={emp.id} className="card p-6 group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-slate-900">{emp.nombre}</h3>
                                        <p className="text-xs text-slate-500">RUC: {emp.ruc}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingEmpresa(emp)
                                            setIsEmpresaModalOpen(true)
                                        }}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 group-hover:text-primary-600"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {isEmpresaModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
                        <h2 className="text-xl font-bold">{editingEmpresa?.id ? 'Editar' : 'Nueva'} Empresa</h2>
                        <input
                            type="text" placeholder="Nombre" className="w-full px-4 py-3 rounded-xl border"
                            value={editingEmpresa?.nombre || ''}
                            onChange={e => setEditingEmpresa({ ...editingEmpresa, nombre: e.target.value })}
                        />
                        <input
                            type="text" placeholder="RUC" className="w-full px-4 py-3 rounded-xl border"
                            value={editingEmpresa?.ruc || ''}
                            onChange={e => setEditingEmpresa({ ...editingEmpresa, ruc: e.target.value })}
                        />
                        <div className="flex gap-4">
                            <button onClick={() => setIsEmpresaModalOpen(false)} className="flex-1 py-3 font-bold border rounded-xl">Cancelar</button>
                            <button onClick={handleSaveEmpresaFull} className="flex-1 py-3 font-bold bg-primary-600 text-white rounded-xl">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {isStaffModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
                        <h2 className="text-xl font-bold">{editingStaff?.id ? 'Editar' : 'Nuevo'} Miembro</h2>
                        <p className="text-xs text-slate-500">Empresa: {empresa?.nombre}</p>
                        <input
                            type="text" placeholder="Nombre" className="w-full px-4 py-3 rounded-xl border"
                            value={editingStaff?.nombre || ''}
                            onChange={e => setEditingStaff({ ...editingStaff, nombre: e.target.value })}
                        />
                        <select
                            className="w-full px-4 py-3 rounded-xl border bg-white"
                            value={editingStaff?.rol || 'mesero'}
                            onChange={e => setEditingStaff({ ...editingStaff, rol: e.target.value as any })}
                        >
                            <option value="mesero">Mesero / Servicio</option>
                            <option value="oficina">Administrador / Oficina</option>
                            <option value="cocina">Personal de Cocina</option>
                        </select>
                        <input
                            type="text" maxLength={4} placeholder="PIN (4 dígitos)" className="w-full px-4 py-3 rounded-xl border font-mono text-center"
                            value={editingStaff?.pin || ''}
                            onChange={e => setEditingStaff({ ...editingStaff, pin: e.target.value.replace(/\D/g, '') })}
                        />
                        <div className="flex gap-4">
                            <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-3 font-bold border rounded-xl">Cancelar</button>
                            <button onClick={handleSaveStaffMember} className="flex-1 py-3 font-bold bg-primary-600 text-white rounded-xl">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
            {isMesaModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 space-y-6">
                        <h2 className="text-xl font-bold">{editingMesa?.id ? 'Editar' : 'Nueva'} Mesa</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Número / Nombre</label>
                                <input
                                    type="text" placeholder="Ej: 01, Barra 1, VIP..." className="w-full px-4 py-3 rounded-xl border mt-1"
                                    value={editingMesa?.numero || ''}
                                    onChange={e => setEditingMesa({ ...editingMesa, numero: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Capacidad (Personas)</label>
                                <div className="flex gap-2 mt-1">
                                    {[2, 4, 6, 8, 10].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setEditingMesa({ ...editingMesa, capacidad: n })}
                                            className={cn(
                                                "w-10 h-10 rounded-lg font-bold border flex items-center justify-center transition-all",
                                                editingMesa?.capacidad === n ? "bg-primary-600 text-white border-primary-600" : "bg-white text-slate-500 hover:border-slate-300"
                                            )}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number" placeholder="Otra..." className="w-full px-4 py-2 rounded-xl border mt-2 text-sm"
                                    value={editingMesa?.capacidad || ''}
                                    onChange={e => setEditingMesa({ ...editingMesa, capacidad: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 pt-2">
                            <button onClick={() => setIsMesaModalOpen(false)} className="flex-1 py-3 font-bold border rounded-xl">Cancelar</button>
                            <button onClick={handleSaveMesa} className="flex-1 py-3 font-bold bg-primary-600 text-white rounded-xl">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
