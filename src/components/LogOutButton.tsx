import { useNavigate } from 'react-router-dom';
import { signOut } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { flushPendingDeletes } from '../tasks/pendingFlush';

/** Ends the session after any held deletion has been sent; whatever the server answers, the client signs out and shows the sign-in page (AC-5, AC-10). */
export function LogOutButton() {
  const { clear } = useAuth();
  const navigate = useNavigate();
  const logOut = async () => {
    // A deletion still inside its undo window is made final first, so logging out never loses it.
    await flushPendingDeletes();
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
