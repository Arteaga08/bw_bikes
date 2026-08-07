// Re-exported from the component that owns the context (Toast.tsx needs
// `useContext`/`createContext` colocated with `ToastProvider`) so callers
// can still `import { useToast } from "@/hooks/use-toast"` per the
// project's hooks convention.
export { useToast } from "@/components/ui/Toast";
