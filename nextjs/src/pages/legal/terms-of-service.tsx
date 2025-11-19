import { LegalLayout } from "@/components/layout/LegalLayout";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="January 19, 2025">
      <h2>Agreement to Terms</h2>
      <p>
        By accessing or using VidTempla ("the Service"), you agree to be bound by these Terms of Service
        ("Terms"). If you disagree with any part of these terms, you may not access the Service.
      </p>

      <h2>Description of Service</h2>
      <p>
        VidTempla is a web-based service that allows users to manage YouTube video descriptions at scale
        using dynamic templates and variables. The Service integrates with YouTube via OAuth and provides
        tools for automated description updates, version control, and bulk operations.
      </p>

      <h2>Account Registration</h2>
      <p>
        To use the Service, you must:
      </p>
      <ul>
        <li>Be at least 13 years of age</li>
        <li>Provide accurate and complete registration information</li>
        <li>Maintain the security of your account credentials</li>
        <li>Be responsible for all activities under your account</li>
        <li>Notify us immediately of any unauthorized access</li>
      </ul>

      <h2>Subscription Plans and Billing</h2>
      <h3>Free Plan</h3>
      <ul>
        <li>Limited to 5 videos</li>
        <li>1 YouTube channel</li>
        <li>Basic template management</li>
        <li>Manual description updates only</li>
      </ul>

      <h3>Pro Plan ($20/month)</h3>
      <ul>
        <li>Unlimited videos</li>
        <li>1 YouTube channel</li>
        <li>Advanced template system</li>
        <li>Automatic description updates</li>
        <li>Version history and rollback</li>
        <li>Priority support</li>
      </ul>

      <h3>Business Plan ($100/month)</h3>
      <ul>
        <li>Everything in Pro</li>
        <li>Unlimited YouTube channels</li>
        <li>Team collaboration features</li>
        <li>Bulk operations</li>
        <li>API access</li>
        <li>Dedicated support</li>
      </ul>

      <h3>Billing Terms</h3>
      <ul>
        <li>Subscriptions are billed monthly in advance</li>
        <li>You authorize us to charge your payment method automatically</li>
        <li>Prices are subject to change with 30 days notice</li>
        <li>No refunds for partial months, except as described in our{" "}
          <Link href="/legal/refund-policy">Refund Policy</Link>
        </li>
        <li>Failure to pay may result in service suspension or termination</li>
      </ul>

      <h2>YouTube Integration and Data Access</h2>
      <p>
        By connecting your YouTube channel, you grant VidTempla permission to:
      </p>
      <ul>
        <li>Access your YouTube channel information and video metadata</li>
        <li>Read and modify video descriptions on your behalf</li>
        <li>Store OAuth tokens securely for ongoing access</li>
      </ul>
      <p>
        You acknowledge that:
      </p>
      <ul>
        <li>You must comply with YouTube's Terms of Service and Community Guidelines</li>
        <li>You can revoke access at any time through your Google Account settings</li>
        <li>We are not responsible for YouTube API changes or service interruptions</li>
        <li>
          Google's{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>{" "}
          applies to data accessed through YouTube API Services
        </li>
      </ul>

      <h2>Acceptable Use</h2>
      <p>
        You agree NOT to use the Service to:
      </p>
      <ul>
        <li>Violate any laws or regulations</li>
        <li>Infringe on intellectual property rights</li>
        <li>Upload malicious code or attempt to compromise the Service</li>
        <li>Engage in spam, phishing, or deceptive practices</li>
        <li>Violate YouTube's policies or terms of service</li>
        <li>Abuse, harass, or harm other users</li>
        <li>Circumvent usage limits or access restrictions</li>
        <li>Reverse engineer or attempt to extract source code</li>
        <li>Resell or redistribute the Service without permission</li>
      </ul>

      <h2>Intellectual Property</h2>
      <h3>Your Content</h3>
      <p>
        You retain all rights to your video descriptions, templates, and other content you create
        using the Service. You grant us a limited license to store, process, and display your content
        solely for the purpose of providing the Service.
      </p>

      <h3>Our Property</h3>
      <p>
        The Service, including its software, design, features, and documentation, is owned by VidTempla
        and protected by copyright, trademark, and other intellectual property laws. You may not copy,
        modify, or create derivative works without our express permission.
      </p>

      <h2>Service Availability and Modifications</h2>
      <p>
        We strive to provide reliable service, but we do not guarantee:
      </p>
      <ul>
        <li>Uninterrupted or error-free operation</li>
        <li>Specific uptime percentages (except for Business plan SLA)</li>
        <li>Compatibility with all browsers or devices</li>
      </ul>
      <p>
        We reserve the right to:
      </p>
      <ul>
        <li>Modify or discontinue features with reasonable notice</li>
        <li>Perform maintenance that may temporarily affect availability</li>
        <li>Update these Terms with notice to users</li>
      </ul>

      <h2>Data Backup and Responsibility</h2>
      <p>
        While we maintain regular backups, you are responsible for:
      </p>
      <ul>
        <li>Maintaining backups of your original video descriptions</li>
        <li>Reviewing changes before applying updates</li>
        <li>Using version control features to track changes</li>
      </ul>
      <p>
        We are not liable for data loss resulting from your use of automatic update features or
        failure to maintain backups.
      </p>

      <h2>Privacy and Data Protection</h2>
      <p>
        Your use of the Service is also governed by our{" "}
        <Link href="/legal/privacy-policy">Privacy Policy</Link>, which describes how we collect,
        use, and protect your personal data. By using the Service, you consent to our data practices
        as described in the Privacy Policy.
      </p>

      <h2>Disclaimers and Limitation of Liability</h2>
      <h3>Service "As Is"</h3>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, OR NON-INFRINGEMENT.
      </p>

      <h3>Limitation of Liability</h3>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, VIDTEMPLA SHALL NOT BE LIABLE FOR:
      </p>
      <ul>
        <li>Indirect, incidental, special, consequential, or punitive damages</li>
        <li>Loss of profits, revenue, data, or business opportunities</li>
        <li>Service interruptions or data loss</li>
        <li>Actions taken by YouTube or Google that affect your account</li>
      </ul>
      <p>
        Our total liability for any claim shall not exceed the amount you paid us in the 12 months
        preceding the claim, or $100, whichever is greater.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless VidTempla, its officers, directors, employees, and
        agents from any claims, damages, losses, or expenses arising from:
      </p>
      <ul>
        <li>Your violation of these Terms</li>
        <li>Your violation of any third-party rights</li>
        <li>Your use or misuse of the Service</li>
        <li>Content you create or upload through the Service</li>
      </ul>

      <h2>Termination</h2>
      <h3>By You</h3>
      <p>
        You may cancel your subscription at any time through your account settings. Cancellation takes
        effect at the end of your current billing period.
      </p>

      <h3>By Us</h3>
      <p>
        We may suspend or terminate your account if you:
      </p>
      <ul>
        <li>Violate these Terms</li>
        <li>Engage in fraudulent or illegal activity</li>
        <li>Fail to pay subscription fees</li>
        <li>Use the Service in a way that harms others or the Service</li>
      </ul>

      <h3>Effect of Termination</h3>
      <p>
        Upon termination:
      </p>
      <ul>
        <li>Your access to the Service will cease</li>
        <li>We may delete your data after a reasonable grace period</li>
        <li>You remain responsible for any outstanding fees</li>
        <li>Provisions that should survive termination will continue to apply</li>
      </ul>

      <h2>Dispute Resolution</h2>
      <p>
        If you have a dispute with us, please contact{" "}
        <a href="mailto:support@vidtempla.com">support@vidtempla.com</a> first to attempt
        informal resolution. Most disputes can be resolved quickly and amicably this way.
      </p>

      <h2>Governing Law</h2>
      <p>
        These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of
        law principles. Any legal action must be brought in the courts located in [Your Jurisdiction].
      </p>

      <h2>Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be notified via email or
        a prominent notice in the Service. Your continued use after changes constitutes acceptance
        of the updated Terms.
      </p>

      <h2>Severability</h2>
      <p>
        If any provision of these Terms is found to be unenforceable, the remaining provisions will
        continue in full force and effect.
      </p>

      <h2>Contact Information</h2>
      <p>
        For questions about these Terms, please contact us:
      </p>
      <ul>
        <li>
          Email:{" "}
          <a href="mailto:support@vidtempla.com">support@vidtempla.com</a>
        </li>
      </ul>

      <h2>Additional Policies</h2>
      <p>
        Please also review:
      </p>
      <ul>
        <li>
          <Link href="/legal/privacy-policy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/legal/refund-policy">Refund Policy</Link>
        </li>
      </ul>
    </LegalLayout>
  );
}
