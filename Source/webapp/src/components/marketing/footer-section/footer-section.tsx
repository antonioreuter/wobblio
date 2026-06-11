export function FooterSection() {
  return (
    <footer data-testid="footer-section" className="border-t border-[#e2e8f0] py-8 dark:border-[#1e293b]">
      <div className="mx-auto max-w-5xl px-4">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
          <a href="/privacy" className="hover:text-[#0f172a] dark:hover:text-[#f1f5f9]">Privacy Policy</a>
          <a href="/terms" className="hover:text-[#0f172a] dark:hover:text-[#f1f5f9]">Terms of Service</a>
          <a href="/imprint" className="hover:text-[#0f172a] dark:hover:text-[#f1f5f9]">Imprint</a>
          <a href="/contact" className="hover:text-[#0f172a] dark:hover:text-[#f1f5f9]">Contact</a>
        </nav>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <span className="text-[#94a3b8]">Language:</span>
          <a href="/en" className="font-medium text-[#0d9488]" hrefLang="en">EN</a>
          <a href="/nl" className="text-[#64748b] hover:text-[#0d9488]" hrefLang="nl">NL</a>
        </div>
        <p className="mt-6 text-center text-xs text-[#94a3b8]">
          © {new Date().getFullYear()} Wobblio. Eindhoven, Netherlands.
        </p>
      </div>
    </footer>
  );
}
