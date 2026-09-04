/**
 * Náhrada za `virtual:pwa-register/react` v buildu pro APK. Uvnitř aplikace
 * žádný service worker není — aktualizace přicházejí novou verzí APK — takže
 * lišta „je nová verze" se nikdy neukáže a nic se neregistruje.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
