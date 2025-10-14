import { useState } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleUpdate = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) setMessage(`Erreur : ${error.message}`)
    else {
      setMessage('Mot de passe mis à jour.')
      setTimeout(() => navigate('/login'), 2000)
    }
  }

  return (
    <form onSubmit={handleUpdate}>
      <h2>Définir un nouveau mot de passe</h2>
      <input
        type="password"
        placeholder="Nouveau mot de passe"
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit">Mettre à jour</button>
      <p>{message}</p>
    </form>
  )
}
