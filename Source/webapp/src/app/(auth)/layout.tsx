export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0F19]">
      {children}
    </div>
  )
}
