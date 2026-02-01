import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
    allowedRoles: string[]
    children: React.ReactNode
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
    const { profile } = useAuth()

    if (!profile) {
        return <Navigate to="/login" replace />
    }

    if (!allowedRoles.includes(profile.rol)) {
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}
