export {};

declare global {
  interface AndroidNativeScannerInterface {
    scan: () => void;
    stop: () => void;
    setContinuous?: (enabled: boolean) => void;
  }

  interface Window {
    AndroidNativeScanner?: AndroidNativeScannerInterface;
    onScanResult?: ((awb: string) => void) | undefined;
  }
}
