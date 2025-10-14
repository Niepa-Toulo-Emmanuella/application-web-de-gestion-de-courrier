import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignupForm from './SignupForm';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import ProtectedRoute from './ProtectedRoute';
import ForgotPassword from './ForgotPassword';
import UpdatePassword from './UpdatePassword';

function App() {
  return (
    <Router>
      <Routes>
        {/* Page d'inscription */}
        <Route path="/signup" element={<SignupForm />} />
        
        {/* Page de connexion */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Dashboard protégé */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        
        {/* Mot de passe oublié */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Mise à jour du mot de passe */}
        <Route path="/update-password" element={<UpdatePassword />} />
        
        {/* Redirection par défaut */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
