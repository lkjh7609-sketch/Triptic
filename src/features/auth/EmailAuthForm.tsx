import { useState } from 'react';
import { signInWithEmail, signUpWithEmail } from '@/shared/api/authService';
import styles from './EmailAuthForm.module.css';

export function EmailAuthForm() {
  
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === 'signup' && !name) return;

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
        setMessage('Check your email to confirm your account.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {mode === 'signup' && (
        <div className={styles.inputGroup}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
      )}
      <div className={styles.inputGroup}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
      </div>
      
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.primaryButton} disabled={loading}>
          {loading ? '...' : (mode === 'login' ? 'Log In' : 'Sign Up')}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setMessage(null);
          }}
          disabled={loading}
        >
          {mode === 'login' ? 'Create an account' : 'Already have an account? Log In'}
        </button>
      </div>
    </form>
  );
}
