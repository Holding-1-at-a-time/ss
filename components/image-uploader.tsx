"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Camera, X, CheckCircle, AlertTriangle, FileImage, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ImageUploaderProps {
  onImagesUploaded: (imageIds: string[]) => void
  minImages?: number
  maxImages?: number
  vehicleInfo: any
}

interface UploadedImage {
  id: string
  file: File
  preview: string
  status: "uploading" | "uploaded" | "error"
  progress: number
}

export function ImageUploader({ onImagesUploaded, minImages = 4, maxImages = 12, vehicleInfo }: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const saveImageMetadata = useMutation(api.files.saveImageMetadata)

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files)
      const imageFiles = fileArray.filter((file) => file.type.startsWith("image/"))

      if (images.length + imageFiles.length > maxImages) {
        toast({
          title: "Too Many Images",
          description: `Maximum ${maxImages} images allowed. You can upload ${maxImages - images.length} more.`,
          variant: "destructive",
        })
        return
      }

      const newImages: UploadedImage[] = imageFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        status: "uploading",
        progress: 0,
      }))

      setImages((prev) => [...prev, ...newImages])

      // Upload each image
      for (const image of newImages) {
        await uploadImage(image)
      }
    },
    [images.length, maxImages],
  )

  const uploadImage = async (image: UploadedImage) => {
    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl()

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, progress } : img)))
        }
      })

      xhr.addEventListener("load", async () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText)

          // Save image metadata
          await saveImageMetadata({
            storageId: result.storageId,
            filename: image.file.name,
            contentType: image.file.type,
            size: image.file.size,
            vehicleInfo,
            uploadedAt: Date.now(),
          })

          setImages((prev) =>
            prev.map((img) =>
              img.id === image.id ? { ...img, status: "uploaded", progress: 100, id: result.storageId } : img,
            ),
          )

          // Check if we have enough images to proceed
          const updatedImages = images.map((img) => (img.id === image.id ? { ...img, id: result.storageId } : img))

          if (updatedImages.filter((img) => img.status === "uploaded").length >= minImages) {
            const uploadedIds = updatedImages.filter((img) => img.status === "uploaded").map((img) => img.id)
            onImagesUploaded(uploadedIds)
          }
        } else {
          throw new Error("Upload failed")
        }
      })

      xhr.addEventListener("error", () => {
        setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, status: "error" } : img)))
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${image.file.name}`,
          variant: "destructive",
        })
      })

      xhr.open("POST", uploadUrl)

      const formData = new FormData()
      formData.append("file", image.file)
      xhr.send(formData)
    } catch (error) {
      console.error("Upload error:", error)
      setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, status: "error" } : img)))
    }
  }

  const removeImage = (imageId: string) => {
    setImages((prev) => {
      const updated = prev.filter((img) => img.id !== imageId)

      // Clean up preview URL
      const imageToRemove = prev.find((img) => img.id === imageId)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview)
      }

      return updated
    })
  }

  const retryUpload = (imageId: string) => {
    const image = images.find((img) => img.id === imageId)
    if (image) {
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, status: "uploading", progress: 0 } : img)))
      uploadImage(image)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const uploadedCount = images.filter((img) => img.status === "uploaded").length
  const isMinimumMet = uploadedCount >= minImages

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 text-blue-500" />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Upload Vehicle Images</h3>
              <p className="text-gray-600 mb-4">Drag and drop images here, or click to select files</p>
              <p className="text-sm text-gray-500">
                Need {minImages} images minimum • {uploadedCount}/{maxImages} uploaded
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                <FileImage className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
              <Button onClick={() => cameraInputRef.current?.click()} variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Take Photos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {images.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Upload Progress</span>
              <Badge variant={isMinimumMet ? "default" : "secondary"}>
                {uploadedCount}/{minImages} minimum
              </Badge>
            </div>
            <Progress value={(uploadedCount / minImages) * 100} className="w-full" />
          </CardContent>
        </Card>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="relative overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-square relative">
                  <img src={image.preview || "/placeholder.svg"} alt="Vehicle" className="w-full h-full object-cover" />

                  {/* Status Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    {image.status === "uploading" && (
                      <div className="text-center text-white">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <div className="text-xs">{image.progress}%</div>
                      </div>
                    )}
                    {image.status === "uploaded" && <CheckCircle className="w-8 h-8 text-green-500" />}
                    {image.status === "error" && (
                      <div className="text-center">
                        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                        <Button size="sm" variant="outline" onClick={() => retryUpload(image.id)} className="text-xs">
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 w-6 h-6 p-0"
                    onClick={() => removeImage(image.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Status Alert */}
      {images.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isMinimumMet ? (
              <span className="text-green-600">
                ✓ Minimum images uploaded. You can proceed to analysis or add more images for better accuracy.
              </span>
            ) : (
              <span>
                Upload at least {minImages - uploadedCount} more image{minImages - uploadedCount !== 1 ? "s" : ""} to
                continue.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />
    </div>
  )
}
