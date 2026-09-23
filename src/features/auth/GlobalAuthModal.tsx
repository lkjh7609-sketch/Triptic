import { LoginButtons } from './LoginButtons';
import { EmailAuthForm } from './EmailAuthForm';
import styles from './GlobalAuthModal.module.css';

export function GlobalAuthModal() {
  

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h1 className={styles.title}>Triptic</h1>
          <p className={styles.subtitle}>Sign in to continue</p>
        </div>
        
        <EmailAuthForm />
        
        <div className={styles.divider}>or</div>
        
        <LoginButtons />
      </div>
    </div>
  );
}
