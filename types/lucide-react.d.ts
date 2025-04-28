declare module 'lucide-react' {
  import { FC } from 'react'
  
  interface IconProps {
    size?: number | string
    color?: string
    strokeWidth?: number
    className?: string
  }
  
  export const X: FC<IconProps>
  export const Camera: FC<IconProps>
} 