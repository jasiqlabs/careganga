/**
 * CareGanga Foundation — Auth Presentation Configuration
 *
 * Provides CMS-controllable presentation text, media, and feature indicators
 * for the split-screen authentication experience.
 *
 * When CG-18 (CMS & Publication) is implemented, dynamic overrides can flow
 * directly into this contract without requiring structural JSX changes.
 */
export interface AuthFeatureIndicator {
  id: string;
  label: string;
  color: string;
  icon: "shield" | "dashboard" | "chart" | "lock";
}

export interface AuthPresentationConfig {
  branding: {
    logoSrc: string;
    logoAlt: string;
    brandName: string;
    foundationLabel: string;
    tagline: string;
  };
  editorial: {
    welcomePrefix: string;
    brandTitle: string;
    accentWord: string;
    systemSubtitle: string;
    missionStatement: string;
  };
  media: {
    heroImageSrc: string;
    heroImageAlt: string;
    initiativeWheelSrc: string;
    initiativeWheelAlt: string;
  };
  features: AuthFeatureIndicator[];
  footer: {
    aboutLabel?: string;
    aboutHref?: string;
    verifyEmployeeLabel: string;
    verifyEmployeeHref: string;
    contactSupportLabel: string;
    contactSupportHref: string;
    privacyLabel: string;
    privacyHref: string;
    termsLabel: string;
    termsHref: string;
    copyrightText: string;
    versionText: string;
  };
}

export const defaultAuthPresentationConfig: AuthPresentationConfig = {
  branding: {
    logoSrc: "/careganga-mark.png",
    logoAlt: "CareGanga Foundation logo",
    brandName: "CareGanga",
    foundationLabel: "FOUNDATION",
    tagline: "Care • Empower • Transform"
  },
  editorial: {
    welcomePrefix: "Welcome to",
    brandTitle: "CareGanga",
    accentWord: "Foundation",
    systemSubtitle: "Digital Management System",
    missionStatement:
      "A unified platform to manage, monitor and empower every initiative for a healthier, more inclusive tomorrow."
  },
  media: {
    heroImageSrc: "/careganga-hero-community.jpg",
    heroImageAlt: "CareGanga mentor and students in community learning program",
    initiativeWheelSrc: "/careganga-initiative-wheel.png",
    initiativeWheelAlt: "CareGanga Foundation core community initiative areas"
  },
  features: [
    {
      id: "secure-access",
      label: "Secure Access",
      color: "#10B981",
      icon: "shield"
    },
    {
      id: "role-dashboard",
      label: "Role Based Dashboard",
      color: "#2563EB",
      icon: "dashboard"
    },
    {
      id: "realtime-reports",
      label: "Real-time Reports",
      color: "#F59E0B",
      icon: "chart"
    },
    {
      id: "data-protection",
      label: "Data Protection",
      color: "#8B5CF6",
      icon: "lock"
    }
  ],
  footer: {
    aboutLabel: "About Us",
    aboutHref: "/about",
    verifyEmployeeLabel: "Verify Employee ID",
    verifyEmployeeHref: "/ngo-information",
    contactSupportLabel: "Contact Support",
    contactSupportHref: "/contact",
    privacyLabel: "Privacy Policy",
    privacyHref: "/policies/privacy-policy",
    termsLabel: "Terms & Conditions",
    termsHref: "/policies/terms-and-conditions",
    copyrightText: "© 2026 CareGanga Foundation. All rights reserved.",
    versionText: "Version 1.0.0"
  }
};
