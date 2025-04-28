declare module '@zxing/browser' {
  export class BrowserQRCodeReader {
    constructor(options?: any);
    static listVideoInputDevices(): Promise<MediaDeviceInfo[]>;
    decodeFromVideoDevice(
      deviceId: string | undefined,
      videoElement: HTMLVideoElement,
      callbackFn: (result: Result | null, error?: Error) => void
    ): Promise<{ stop: () => Promise<void> }>;
    stopContinuousDecode(): void;
  }
}

declare module '@zxing/library' {
  export interface Result {
    getText(): string;
  }
} 