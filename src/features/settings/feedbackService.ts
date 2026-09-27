/**
 * 건의하기 — 설정 화면의 예전 "문의하기"(mailto) 대체. 스크린샷은
 * post-images(community/imageProcessing.ts)와 같은 리사이즈+EXIF 제거
 * 처리를 거쳐 비공개 버킷(feedback-screenshots, 0042)에 올라간다.
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { processImageForUpload } from '@/features/community/imageProcessing';

async function uploadFeedbackScreenshot(file: File, userId: string): Promise<string> {
  const { blob } = await processImageForUpload(file);
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from('feedback-screenshots').upload(path, blob, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function submitFeedback(userId: string, body: string, screenshot: File | null): Promise<void> {
  const screenshotPath = screenshot ? await uploadFeedbackScreenshot(screenshot, userId) : null;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('user_feedback').insert({ user_id: userId, body, screenshot_path: screenshotPath });
  if (error) throw error;
}
