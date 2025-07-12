"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, Scan, Upload, CheckCircle, AlertTriangle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface VINData {
  vin: string
  make: string
  model: string
  year: number
  bodyClass?: string
  engineSize?: string
  fuelType?: string
}

interface VINScannerProps {
  onVINScanned: (vinData: VINData) => void
}

export function VINScanner({ onVINScanned }: VINScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [manualVIN, setManualVIN] = useState("")
  const [isDecoding, setIsDecoding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startCamera = async () => {
    try {
      setIsScanning(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (error) {
      console.error("Camera access failed:", error)
      toast({
        title: "Camera Access Failed",
        description: "Please allow camera access or use manual VIN entry",
        variant: "destructive",
      })
      setIsScanning(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  const captureVIN = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)

    // Convert canvas to blob and process with OCR
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          await processVINImage(blob)
        }
      },
      "image/jpeg",
      0.8,
    )
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await processVINImage(file)
    }
  }

  const processVINImage = async (imageBlob: Blob) => {
    setIsDecoding(true)

    try {
      // Simulate OCR processing - in real implementation, use Tesseract.js or cloud OCR
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock VIN extraction
      const mockVIN = "1HGBH41JXMN109186"
      await decodeVIN(mockVIN)
    } catch (error) {
      console.error("VIN extraction failed:", error)
      toast({
        title: "VIN Extraction Failed",
        description: "Could not read VIN from image. Please try again or enter manually.",
        variant: "destructive",
      })
    } finally {
      setIsDecoding(false)
      stopCamera()
    }
  }

  const decodeVIN = async (vin: string) => {
    if (!vin || vin.length !== 17) {
      toast({
        title: "Invalid VIN",
        description: "VIN must be exactly 17 characters long",
        variant: "destructive",
      })
      return
    }

    setIsDecoding(true)

    try {
      // Call NHTSA vPIC API for VIN decoding
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`)

      if (!response.ok) {
        throw new Error("VIN decoding service unavailable")
      }

      const data = await response.json()
      const results = data.Results

      // Extract relevant information
      const vinData: VINData = {
        vin: vin.toUpperCase(),
        make: getVINValue(results, "Make") || "",
        model: getVINValue(results, "Model") || "",
        year: Number.parseInt(getVINValue(results, "Model Year") || "0"),
        bodyClass: getVINValue(results, "Body Class"),
        engineSize: getVINValue(results, "Engine Number of Cylinders"),
        fuelType: getVINValue(results, "Fuel Type - Primary"),
      }

      if (!vinData.make || !vinData.model || !vinData.year) {
        throw new Error("Could not decode VIN - invalid or incomplete data")
      }

      onVINScanned(vinData)

      toast({
        title: "VIN Decoded Successfully",
        description: `Found: ${vinData.year} ${vinData.make} ${vinData.model}`,
      })
    } catch (error) {
      console.error("VIN decoding failed:", error)
      toast({
        title: "VIN Decoding Failed",
        description: error instanceof Error ? error.message : "Please check the VIN and try again",
        variant: "destructive",
      })
    } finally {
      setIsDecoding(false)
    }
  }

  const getVINValue = (results: any[], variableName: string): string | null => {
    const result = results.find((r) => r.Variable === variableName)
    return result?.Value || null
  }

  const handleManualSubmit = () => {
    if (manualVIN.length === 17) {
      decodeVIN(manualVIN)
    }
  }

  return (
    <div className="space-y-6">
      {/* Camera Scanner */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <h4 className="text-lg font-semibold">Scan VIN with Camera</h4>

            {!isScanning ? (
              <div className="space-y-4">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-12 h-12 text-blue-500" />
                </div>
                <p className="text-gray-600">Point your camera at the VIN barcode or number</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={startCamera} disabled={isDecoding}>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isDecoding}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video ref={videoRef} className="w-full max-w-md mx-auto rounded-lg" autoPlay playsInline muted />
                  <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-16 border-2 border-white rounded">
                      <div className="absolute -top-2 -left-2 w-4 h-4 border-l-2 border-t-2 border-white"></div>
                      <div className="absolute -top-2 -right-2 w-4 h-4 border-r-2 border-t-2 border-white"></div>
                      <div className="absolute -bottom-2 -left-2 w-4 h-4 border-l-2 border-b-2 border-white"></div>
                      <div className="absolute -bottom-2 -right-2 w-4 h-4 border-r-2 border-b-2 border-white"></div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">Align the VIN within the frame and capture</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={captureVIN} disabled={isDecoding}>
                    <Scan className="w-4 h-4 mr-2" />
                    {isDecoding ? "Processing..." : "Capture VIN"}
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual VIN Entry */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-center">Enter VIN Manually</h4>
            <div>
              <Label htmlFor="manual-vin">Vehicle Identification Number (VIN)</Label>
              <Input
                id="manual-vin"
                value={manualVIN}
                onChange={(e) => setManualVIN(e.target.value.toUpperCase())}
                placeholder="Enter 17-character VIN"
                maxLength={17}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                VIN is typically found on the dashboard, driver's side door, or registration
              </p>
            </div>
            <Button onClick={handleManualSubmit} disabled={manualVIN.length !== 17 || isDecoding} className="w-full">
              {isDecoding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Decoding VIN...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Decode VIN
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* VIN Format Help */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>VIN Location Tips:</strong> Look for the 17-character VIN on your dashboard (visible through
          windshield), driver's side door jamb, or vehicle registration documents.
        </AlertDescription>
      </Alert>
    </div>
  )
}
