import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import LogoutButton from './LogoutButton'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')  // Si l'utilisateur n'est pas connecté, redirige vers la page de connexion
      } else {
        setUser(user)
      }
    }
    
    fetchUser()
  }, [navigate])

  return (
    <div>
      <h1>Bienvenue sur le Dashboard</h1>
      {user && <p>Bienvenue, {user.email}</p>}  {/* Affichage de l'email de l'utilisateur */}
      <LogoutButton /> {/* Composant de déconnexion */}
    </div>
  )
}
