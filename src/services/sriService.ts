import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export interface Comprobante {
    id: string
    secuencial: string
    cliente_nombre: string
    fecha: string
    total: number
    estado_sri: 'PENDIENTE' | 'ENVIADO' | 'AUTORIZADO' | 'RECHAZADO'
    clave_acceso: string | null
    pedido_id?: string
    tipo_comprobante: string
    pedido_info?: {
        mesa_numero?: string
    }
}

export const sriService = {
    async getComprobantes(empresaId: string, fecha?: string) {
        let query = supabase
            .from('comprobantes')
            .select(`
                *,
                clientes(nombre),
                pedidos(id, mesas(numero))
            `)
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false })

        if (fecha) {
            // fecha comes as YYYY-MM-DD from the input[type=date]
            const [year, month, day] = fecha.split('-').map(Number)
            // Create dates in local time
            const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0)
            const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)

            query = query
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString())
        }

        const { data, error } = await query

        if (error) throw error

        return data.map((item: any) => ({
            ...item,
            cliente_nombre: item.clientes?.nombre || 'Consumidor Final',
            fecha: item.created_at,
            pedido_info: {
                mesa_numero: item.pedidos?.mesas?.numero
            }
        })) as Comprobante[]
    },

    async emitirFactura(pedidoId: string, clienteId: string) {
        // In a real scenario, this would call a Supabase Edge Function 
        // to generate XML, sign it, and send to SRI.
        // For this prototype, we simulate the state update.

        const { data, error } = await supabase
            .from('comprobantes')
            .insert({
                pedido_id: pedidoId,
                cliente_id: clienteId,
                estado_sri: 'PENDIENTE',
                tipo_comprobante: 'FACTURA',
                total: 100 // Mock total
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async getSriParams() {
        const { data, error } = await supabase
            .from('empresas')
            .select('config_sri')
            .single()

        if (error) throw error
        return data.config_sri
    },

    async uploadFirma(empresaId: string, file: File) {
        const fileName = `${empresaId}_${Date.now()}.p12`
        const { data, error } = await supabase.storage
            .from('firmas_electronicas')
            .upload(fileName, file, { upsert: true })

        if (error) throw error
        return data.path
    },

    async uploadLogo(empresaId: string, file: File) {
        const fileName = `${empresaId}_logo_${Date.now()}.${file.name.split('.').pop()}`
        const { data, error } = await supabase.storage
            .from('logos')
            .upload(fileName, file, { upsert: true })

        if (error) throw error

        // Obtener la URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(data.path)

        return publicUrl
    },

    async consultarEstadoComprobante(id: string) {
        // Simulación de consulta al SRI
        const states = ['AUTORIZADO', 'RECHAZADO', 'ENVIADO']
        const newState = states[Math.floor(Math.random() * states.length)]

        const { error } = await supabase
            .from('comprobantes')
            .update({
                estado_sri: newState,
                fecha_autorizacion: newState === 'AUTORIZADO' ? new Date().toISOString() : null
            })
            .eq('id', id)

        if (error) throw error
        return newState
    },

    async descargarXml(comprobanteId: string, secuencial: string) {
        // 1. Obtener detalles y pagos reales de la base de datos
        const [{ data: detalles }, { data: pagos }, { data: factura }] = await Promise.all([
            supabase.from('comprobante_detalles').select('*').eq('comprobante_id', comprobanteId),
            supabase.from('comprobante_pagos').select('*').eq('comprobante_id', comprobanteId),
            supabase.from('comprobantes').select('*, clientes(*)').eq('id', comprobanteId).single()
        ])

        const secuencial9 = secuencial.split('-').pop() || '000000001'
        const fechaEmision = format(new Date(factura?.created_at || new Date()), 'dd/MM/yyyy')

        // Bloque Detalles XML
        const detallesXml = (detalles || []).map(d => `
        <detalle>
            <codigoPrincipal>${d.producto_id?.slice(0, 8) || '001'}</codigoPrincipal>
            <descripcion>${d.nombre_producto}</descripcion>
            <cantidad>${d.cantidad}.00</cantidad>
            <precioUnitario>${d.precio_unitario}</precioUnitario>
            <descuento>0.00</descuento>
            <precioTotalSinImpuesto>${d.subtotal}</precioTotalSinImpuesto>
            <impuestos>
                <impuesto>
                    <codigo>2</codigo>
                    <codigoPorcentaje>${d.iva_porcentaje === 15 ? '4' : '0'}</codigoPorcentaje>
                    <tarifa>${d.iva_porcentaje}</tarifa>
                    <baseImponible>${d.subtotal}</baseImponible>
                    <valor>${d.iva_valor}</valor>
                </impuesto>
            </impuestos>
        </detalle>`).join('')

        // Bloque Pagos XML
        const pagosXml = (pagos || []).map(p => {
            const codigoSri = p.metodo_pago === 'efectivo' ? '01' : '20'
            return `
        <pago>
            <formaPago>${codigoSri}</formaPago>
            <total>${p.valor}</total>
            <plazo>0</plazo>
            <unidadTiempo>dias</unidadTiempo>
        </pago>`
        }).join('')

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
    <infoTributaria>
        <ambiente>${factura?.ambiente === 'PRODUCCION' ? '2' : '1'}</ambiente>
        <tipoEmision>1</tipoEmision>
        <razonSocial>RESTOFLOW SAAS</razonSocial>
        <ruc>1790000000001</ruc>
        <claveAcceso>${factura?.clave_acceso}</claveAcceso>
        <codDoc>01</codDoc>
        <estab>${secuencial.split('-')[0]}</estab>
        <ptoEmi>${secuencial.split('-')[1]}</ptoEmi>
        <secuencial>${secuencial9}</secuencial>
        <dirMatriz>QUITO, ECUADOR</dirMatriz>
    </infoTributaria>
    <infoFactura>
        <fechaEmisión>${fechaEmision}</fechaEmisión>
        <dirEstablecimiento>LOCAL PRINCIPAL</dirEstablecimiento>
        <obligadoContabilidad>NO</obligadoContabilidad>
        <tipoIdentificacionComprador>${factura?.clientes?.identificacion?.length === 13 ? '04' : factura?.clientes?.identificacion === '9999999999999' ? '07' : '05'}</tipoIdentificacionComprador>
        <razonSocialComprador>${factura?.clientes?.nombre || 'CONSUMIDOR FINAL'}</razonSocialComprador>
        <identificacionComprador>${factura?.clientes?.identificacion || '9999999999999'}</identificacionComprador>
        <totalSinImpuestos>${factura?.total - (factura?.total * 0.15 / 1.15)}</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <totalConImpuestos>
            <totalImpuesto>
                <codigo>2</codigo>
                <codigoPorcentaje>4</codigoPorcentaje>
                <baseImponible>${factura?.total / 1.15}</baseImponible>
                <valor>${factura?.total - (factura?.total / 1.15)}</valor>
            </totalImpuesto>
        </totalConImpuestos>
        <propina>0.00</propina>
        <importeTotal>${factura?.total}</importeTotal>
        <moneda>DOLAR</moneda>
        <pagos>
            ${pagosXml}
        </pagos>
    </infoFactura>
    <detalles>
        ${detallesXml}
    </detalles>
</factura>`

        const blob = new Blob([xmlContent], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `factura_${secuencial}.xml`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    },

    generarClaveAcceso(fecha: Date, ruc: string, ambiente: string, establecimiento: string, ptoEmision: string, secuencial: string): string {
        const f = format(fecha, 'ddMMyyyy')
        const tipo = '01' // Factura
        const ruc13 = ruc.padStart(13, '0')
        const amb = ambiente === 'PRODUCCION' ? '2' : '1'
        const sec9 = secuencial.split('-').pop() || '000000001'
        const codigoNum = Math.floor(10000000 + Math.random() * 90000000).toString()
        const emision = '1' // Normal

        const clavePrevia = `${f}${tipo}${ruc13}${amb}${establecimiento}${ptoEmision}${sec9}${codigoNum}${emision}`

        // Módulo 11 (Simplificado para el prototipo)
        let suma = 0
        let factor = 2
        for (let i = clavePrevia.length - 1; i >= 0; i--) {
            suma += parseInt(clavePrevia[i]) * factor
            factor = factor === 7 ? 2 : factor + 1
        }
        const digito = 11 - (suma % 11)
        const dv = digito === 11 ? '0' : digito === 10 ? '1' : digito.toString()

        return clavePrevia + dv
    }
}
