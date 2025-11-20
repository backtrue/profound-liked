export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";

export const APP_LOGO = "https://placehold.co/128x128/E1E7EF/1F2937?text=App";

// Get API base URL
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In development, use current origin
  return window.location.origin;
};

// Generate login URL - redirect to Worker's OAuth endpoint
export const getLoginUrl = () => {
  const apiBaseUrl = getApiBaseUrl();
  // Simply redirect to the Worker's Google OAuth initiation endpoint
  // The Worker will handle the OAuth flow and redirect back
  return `${apiBaseUrl}/api/oauth/login`;
};
