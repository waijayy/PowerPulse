import { Zap } from "lucide-react"

interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-bounce-x">
          <Zap className="h-10 w-10 text-primary fill-current" />
        </div>
        <p className="text-lg font-medium animate-pulse">{message}</p>
      </div>
    </div>
  )
}
