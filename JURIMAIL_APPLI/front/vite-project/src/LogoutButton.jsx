import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function LogoutButton() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()     // 🔒 Supprimer la session
    navigate('/login')                // 🔁 Redirection vers la page de connexion
  }

  return <button onClick={handleLogout}>Se déconnecter</button>
}
