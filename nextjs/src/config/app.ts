/**
 * Application Configuration
 * 
 * Centralized configuration for the Social Media Monitoring application.
 * Modify these values to customize the application for your needs.
 */

export const appConfig = {
  // Basic app information
  name: "YTDM",
  description: "Manage YouTube video descriptions with dynamic templates",
  supportEmail: "support@yourdomain.com",

  // Branding
  brand: {
    name: "YTDM",
    shortName: "YTDM",
    tagline: "Manage YouTube descriptions with ease",
  },

  // Authentication settings
  auth: {
    enableSignUp: true,
    enablePasswordReset: true,
    adminEmails: [
      "r@rayamjad.com", // Your email here
    ] as readonly string[],
  },

  // Dashboard configuration
  dashboard: {
    defaultRoute: "/dashboard/youtube",
    showSettings: true,
    navigation: [
      {
        title: "Dashboard",
        url: "/dashboard/youtube",
      },
      {
        title: "Pricing",
        url: "/dashboard/pricing",
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
      },
    ],
  },
} as const;

export type AppConfig = typeof appConfig;