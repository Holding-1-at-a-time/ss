// VIN validation and decoding utilities
export interface VehicleMetadata {
  make: string
  model: string
  year: number
  bodyClass?: string
  engineSize?: string
  fuelType?: string
  driveType?: string
  trim?: string
}

export interface VPICResponse {
  Results: Array<{
    Variable: string
    Value: string | null
    ValueId: string | null
  }>
  Count: number
  Message: string
}

// VIN validation using check digit algorithm
export function isValidVIN(vin: string): boolean {
  if (!vin || typeof vin !== "string") return false

  // Remove spaces and convert to uppercase
  const cleanVIN = vin.replace(/\s/g, "").toUpperCase()

  // Check length
  if (cleanVIN.length !== 17) return false

  // Check for invalid characters (I, O, Q not allowed)
  if (/[IOQ]/.test(cleanVIN)) return false

  // Check for valid characters (alphanumeric only)
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVIN)) return false

  // Validate check digit (9th position)
  return validateVINCheckDigit(cleanVIN)
}

function validateVINCheckDigit(vin: string): boolean {
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
  const values: { [key: string]: number } = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    F: 6,
    G: 7,
    H: 8,
    J: 1,
    K: 2,
    L: 3,
    M: 4,
    N: 5,
    P: 7,
    R: 9,
    S: 2,
    T: 3,
    U: 4,
    V: 5,
    W: 6,
    X: 7,
    Y: 8,
    Z: 9,
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
  }

  let sum = 0
  for (let i = 0; i < 17; i++) {
    if (i === 8) continue // Skip check digit position
    const char = vin[i]
    const value = values[char]
    if (value === undefined) return false
    sum += value * weights[i]
  }

  const checkDigit = sum % 11
  const expectedCheckDigit = checkDigit === 10 ? "X" : checkDigit.toString()

  return vin[8] === expectedCheckDigit
}

// Decode VIN using NHTSA vPIC API
export async function decodeVINFromAPI(vin: string): Promise<VehicleMetadata | null> {
  if (!isValidVIN(vin)) {
    throw new Error("Invalid VIN format")
  }

  const cleanVIN = vin.replace(/\s/g, "").toUpperCase()

  try {
    // NHTSA vPIC API endpoint
    const apiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${cleanVIN}?format=json`

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SlickSolutions/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`vPIC API error: ${response.status} ${response.statusText}`)
    }

    const data: VPICResponse = await response.json()

    if (!data.Results || data.Results.length === 0) {
      return null
    }

    // Extract relevant vehicle information
    const results = data.Results
    const getValue = (variable: string): string | undefined => {
      const result = results.find((r) => r.Variable === variable)
      return result?.Value || undefined
    }

    const year = Number.parseInt(getValue("Model Year") || "0")
    if (year === 0) {
      throw new Error("Unable to determine vehicle year from VIN")
    }

    const make = getValue("Make")
    const model = getValue("Model")

    if (!make || !model) {
      throw new Error("Unable to determine vehicle make/model from VIN")
    }

    return {
      make,
      model,
      year,
      bodyClass: getValue("Body Class"),
      engineSize: getValue("Engine Number of Cylinders")
        ? `${getValue("Engine Number of Cylinders")} cylinder`
        : getValue("Displacement (L)")
          ? `${getValue("Displacement (L)")}L`
          : undefined,
      fuelType: getValue("Fuel Type - Primary"),
      driveType: getValue("Drive Type"),
      trim: getValue("Trim"),
    }
  } catch (error) {
    console.error("VIN decoding failed:", error)
    throw new Error(error instanceof Error ? `VIN decode failed: ${error.message}` : "VIN decode failed: Unknown error")
  }
}

// Simulate vPIC API for development/testing
export async function simulateVINDecode(vin: string): Promise<VehicleMetadata | null> {
  if (!isValidVIN(vin)) {
    throw new Error("Invalid VIN format")
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Mock data based on VIN patterns
  const mockData: { [key: string]: VehicleMetadata } = {
    "1HGBH41JXMN109186": {
      make: "Honda",
      model: "Civic",
      year: 2021,
      bodyClass: "Sedan",
      engineSize: "4 cylinder",
      fuelType: "Gasoline",
      driveType: "Front-Wheel Drive",
      trim: "LX",
    },
    "1FTFW1ET5DFC10312": {
      make: "Ford",
      model: "F-150",
      year: 2013,
      bodyClass: "Pickup",
      engineSize: "8 cylinder",
      fuelType: "Gasoline",
      driveType: "Four-Wheel Drive",
      trim: "XLT",
    },
    WBAVA33598NL73456: {
      make: "BMW",
      model: "328i",
      year: 2008,
      bodyClass: "Sedan",
      engineSize: "6 cylinder",
      fuelType: "Gasoline",
      driveType: "Rear-Wheel Drive",
      trim: "Base",
    },
  }

  const cleanVIN = vin.replace(/\s/g, "").toUpperCase()

  // Return mock data if available, otherwise generate generic data
  if (mockData[cleanVIN]) {
    return mockData[cleanVIN]
  }

  // Generate basic data from VIN structure
  const yearCode = cleanVIN[9]
  const yearMap: { [key: string]: number } = {
    A: 2010,
    B: 2011,
    C: 2012,
    D: 2013,
    E: 2014,
    F: 2015,
    G: 2016,
    H: 2017,
    J: 2018,
    K: 2019,
    L: 2020,
    M: 2021,
    N: 2022,
    P: 2023,
    R: 2024,
  }

  return {
    make: "Unknown",
    model: "Unknown",
    year: yearMap[yearCode] || 2020,
    bodyClass: "Unknown",
    fuelType: "Gasoline",
  }
}

// VIN history and validation utilities
export function extractVINInfo(vin: string) {
  if (!isValidVIN(vin)) {
    return null
  }

  const cleanVIN = vin.toUpperCase()

  return {
    worldManufacturerIdentifier: cleanVIN.substring(0, 3),
    vehicleDescriptorSection: cleanVIN.substring(3, 9),
    vehicleIdentifierSection: cleanVIN.substring(9, 17),
    checkDigit: cleanVIN[8],
    modelYear: cleanVIN[9],
    plantCode: cleanVIN[10],
    sequentialNumber: cleanVIN.substring(11, 17),
  }
}
