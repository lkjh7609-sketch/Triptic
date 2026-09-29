import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { openLoginPrompt } from './loginPrompt';

/** 비로그인에서 잠긴 기능을 눌렀을 때 "로그인하시겠어요?"를 묻고, 예면 로그인 창을 연다 */
export function LoginRequiredDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  return (
    <ConfirmDialog
      title={t('guest.loginRequiredTitle')}
      message={t('guest.loginRequiredMessage')}
      cancelLabel={t('guest.loginLater')}
      confirmLabel={t('auth.signIn')}
      onConfirm={openLoginPrompt}
      onClose={onClose}
    />
  );
}
