import { useNavigate } from 'react-router-dom';
import { signOut } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';

/** Ends the session; whatever the server answers, the client signs out and shows the sign-in page (AC-5, AC-10). */
export function LogOutButton() {
  const { clear } = useAuth();
  const navigate = useNavigate();
  const logOut = async () => {
    try {
      await signOut();
    } catch {
      // A refusal or network failure still signs the user out locally, with no error shown.
    }
    clear();
    navigate('/signin', { replace: true });
  };
  return (
    <button type="button" onClick={() => void logOut()}>
      {copy.logOut}
    </button>
  );
}
