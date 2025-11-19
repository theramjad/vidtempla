import Head from "next/head";
import { LegalLayout } from "@/components/layout/LegalLayout";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy | VidTempla</title>
      </Head>
      <LegalLayout title="Privacy Policy" lastUpdated="November 19, 2025">
      <h2>Introduction</h2>
      <p>
        Welcome to VidTempla. We respect your privacy and are committed to protecting your personal data.
        This privacy policy will inform you about how we handle your personal data when you use our service
        and tell you about your privacy rights.
      </p>

      <h2>Information We Collect</h2>
      <p>We collect and process the following types of information:</p>
      <ul>
        <li>
          <strong>Account Information:</strong> Email address, name, and authentication credentials when you
          create an account
        </li>
        <li>
          <strong>YouTube Data:</strong> Channel information, video metadata (titles, descriptions), and
          OAuth tokens to access your YouTube account
        </li>
        <li>
          <strong>Usage Data:</strong> Information about how you use our service, including template creation,
          video updates, and feature usage
        </li>
        <li>
          <strong>Payment Information:</strong> Billing details processed securely through our payment processor
          (we do not store credit card numbers)
        </li>
        <li>
          <strong>Technical Data:</strong> IP address, browser type, device information, and usage analytics
        </li>
      </ul>

      <h2>How We Use Your Information</h2>
      <p>We use your personal data for the following purposes:</p>
      <ul>
        <li>To provide and maintain our service</li>
        <li>To manage your account and process payments</li>
        <li>To communicate with you about service updates and support</li>
        <li>To improve our service and develop new features</li>
        <li>To ensure security and prevent fraud</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>YouTube API Services</h2>
      <p>
        VidTempla uses YouTube API Services to access and modify your YouTube video descriptions.
        By using our service, you agree to be bound by the{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>{" "}
        and{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google Privacy Policy
        </a>.
      </p>
      <p>
        <strong>Important:</strong> We only access the YouTube data you explicitly authorize through OAuth.
        You can revoke our access at any time through your{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          Google Account settings
        </a>.
      </p>

      <h2>Data Storage and Security</h2>
      <p>
        Your data is stored securely using industry-standard encryption and security practices:
      </p>
      <ul>
        <li>All data is encrypted in transit using SSL/TLS</li>
        <li>Database access is restricted and encrypted at rest</li>
        <li>OAuth tokens are securely encrypted and never exposed</li>
        <li>We use Supabase for secure database hosting with row-level security</li>
        <li>Regular security audits and updates</li>
      </ul>

      <h2>Data Sharing</h2>
      <p>
        We do not sell your personal data. We may share your information only in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Service Providers:</strong> With trusted third-party service providers who help us operate
          our service (e.g., hosting, payment processing, analytics)
        </li>
        <li>
          <strong>Legal Requirements:</strong> When required by law or to protect our rights
        </li>
        <li>
          <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets
        </li>
      </ul>

      <h2>Your Rights</h2>
      <p>You have the following rights regarding your personal data:</p>
      <ul>
        <li>
          <strong>Access:</strong> Request a copy of your personal data
        </li>
        <li>
          <strong>Correction:</strong> Request correction of inaccurate data
        </li>
        <li>
          <strong>Deletion:</strong> Request deletion of your personal data
        </li>
        <li>
          <strong>Portability:</strong> Request transfer of your data
        </li>
        <li>
          <strong>Objection:</strong> Object to processing of your data
        </li>
        <li>
          <strong>Restriction:</strong> Request restriction of processing
        </li>
      </ul>
      <p>
        To exercise these rights, please contact us at{" "}
        <a href="mailto:support@vidtempla.com">support@vidtempla.com</a>.
      </p>

      <h2>Cookies and Tracking</h2>
      <p>
        We use cookies and similar tracking technologies to improve your experience:
      </p>
      <ul>
        <li>
          <strong>Essential Cookies:</strong> Required for authentication and basic functionality
        </li>
        <li>
          <strong>Analytics Cookies:</strong> Help us understand how you use our service
        </li>
        <li>
          <strong>Preference Cookies:</strong> Remember your settings and preferences
        </li>
      </ul>
      <p>
        You can control cookies through your browser settings, but disabling certain cookies may affect
        functionality.
      </p>

      <h2>Children's Privacy</h2>
      <p>
        Our service is not intended for children under 13 years of age. We do not knowingly collect
        personal information from children under 13. If you believe we have collected information from
        a child under 13, please contact us immediately.
      </p>

      <h2>International Data Transfers</h2>
      <p>
        Your data may be transferred to and processed in countries other than your country of residence.
        We ensure appropriate safeguards are in place to protect your data in accordance with this privacy
        policy.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain your personal data only for as long as necessary to provide our service and comply with
        legal obligations. When you delete your account, we will delete or anonymize your personal data,
        except where we are required to retain it by law.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this privacy policy from time to time. We will notify you of any material changes
        by posting the new policy on this page and updating the "Last Updated" date. Your continued use
        of the service after changes constitutes acceptance of the updated policy.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have any questions about this privacy policy or our data practices, please contact us:
      </p>
      <ul>
        <li>
          Email:{" "}
          <a href="mailto:support@vidtempla.com">support@vidtempla.com</a>
        </li>
      </ul>

      <h2>Additional Resources</h2>
      <p>
        For more information about our policies, please see:
      </p>
      <ul>
        <li>
          <Link href="/legal/terms-of-service">Terms of Service</Link>
        </li>
        <li>
          <Link href="/legal/refund-policy">Refund Policy</Link>
        </li>
      </ul>
    </LegalLayout>
    </>
  );
}
