/**
 * Application Configuration
 * 
 * Centralized configuration for the Social Media Monitoring application.
 * Modify these values to customize the application for your needs.
 */

export const appConfig = {
  // Basic app information
  name: "Social Monitor",
  description: "Monitor and track social media accounts and posts",
  supportEmail: "support@yourdomain.com",

  // Branding
  brand: {
    name: "Social Monitor",
    shortName: "SM",
    tagline: "Monitor social media with ease",
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
    defaultRoute: "/admin/twitter",
    showSettings: true,
    navigation: [
      {
        title: "Twitter Monitoring",
        subItems: [
          { title: "Dashboard", url: "/admin/twitter" },
        ],
      },
      {
        title: "Settings",
        url: "/admin/settings",
      },
    ],
  },
} as const;

export type AppConfig = typeof appConfig;