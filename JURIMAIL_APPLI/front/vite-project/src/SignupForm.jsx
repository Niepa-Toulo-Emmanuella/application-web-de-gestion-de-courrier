import { useState } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    })

    if (signUpError) {
      if (signUpError.message === 'User already registered') {
        setMessage("Cet email est déjà utilisé. Veuillez vous connecter.")
      } else {
        setMessage(`Erreur d'inscription : ${signUpError.message}`)
      }
      return
    }

    const user = data.user
    const access_token = data.session?.access_token

    if (!user || !access_token) {
      setMessage('Erreur : impossible de créer le compte.')
      return
    }

    const { error: dbError } = await supabase
      .from('utilisateurs')
      .insert([{
        id: user.id,
        nom: nom,
        email: email,
        roles_id: 2,
      }])

    if (dbError) {
      setMessage(`Erreur DB : ${dbError.message}`)
    } else {
      navigate('/login')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Créer un compte</h2>

      <input
        type="text"
        placeholder="Nom"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">S’inscrire</button>

      {/* Affiche le message d’erreur ou d’information */}
      <p style={{ color: 'red' }}>{message}</p>

      {/* Lien vers la connexion */}
      <p>Déjà inscrit ? <a href="/login">Connectez-vous ici</a></p>
    </form>
  )
}
