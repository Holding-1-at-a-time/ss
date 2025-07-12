"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, Scan, CheckCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface VINScannerProps {
  onVINDetected: (vinData: {
    vin: string
    make: string
    model: string
    year: number
    bodyClass?: string
    engineSize?: string
    fuelType?: string
  }) => void
}

export function VINScanner({ onVINDetected }: VINScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedVIN, setScannedVIN] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setIsScanning(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
    } catch (error) {
      console.error("Camera access failed:", error)
      toast({
        title: "Camera Access Failed",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      })
      setIsScanning(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }, [])

  const captureAndScanVIN = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to blob for processing
    canvas.toBlob(
      async (blob) => {
        if (!blob) return

        try {
          // Simulate VIN detection with OCR
          // In a real implementation, you would use:
          // - Tesseract.js for OCR
          // - Google Vision API
          // - AWS Textract
          // - Custom ML model

          const mockVINDetection = await simulateVINDetection(blob)

          if (mockVINDetection.vin) {
            setScannedVIN(mockVINDetection.vin)
            onVINDetected(mockVINDetection)
            stopCamera()

            toast({
              title: "VIN Detected Successfully",
              description: `Found VIN: ${mockVINDetection.vin}`,
            })
          } else {
            toast({
              title: "VIN Not Found",
              description: "Please ensure the VIN is clearly visible and try again.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("VIN detection failed:", error)
          toast({
            title: "Detection Failed",
            description: "Failed to process image. Please try again.",
            variant: "destructive",
          })
        }
      },
      "image/jpeg",
      0.8,
    )
  }, [onVINDetected, stopCamera])

  // Mock VIN detection function
  const simulateVINDetection = async (
    imageBlob: Blob,
  ): Promise<{
    vin: string
    make: string
    model: string
    year: number
    bodyClass?: string
    engineSize?: string
    fuelType?: string
  }> => {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock successful detection (in real implementation, this would use OCR + vPIC API)
    const mockVINs = [
      {
        vin: "1HGBH41JXMN109186",
        make: "Honda",
        model: "Civic",
        year: 2021,
        bodyClass: "Sedan",
        engineSize: "2.0L",
        fuelType: "Gasoline",
      },
      {
        vin: "1FTFW1ET5DFC10312",
        make: "Ford",
        model: "F-150",
        year: 2013,
        bodyClass: "Pickup Truck",
        engineSize: "5.0L",
        fuelType: "Gasoline",
      },
      {
        vin: "5NPE34AF4HH012345",
        make: "Hyundai",
        model: "Sonata",
        year: 2017,
        bodyClass: "Sedan",
        engineSize: "2.4L",
        fuelType: "Gasoline",
      },
    ]

    // Randomly select a mock VIN (70% success rate)
    if (Math.random() > 0.3) {
      return mockVINs[Math.floor(Math.random() * mockVINs.length)]
    } else {
      return { vin: "", make: "", model: "", year: 0 }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" />
          VIN Scanner
        </CardTitle>
        <CardDescription>Scan your vehicle's VIN barcode to automatically fill vehicle information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScanning && !scannedVIN && (
          <Button onClick={startCamera} className="w-full">
            <Camera className="h-4 w-4 mr-2" />
            Start VIN Scanner
          </Button>
        )}

        {isScanning && (
          <div className="space-y-4">
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover rounded-lg border" />
              <canvas ref={canvasRef} className="hidden" />

              {/* VIN scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-primary border-dashed w-64 h-16 rounded-lg flex items-center justify-center">
                  <span className="text-primary font-medium text-sm">Position VIN here</span>
                </div>
              </div>
            </div>

            <Alert>
              <Camera className="h-4 w-4" />
              <AlertDescription>
                Position your camera so the VIN is clearly visible within the frame. The VIN is typically located on the
                dashboard near the windshield or on the driver's side door frame.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={captureAndScanVIN} className="flex-1">
                <Scan className="h-4 w-4 mr-2" />
                Scan VIN
              </Button>
              <Button variant="outline" onClick={stopCamera} className="flex-1 bg-transparent">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {scannedVIN && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>VIN Detected:</strong> {scannedVIN}
              <br />
              Vehicle information has been automatically filled below.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
