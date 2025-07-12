# Slick Solutions – AI-Powered, Multi-Tenant SaaS for Vehicle Inspection & Auto Detailing

**Slick Solutions** is a multi-tenant, AI-powered SaaS platform designed for modern auto detailing and automotive inspection workflows. It streamlines vehicle intake, damage detection, intelligent pricing, scheduling, and reporting—fully integrated with Convex’s real-time backend, Ollama models, and semantic memory.

---

## 💻 Frontend Technology

| Technology | Purpose |
|------------|---------|
| **React Server Components (RSC)** | Scalable server-driven UI composition with isolated data boundaries |
| **Vercel AI SDK** | Streaming responses, object streaming, multi-model orchestration |
| **Tailwind CSS** | Utility-first styling for rapid, responsive design |
| **shadcn/ui** | Accessible, headless components for polished, customizable UIs |

---

## 🚘 Vehicle Intake & Inspection

- **VIN Scanning via Camera** — Uses vPIC API for real-time decoding of vehicle specs (make, model, trim, engine, fuel type, body class).
- **Photo Guidance Overlay** — Framing hints and quality thresholds for clean captures.
- **Damage Detection Pipeline** — Powered by `llama3.2-vision`, detects dents, scratches, severity levels, and bounding boxes.
- **Filthiness Scoring** — AI-based dirt segmentation informs cleaning labor and pricing.
- **VIN Pre-Fill** — Auto-populates vehicle details based on decoded VIN.

---

## 🧠 Semantic AI Integration

- **Inspection Embeddings** — Uses `mxbai-embed-large` to generate semantic vectors for each inspection.
- **Convex RAG Component** — Stores per-chunk embeddings with indexable precision.
- **Convex Vector Search** — Tenant-scoped similarity search for inspections and documentation retrieval.

---

## 🔗 Resources

- Convex RAG Component Docs – https://www.convex.dev/components/rag
- Llama3.2 Vision (Ollama) – https://ollama.com
- Convex Schema Best Practices – https://docs.convex.dev/databases/schemas
- OpenAI Embedding Quickstart – https://platform.openai.com/docs/guides/embeddings
