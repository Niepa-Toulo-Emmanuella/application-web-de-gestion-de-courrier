// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
// import LoginPage from './LoginPage'
// import Dashboard from './Dashboard'
// import ForgotPassword from './ForgotPassword'
// import UpdatePassword from './UpdatePassword'
// import ProtectedRoute from './ProtectedRoute'

// export default function Layout() {
//   return (
//     <Router>
//       <Routes>
//         {/* Page de connexion */}
//         <Route path="/login" element={<LoginPage />} />

//         {/* Mot de passe oublié */}
//         <Route path="/forgot-password" element={<ForgotPassword />} />

//         {/* Réinitialisation du mot de passe (lien envoyé par email) */}
//         <Route path="/update-password" element={<UpdatePassword />} />

//         {/* Dashboard protégé */}
//         <Route
//           path="/dashboard"
//           element={
//             <ProtectedRoute>
//               <Dashboard />
//             </ProtectedRoute>
//           }
//         />

//         {/* Redirection par défaut (si tu veux) */}
//         <Route path="*" element={<LoginPage />} />
//       </Routes>
//     </Router>
//   )
// }
