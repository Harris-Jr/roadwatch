import { createFileRoute, redirect } from "@tanstack/react-router";

// Login is consolidated at /auth (one login for individual/business/government,
// routed by the real role the backend returns) — this route is kept only so
// old bookmarks/links to /admin/login don't 404.
export const Route = createFileRoute("/admin/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
