import { Compass } from 'lucide-react';
import { LoginButtons } from './LoginButtons';
import { EmailAuthForm } from './EmailAuthForm';
import styles from './GlobalAuthModal.module.css';

export function GlobalAuthModal() {
  

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', right: '100%', paddingRight: '12px', display: 'flex', alignItems: 'center' }}>
              <Compass size={36} color="var(--brand)" strokeWidth={1.5} />
            </div>
            <h1 className={styles.title} style={{ fontFamily: '"Newsreader", serif', color: 'var(--brand)', margin: 0, fontSize: '40px', lineHeight: 1 }}>Triptic</h1>
          </div>
          <p className={styles.subtitle} style={{ fontFamily: '"Newsreader", serif', color: 'var(--brand)', fontSize: '18px', marginTop: '16px', fontWeight: 500, margin: '16px 0 0 0' }}>Sign in to continue</p>
        </div>
        
        <EmailAuthForm />
        
        <div className={styles.divider}>or</div>
        
        <LoginButtons />
      </div>
    </div>
  );
}
