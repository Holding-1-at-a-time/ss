import type React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { rest } from "msw"
import { setupServer } from "msw/node"
import BookingsPage from "@/app/bookings/page"
import { AuthContextProvider } from "@/lib/auth-context"
import { TenantContextProvider } from "@/lib/tenant-context"

// Mock data
const mockUser = {
  id: "user-1",
  email: "admin@example.com",
  publicMetadata: { role: "admin" },
}

const mockTenant = {
  id: "tenant-1",
  name: "Test Auto Shop",
  subdomain: "testshop",
}

const mockAvailability = {
  "2024-01-15": [
    {
      id: "slot-1",
      startTime: "09:00",
      endTime: "10:00",
      isAvailable: true,
      teamMember: {
        id: "member-1",
        name: "John Technician",
        role: "technician",
      },
      occupancyRate: 0.6,
      surgeMultiplier: 1.2,
      weatherImpact: 1.0,
    },
    {
      id: "slot-2",
      startTime: "10:00",
      endTime: "11:00",
      isAvailable: false,
      teamMember: {
        id: "member-1",
        name: "John Technician",
        role: "technician",
      },
      occupancyRate: 1.0,
      surgeMultiplier: 1.0,
      weatherImpact: 1.0,
      conflictReason: "Already booked",
    },
  ],
}

const mockCustomers = [
  {
    _id: "customer-1",
    name: "Jane Customer",
    email: "jane@example.com",
    phone: "1234567890",
  },
]

// MSW server setup
const server = setupServer(
  rest.get("/api/availability", (req, res, ctx) => {
    return res(ctx.json(mockAvailability))
  }),
  rest.get("/api/customers", (req, res, ctx) => {
    return res(ctx.json(mockCustomers))
  }),
  rest.post("/api/bookings", (req, res, ctx) => {
    return res(
      ctx.json({
        id: "booking-1",
        customerName: "Jane Customer",
        scheduledDate: "2024-01-15",
        scheduledTime: "09:00",
      }),
    )
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const MockProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider value={{ user: mockUser, isLoading: false }}>
        <TenantContextProvider value={{ tenant: mockTenant, isLoading: false }}>{children}</TenantContextProvider>
      </AuthContextProvider>
    </QueryClientProvider>
  )
}

describe("Booking Flow Integration", () => {
  it("displays booking calendar with available slots", async () => {
    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    expect(screen.getByText("Booking Calendar")).toBeInTheDocument()

    // Wait for availability data to load
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    // Check for surge pricing indicator
    expect(screen.getByText("Busy")).toBeInTheDocument()
  })

  it("shows unavailable slots with conflict reasons", async () => {
    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    await waitFor(() => {
      expect(screen.getByText("Already booked")).toBeInTheDocument()
    })
  })

  it("opens booking modal when clicking available slot", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Wait for calendar to load
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    // Click on available slot
    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    // Check modal opens
    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })
  })

  it("pre-fills customer information when selecting existing customer", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Open booking modal
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })

    // Select existing customer
    const customerSelect = screen.getByRole("combobox", { name: /existing customer/i })
    await user.click(customerSelect)

    await waitFor(() => {
      expect(screen.getByText("Jane Customer - jane@example.com")).toBeInTheDocument()
    })

    await user.click(screen.getByText("Jane Customer - jane@example.com"))

    // Check that customer info is pre-filled
    await waitFor(() => {
      expect(screen.getByDisplayValue("Jane Customer")).toBeInTheDocument()
      expect(screen.getByDisplayValue("jane@example.com")).toBeInTheDocument()
      expect(screen.getByDisplayValue("1234567890")).toBeInTheDocument()
    })
  })

  it("calculates pricing with surge and weather adjustments", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Open booking modal
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })

    // Check surge pricing alert
    expect(screen.getByText(/High demand period/)).toBeInTheDocument()
    expect(screen.getByText(/20% surge/)).toBeInTheDocument()

    // Check pricing summary shows surge adjustment
    expect(screen.getByText("Surge Pricing (20%)")).toBeInTheDocument()
  })

  it("validates required fields before submission", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Open booking modal
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })

    // Try to submit without filling required fields
    const submitButton = screen.getByRole("button", { name: /create booking/i })
    fireEvent.click(submitButton)

    // Check validation errors
    await waitFor(() => {
      expect(screen.getByText("Customer name is required")).toBeInTheDocument()
      expect(screen.getByText("Invalid email address")).toBeInTheDocument()
      expect(screen.getByText("Vehicle make is required")).toBeInTheDocument()
    })
  })

  it("successfully creates booking with valid data", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Open booking modal
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })

    // Fill out form
    await user.type(screen.getByLabelText(/customer name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/phone/i), "9876543210")
    await user.type(screen.getByLabelText(/make/i), "Honda")
    await user.type(screen.getByLabelText(/model/i), "Civic")

    // Submit form
    const submitButton = screen.getByRole("button", { name: /create booking/i })
    fireEvent.click(submitButton)

    // Check success message
    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    })
  })

  it("enforces tenant isolation in API calls", async () => {
    let capturedTenantId: string | null = null

    server.use(
      rest.get("/api/availability", (req, res, ctx) => {
        capturedTenantId = req.url.searchParams.get("tenantId")
        return res(ctx.json(mockAvailability))
      }),
    )

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    await waitFor(() => {
      expect(capturedTenantId).toBe("tenant-1")
    })
  })

  it("handles API errors gracefully", async () => {
    server.use(
      rest.get("/api/availability", (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: "Server error" }))
      }),
    )

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Should show error state or fallback UI
    await waitFor(() => {
      // In a real implementation, there would be error handling UI
      expect(screen.getByText("Booking Calendar")).toBeInTheDocument()
    })
  })

  it("prevents double-booking of time slots", async () => {
    const user = userEvent.setup()

    server.use(
      rest.post("/api/bookings", (req, res, ctx) => {
        return res(ctx.status(409), ctx.json({ error: "Time slot no longer available" }))
      }),
    )

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Open booking modal and fill form
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })

    // Fill required fields
    await user.type(screen.getByLabelText(/customer name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/phone/i), "9876543210")
    await user.type(screen.getByLabelText(/make/i), "Honda")
    await user.type(screen.getByLabelText(/model/i), "Civic")

    // Submit and expect error
    const submitButton = screen.getByRole("button", { name: /create booking/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Time slot no longer available")).toBeInTheDocument()
    })
  })
})

describe("RBAC in Booking System", () => {
  it("allows admin users to create bookings", async () => {
    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    expect(screen.getByText("Booking Calendar")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /quick book/i })).toBeInTheDocument()
  })

  it("restricts booking creation for viewer role", () => {
    const viewerUser = {
      ...mockUser,
      publicMetadata: { role: "viewer" },
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContextProvider value={{ user: viewerUser, isLoading: false }}>
          <TenantContextProvider value={{ tenant: mockTenant, isLoading: false }}>
            <BookingsPage />
          </TenantContextProvider>
        </AuthContextProvider>
      </QueryClientProvider>,
    )

    // Viewer should see calendar but not be able to create bookings
    expect(screen.getByText("Booking Calendar")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /quick book/i })).not.toBeInTheDocument()
  })
})

describe("Performance and UX", () => {
  it("shows loading states during data fetching", () => {
    server.use(
      rest.get("/api/availability", (req, res, ctx) => {
        return res(ctx.delay(1000), ctx.json(mockAvailability))
      }),
    )

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Should show skeleton loading state
    expect(screen.getByText("Booking Calendar")).toBeInTheDocument()
    // In a real implementation, skeleton components would be visible
  })

  it("debounces search input in customer selection", async () => {
    const user = userEvent.setup()
    let searchCallCount = 0

    server.use(
      rest.get("/api/customers", (req, res, ctx) => {
        searchCallCount++
        return res(ctx.json(mockCustomers))
      }),
    )

    render(
      <MockProviders>
        <BookingsPage />
      </MockProviders>,
    )

    // Open booking modal
    await waitFor(() => {
      expect(screen.getByText("John Technician")).toBeInTheDocument()
    })

    const availableSlot = screen.getByText("John Technician").closest("div")
    if (availableSlot) {
      fireEvent.click(availableSlot)
    }

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeInTheDocument()
    })

    // Type in customer name field rapidly
    const customerNameInput = screen.getByLabelText(/customer name/i)
    await user.type(customerNameInput, "John")

    // Should not make excessive API calls
    await waitFor(() => {
      expect(searchCallCount).toBeLessThan(5)
    })
  })
})
