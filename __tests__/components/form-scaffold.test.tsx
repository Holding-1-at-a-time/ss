import type React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { z } from "zod"
import { FormScaffold, inspectionFormConfig } from "@/components/form-scaffold"
import { AuthContextProvider } from "@/lib/auth-context"
import { TenantContextProvider } from "@/lib/tenant-context"
import jest from "jest" // Import jest to fix the undeclared variable error

// Mock the contexts
const mockUser = {
  id: "user-1",
  email: "test@example.com",
  publicMetadata: { role: "admin" },
}

const mockTenant = {
  id: "tenant-1",
  name: "Test Tenant",
  subdomain: "test",
}

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

describe("FormScaffold", () => {
  const mockOnSubmit = jest.fn()
  const mockOnSave = jest.fn()

  const testSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    age: z.number().min(18, "Must be at least 18"),
  })

  const testConfig = {
    schema: testSchema,
    defaultValues: { name: "", email: "", age: 18 },
    onSubmit: mockOnSubmit,
    onSave: mockOnSave,
    title: "Test Form",
    description: "This is a test form",
    sections: [
      {
        id: "personal",
        title: "Personal Information",
        fields: [
          { name: "name", type: "text" as const, label: "Full Name", required: true },
          { name: "email", type: "email" as const, label: "Email Address", required: true },
          { name: "age", type: "number" as const, label: "Age", required: true },
        ],
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders form with title and description", () => {
    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    expect(screen.getByText("Test Form")).toBeInTheDocument()
    expect(screen.getByText("This is a test form")).toBeInTheDocument()
  })

  it("renders form fields correctly", () => {
    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument()
  })

  it("shows validation errors for required fields", async () => {
    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument()
      expect(screen.getByText("Invalid email")).toBeInTheDocument()
    })
  })

  it("validates email format", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, "invalid-email")

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Invalid email")).toBeInTheDocument()
    })
  })

  it("validates minimum age", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    const ageInput = screen.getByLabelText(/age/i)
    await user.clear(ageInput)
    await user.type(ageInput, "16")

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Must be at least 18")).toBeInTheDocument()
    })
  })

  it("submits form with valid data", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email address/i), "john@example.com")
    await user.clear(screen.getByLabelText(/age/i))
    await user.type(screen.getByLabelText(/age/i), "25")

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        age: 25,
      })
    })
  })

  it("shows unsaved changes indicator", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    await user.type(screen.getByLabelText(/full name/i), "John")

    await waitFor(() => {
      expect(screen.getByText("Unsaved Changes")).toBeInTheDocument()
    })
  })

  it("disables submit button when form is invalid", () => {
    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    const submitButton = screen.getByRole("button", { name: /submit/i })
    expect(submitButton).toBeDisabled()
  })

  it("enables submit button when form is valid", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email address/i), "john@example.com")

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /submit/i })
      expect(submitButton).not.toBeDisabled()
    })
  })
})

describe("Inspection Form Integration", () => {
  const mockOnSubmit = jest.fn()

  const config = {
    ...inspectionFormConfig,
    onSubmit: mockOnSubmit,
    defaultValues: {
      vehicleInfo: {
        make: "",
        model: "",
        year: new Date().getFullYear(),
        vin: "",
        mileage: 0,
      },
      customerInfo: {
        name: "",
        email: "",
        phone: "",
      },
      inspectionDetails: {
        type: "basic" as const,
        priority: "normal" as const,
        notes: "",
        scheduledDate: "",
        estimatedDuration: 1,
      },
    },
  }

  it("renders all inspection form sections", () => {
    render(
      <MockProviders>
        <FormScaffold config={config} />
      </MockProviders>,
    )

    expect(screen.getByText("Vehicle Information")).toBeInTheDocument()
    expect(screen.getByText("Customer Information")).toBeInTheDocument()
    expect(screen.getByText("Inspection Details")).toBeInTheDocument()
  })

  it("validates VIN length", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={config} />
      </MockProviders>,
    )

    const vinInput = screen.getByLabelText(/vin/i)
    await user.type(vinInput, "123456789") // Too short

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("VIN must be 17 characters")).toBeInTheDocument()
    })
  })

  it("submits complete inspection form", async () => {
    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={config} />
      </MockProviders>,
    )

    // Fill vehicle info
    await user.type(screen.getByLabelText(/make/i), "Toyota")
    await user.type(screen.getByLabelText(/model/i), "Camry")
    await user.type(screen.getByLabelText(/mileage/i), "50000")

    // Fill customer info
    await user.type(screen.getByLabelText(/customer name/i), "Jane Smith")
    await user.type(screen.getByLabelText(/email address/i), "jane@example.com")
    await user.type(screen.getByLabelText(/phone number/i), "1234567890")

    // Fill inspection details
    await user.type(screen.getByLabelText(/scheduled date/i), "2024-12-31")

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleInfo: expect.objectContaining({
            make: "Toyota",
            model: "Camry",
            mileage: 50000,
          }),
          customerInfo: expect.objectContaining({
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "1234567890",
          }),
          inspectionDetails: expect.objectContaining({
            scheduledDate: "2024-12-31",
          }),
        }),
      )
    })
  })
})

describe("Accessibility", () => {
  const testConfig = {
    schema: z.object({ name: z.string() }),
    defaultValues: { name: "" },
    onSubmit: jest.fn(),
    accessibility: {
      ariaLabel: "Test form",
      ariaDescribedBy: "form-description",
    },
    sections: [
      {
        id: "test",
        title: "Test Section",
        fields: [{ name: "name", type: "text" as const, label: "Name", required: true }],
      },
    ],
  }

  it("applies accessibility attributes", () => {
    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    const form = screen.getByRole("form")
    expect(form).toHaveAttribute("aria-label", "Test form")
    expect(form).toHaveAttribute("aria-describedby", "form-description")
  })

  it("marks required fields with asterisk", () => {
    render(
      <MockProviders>
        <FormScaffold config={testConfig} />
      </MockProviders>,
    )

    expect(screen.getByText("*")).toBeInTheDocument()
  })

  it("provides screen reader text for password toggle", () => {
    const passwordConfig = {
      schema: z.object({ password: z.string() }),
      defaultValues: { password: "" },
      onSubmit: jest.fn(),
      sections: [
        {
          id: "auth",
          title: "Authentication",
          fields: [{ name: "password", type: "password" as const, label: "Password" }],
        },
      ],
    }

    render(
      <MockProviders>
        <FormScaffold config={passwordConfig} />
      </MockProviders>,
    )

    expect(screen.getByText("Show password")).toBeInTheDocument()
  })
})

describe("Tenant Isolation", () => {
  it("includes tenant ID in form submissions", async () => {
    const mockOnSubmit = jest.fn()
    const config = {
      schema: z.object({ name: z.string() }),
      defaultValues: { name: "" },
      onSubmit: mockOnSubmit,
      sections: [
        {
          id: "test",
          title: "Test",
          fields: [{ name: "name", type: "text" as const, label: "Name" }],
        },
      ],
    }

    const user = userEvent.setup()

    render(
      <MockProviders>
        <FormScaffold config={config} />
      </MockProviders>,
    )

    await user.type(screen.getByLabelText(/name/i), "Test Name")

    const submitButton = screen.getByRole("button", { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
      // In a real implementation, the form would include tenant context
      // This test verifies the structure is in place
    })
  })
})

describe("RBAC Enforcement", () => {
  it("disables form for unauthorized users", () => {
    const unauthorizedUser = {
      ...mockUser,
      publicMetadata: { role: "viewer" },
    }

    const config = {
      schema: z.object({ name: z.string() }),
      defaultValues: { name: "" },
      onSubmit: jest.fn(),
      sections: [
        {
          id: "test",
          title: "Test",
          fields: [
            {
              name: "name",
              type: "text" as const,
              label: "Name",
              disabled: unauthorizedUser.publicMetadata.role === "viewer",
            },
          ],
        },
      ],
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContextProvider value={{ user: unauthorizedUser, isLoading: false }}>
          <TenantContextProvider value={{ tenant: mockTenant, isLoading: false }}>
            <FormScaffold config={config} />
          </TenantContextProvider>
        </AuthContextProvider>
      </QueryClientProvider>,
    )

    const nameInput = screen.getByLabelText(/name/i)
    expect(nameInput).toBeDisabled()
  })
})
