import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Vérification de l'utilisateur connecté
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsAuthenticated(true) // Si l'utilisateur est connecté
      else navigate('/login') // Redirection vers la page de connexion si l'utilisateur n'est pas connecté
      setLoading(false)
    })
  }, [])

  if (loading) return <p>Chargement...</p>
  return isAuthenticated ? children : null // Affiche les enfants (ex. le Dashboard) si connecté
}
