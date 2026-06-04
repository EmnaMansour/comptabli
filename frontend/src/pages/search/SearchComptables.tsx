import { Navigate } from 'react-router-dom';

/** Redirige vers la page publique Networking (même contenu, en-tête avec inscription / connexion). */
export default function SearchComptables() {
  return <Navigate to="/" replace />;
}
