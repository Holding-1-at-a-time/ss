"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface VINScannerProps {
  isOpen: boolean
  onClose: () => void
  onVinScanned: (vinData: {
    vin: string
    make: string
    model: string
    year: number
    bodyClass?: string
    engineSize?: string
    fuelType?: string
  }) => void
}

interface VINData {
  vin: string
  make: string
  model: string
  year: number
  bodyClass?: string
  engineSize?: string
  fuelType?: string
}

export function VINScanner({ isOpen, onClose, onVinScanned }: VINScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedImage, setScannedImage] = useState<string | null>(null)
  const [extractedVin, setExtractedVin] = useState<string>("")
  const [vinData, setVinData] = useState<VINData | null>(null)
  const [error, setError] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mock OCR function - in production, integrate with actual OCR service
  const extractVinFromImage = async (imageBlob: Blob): Promise<string> => {
    // Simulate OCR processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock VIN extraction - in production, use actual OCR
    const mockVins = ["1HGBH41JXMN109186", "2T3BFREV8DW123456", "WBAVA31070PJ12345", "1FTFW1ET5DFC12345"]

    return mockVins[Math.floor(Math.random() * mockVins.length)]
  }

  // Mock VIN decoding - in production, use vPIC API
  const decodeVin = async (vin: string): Promise<VINData> => {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock decoded data
    const mockVehicleData: Record<string, VINData> = {
      "1HGBH41JXMN109186": {
        vin,
        make: "Honda",
        model: "Accord",
        year: 2021,
        bodyClass: "Sedan",
        engineSize: "2.0L",
        fuelType: "Gasoline",
      },
      "2T3BFREV8DW123456": {
        vin,
        make: "Toyota",
        model: "RAV4",
        year: 2020,
        bodyClass: "SUV",
        engineSize: "2.5L",
        fuelType: "Gasoline",
      },
      default: {
        vin,
        make: "Generic",
        model: "Vehicle",
        year: 2020,
        bodyClass: "Sedan",
        engineSize: "2.0L",
        fuelType: "Gasoline",
      },
    }

    return mockVehicleData[vin] || mockVehicleData["default"]
  }

  const handleImageUpload = async (file: File) => {
    setIsScanning(true)
    setError("")

    try {
      // Create preview
      const imageUrl = URL.createObjectURL(file)
      setScannedImage(imageUrl)

      // Extract VIN using OCR
      const extractedVin = await extractVinFromImage(file)
      setExtractedVin(extractedVin)

      // Decode VIN to get vehicle data
      const vehicleData = await decodeVin(extractedVin)
      setVinData(vehicleData)

      toast({
        title: "VIN scanned successfully",
        description: `Found: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
      })
    } catch (error) {
      setError("Failed to scan VIN. Please try again or enter manually.")
      toast({
        title: "Scan failed",
        description: "Could not extract VIN from image",
        variant: "destructive",
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const startCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to scan VIN",
        variant: "destructive",
      })
    }
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              handleImageUpload(new File([blob], "vin-capture.jpg", { type: "image/jpeg" }))
            }
          },
          "image/jpeg",
          0.8,
        )

        // Stop camera
        const stream = video.srcObject as MediaStream
        stream?.getTracks().forEach((track) => track.stop())
      }
    }
  }

  const handleConfirm = () => {
    if (vinData) {
      onVinScanned(vinData)
      handleClose()
    }
  }

  const handleClose = () => {
    // Clean up
    if (scannedImage) {
      URL.revokeObjectURL(scannedImage)
    }

    // Stop camera if active
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }

    // Reset state
    setScannedImage(null)
    setExtractedVin("")
    setVinData(null)
    setError("")
    setIsScanning(false)

    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            VIN Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Camera/Upload Options */}
          {!scannedImage && !isScanning && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <Camera className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Use Camera</h3>
                  <p className="text-sm text-muted-foreground mb-4">Capture VIN directly with your camera</p>
                  <Button onClick={startCameraCapture} className="w-full">
                    Open Camera
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Upload Image</h3>
                  <p className="text-sm text-muted-foreground mb-4">Upload a photo of the VIN</p>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                    Choose File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Camera View */}
          {videoRef.current?.srcObject && !scannedImage && (
            <div className="space-y-4">
              <div className="relative">
                <video ref={videoRef} className="w-full rounded-lg" playsInline />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-white border-dashed rounded-lg p-4 bg-black/20">
                    <p className="text-white text-sm">Position VIN in this area</p>
                  </div>
                </div>
              </div>
              <Button onClick={captureImage} className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Capture VIN
              </Button>
            </div>
          )}

          {/* Processing State */}
          {isScanning && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground">Scanning and decoding VIN...</p>
            </div>
          )}

          {/* Scanned Image */}
          {scannedImage && !isScanning && (
            <div className="space-y-4">
              <img
                src={scannedImage || "/placeholder.svg"}
                alt="Scanned VIN"
                className="w-full max-h-64 object-contain rounded-lg border"
              />

              {extractedVin && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Extracted VIN:</p>
                  <p className="font-mono text-lg">{extractedVin}</p>
                </div>
              )}
            </div>
          )}

          {/* Vehicle Data */}
          {vinData && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h3 className="font-medium">Vehicle Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Make</p>
                    <p className="font-medium">{vinData.make}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Model</p>
                    <p className="font-medium">{vinData.model}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Year</p>
                    <p className="font-medium">{vinData.year}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Body Class</p>
                    <p className="font-medium">{vinData.bodyClass || "N/A"}</p>
                  </div>
                  {vinData.engineSize && (
                    <div>
                      <p className="text-muted-foreground">Engine</p>
                      <p className="font-medium">{vinData.engineSize}</p>
                    </div>
                  )}
                  {vinData.fuelType && (
                    <div>
                      <p className="text-muted-foreground">Fuel Type</p>
                      <p className="font-medium">{vinData.fuelType}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            {vinData && (
              <Button onClick={handleConfirm} className="flex-1">
                Use This Vehicle
              </Button>
            )}
          </div>
        </div>

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}
