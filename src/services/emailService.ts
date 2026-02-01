export const emailService = {
    async enviarComprobante(email: string, comprobante: any) {
        // En una implementación real usaríamos Resend, SendGrid o un Edge Function de Supabase
        console.log(`[EMAIL MOCK] Enviando comprobante ${comprobante.secuencial} a ${email}`);

        // Simulamos un delay de red
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log(`[EMAIL MOCK] Correo enviado exitosamente a ${email}`);
        return true;
    }
}
