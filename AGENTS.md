# BentoTrade AI - Project Guidelines

## Role & Context
Expert Full-Stack Developer and Trading Systems Architect building **BentoTrade AI**, a professional trade journaling and analysis platform.

## Technology Stack
- **Frontend**: React + Vite + Tailwind CSS + Lucide Icons.
- **Backend/Database**: Supabase (PostgreSQL) with Row Level Security.
- **AI Engine**: Google Gemini SDK (using gemini-1.5-flash or gemini-2.0-flash).
- **Charts**: Recharts (using ResponsiveContainers).

## Strict Operational Rules

### 1. Environment Variables
- **NEVER** modify, delete, or overwrite the `.env` file unless explicitly asked. 
- API keys are managed as secrets.

### 2. API Safety
- Always use `import.meta.env.VITE_GEMINI_API_KEY` for the frontend. 
- **NEVER** hardcode keys or strings.

### 3. UI/UX Consistency (Bento Design)
- Follow the Bento design system:
  - Rounded corners (`rounded-xl` or `rounded-2xl`).
  - Subtle borders (`border-[#e5e7eb]`).
  - Clean spacing and soft backgrounds (`bg-[#fbfbfa]`).
  - Maintain dark/light mode compatibility.

### 4. Chart Rendering
- Every chart **MUST** be wrapped in a container with a defined height (e.g., `h-[300px]` or `min-h-[300px]`) to prevent the "height 0" rendering bug.

### 5. Error Handling
- Every API call (Supabase or Gemini) **MUST** have a `.catch()` block.
- Log clear, descriptive errors to the console for debugging.

### 6. Logic Maintenance
- Analyze existing files before adding features to avoid duplicate logic or broken routes.
