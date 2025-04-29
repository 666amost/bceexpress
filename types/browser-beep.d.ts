declare module 'browser-beep' {
  interface BeepOptions {
    frequency?: number
    interval?: number
    context?: AudioContext
  }

  function browserBeep(options?: BeepOptions): (times?: number) => void
  export default browserBeep
} 