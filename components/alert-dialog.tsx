import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AlertDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: "error" | "warning" | "info"
}

export function AlertDialog({ isOpen, onClose, title, message, type = "error" }: AlertDialogProps) {
  if (!isOpen) return null

  const bgColor = type === "error" ? "bg-red-50 dark:bg-red-950/20" : 
                  type === "warning" ? "bg-yellow-50 dark:bg-yellow-950/20" : 
                  "bg-blue-50 dark:bg-blue-950/20"
  
  const borderColor = type === "error" ? "border-red-200 dark:border-red-800" : 
                      type === "warning" ? "border-yellow-200 dark:border-yellow-800" : 
                      "border-blue-200 dark:border-blue-800"
  
  const iconColor = type === "error" ? "text-red-600 dark:text-red-400" : 
                    type === "warning" ? "text-yellow-600 dark:text-yellow-400" : 
                    "text-blue-600 dark:text-blue-400"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <Card className={`max-w-md w-full ${bgColor} ${borderColor} border-2 shadow-2xl animate-in zoom-in-95`}>
        <CardHeader className="relative pb-3">
          <div className="flex items-start gap-3">
            <AlertCircle className={`h-6 w-6 mt-0.5 ${iconColor}`} />
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-base whitespace-pre-line text-foreground/80">
            {message}
          </CardDescription>
          <Button onClick={onClose} className="w-full">
            OK
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
