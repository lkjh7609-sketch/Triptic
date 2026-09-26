import { useState } from 'react';
import modalStyles from '../plan/AddPlaceModal.module.css';

export function EditProfileModal({ onClose, profile, updateProfile }: any) {
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(!!profile?.phone);

  const handleSendCode = () => {
    if (!phone) return alert('휴대폰 번호를 입력해주세요.');
    setIsVerifying(true);
    alert('인증번호(1234)가 발송되었습니다.');
  };

  const handleVerifyCode = () => {
    if (code === '1234') {
      setVerified(true);
      alert('인증이 완료되었습니다.');
    } else {
      alert('인증번호가 틀렸습니다.');
    }
  };

  const handleSave = () => {
    if (!verified && phone) {
      alert('휴대폰 번호 인증을 완료해주세요.');
      return;
    }
    updateProfile.mutate({ nickname, phone: phone || null });
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={e => e.stopPropagation()}>
        <h2>내 정보 변경</h2>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>닉네임</label>
          <input className={modalStyles.input} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="닉네임 입력" />
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>휴대전화번호</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              className={modalStyles.input} 
              style={{ flex: 1 }} 
              value={phone} 
              onChange={e => { setPhone(e.target.value); setVerified(false); }} 
              placeholder="010-0000-0000" 
            />
            <button type="button" onClick={handleSendCode} style={{ padding: '0 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 8 }}>
              {verified ? '재인증' : '인증 요청'}
            </button>
          </div>
        </div>
        
        {isVerifying && !verified && (
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>인증번호</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className={modalStyles.input} style={{ flex: 1 }} value={code} onChange={e => setCode(e.target.value)} placeholder="인증번호 4자리" />
              <button type="button" onClick={handleVerifyCode} style={{ padding: '0 12px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 8 }}>
                확인
              </button>
            </div>
          </div>
        )}

        <div className={modalStyles.actions} style={{ marginTop: 16 }}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>취소</button>
          <button type="button" className={modalStyles.primary} onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
