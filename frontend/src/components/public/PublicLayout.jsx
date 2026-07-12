import PublicFooter from "./PublicFooter";
import PublicNavbar from "./PublicNavbar";

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
