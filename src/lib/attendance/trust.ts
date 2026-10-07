export const RECOGNITION_VISITS = 3;

export function isDeviceRecognized(entryCount: number, exitCount: number): boolean {
  // Giriş: ENTRY ve RETURN. Çıkış: EXIT ve END_OF_DAY. Sayaçlar çağıran tarafta böyle toplanır.
  return entryCount >= RECOGNITION_VISITS && exitCount >= RECOGNITION_VISITS;
}
