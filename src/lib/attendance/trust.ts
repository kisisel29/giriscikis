export const RECOGNITION_VISITS = 3;

export function isDeviceRecognized(entryCount: number, exitCount: number): boolean {
  return entryCount > RECOGNITION_VISITS || exitCount > RECOGNITION_VISITS;
}
