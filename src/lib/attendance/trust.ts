export const RECOGNITION_VISITS = 3;

export function isDeviceRecognized(recordCount: number): boolean {
  return recordCount > RECOGNITION_VISITS;
}
