import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // Optional allowed roles; if provided, user.role in JWT must be one of these
  roles?: string[];
}

// Safely parse a JWT and return its payload or null
function parseJwt(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    // handle base64url
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const token = localStorage.getItem('token') || ''

  // If no token exists, redirect to login
  if (!token) {
    return <Navigate to="/" replace />
  }

  // Basic client-side expiry/role checks (backend is the source of truth)
  const payload = parseJwt(token)
  if (!payload) {
    localStorage.removeItem('token')
    return <Navigate to="/" replace />
  }

  // Token expiration (exp is seconds since epoch)
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('token')
    return <Navigate to="/" replace />
  }

  // Optional role gating if roles prop is provided
  if (Array.isArray(roles) && roles.length > 0) {
    const userRole = payload.role
    if (!roles.includes(userRole)) {
      // Not authorized for this route; send to home/login
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute;