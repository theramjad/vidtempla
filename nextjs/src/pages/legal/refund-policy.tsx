import { LegalLayout } from "@/components/layout/LegalLayout";
import Link from "next/link";

export default function RefundPolicy() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="January 19, 2025">
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
          Our 30-Day Money-Back Guarantee
        </h3>
        <p className="text-blue-800 dark:text-blue-200 mb-0">
          We want you to be completely satisfied with VidTempla. If you're not happy with our service
          for any reason, we offer a full refund within 30 days of your initial purchase, no questions asked.
        </p>
      </div>

      <h2>Refund Eligibility</h2>
      <p>
        You are eligible for a full refund if:
      </p>
      <ul>
        <li>You request a refund within 30 days of your first payment</li>
        <li>You have not violated our Terms of Service</li>
        <li>You have not engaged in fraudulent or abusive behavior</li>
        <li>Your account is in good standing</li>
      </ul>

      <h2>What's Covered</h2>
      <h3>Eligible for Refund:</h3>
      <ul>
        <li>
          <strong>First-time subscriptions:</strong> Full refund within 30 days of initial purchase
        </li>
        <li>
          <strong>Annual subscriptions:</strong> Pro-rated refund if cancelled within 30 days
        </li>
        <li>
          <strong>Technical issues:</strong> If we cannot resolve critical service problems
        </li>
        <li>
          <strong>Duplicate charges:</strong> Accidental double billing or payment errors
        </li>
      </ul>

      <h3>Not Eligible for Refund:</h3>
      <ul>
        <li>Subscription renewals after the initial 30-day period</li>
        <li>Partial month refunds (except for billing errors)</li>
        <li>Refunds requested after account termination for Terms violations</li>
        <li>Change of mind after 30 days</li>
        <li>Free plan upgrades or downgrades</li>
      </ul>

      <h2>How to Request a Refund</h2>
      <p>
        Requesting a refund is simple. Follow these steps:
      </p>
      <ol>
        <li>
          <strong>Contact Support:</strong> Email us at{" "}
          <a href="mailto:support@vidtempla.com">support@vidtempla.com</a> with your account
          email and reason for the refund request
        </li>
        <li>
          <strong>Provide Details:</strong> Include your order/transaction ID if available
        </li>
        <li>
          <strong>Await Confirmation:</strong> We'll review your request within 1-2 business days
        </li>
        <li>
          <strong>Receive Refund:</strong> Once approved, refunds are processed within 5-7 business days
        </li>
      </ol>

      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 my-8">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-0">
          <strong>Processing Time:</strong> Refunds are issued to your original payment method.
          Depending on your bank or card issuer, it may take an additional 5-10 business days for
          the credit to appear in your account.
        </p>
      </div>

      <h2>Refund Processing</h2>
      <h3>Payment Method</h3>
      <p>
        Refunds are issued to the original payment method used for the purchase:
      </p>
      <ul>
        <li>
          <strong>Credit/Debit Cards:</strong> Refunded to the card used for payment
        </li>
        <li>
          <strong>PayPal:</strong> Refunded to your PayPal account
        </li>
        <li>
          <strong>Other Methods:</strong> Refunded via the same payment processor
        </li>
      </ul>

      <h3>Timeline</h3>
      <ul>
        <li>
          <strong>Review:</strong> 1-2 business days
        </li>
        <li>
          <strong>Processing:</strong> 5-7 business days
        </li>
        <li>
          <strong>Bank Posting:</strong> 5-10 business days (varies by institution)
        </li>
      </ul>

      <h2>Special Circumstances</h2>
      <h3>Service Outages</h3>
      <p>
        If VidTempla experiences significant downtime that prevents you from using the service:
      </p>
      <ul>
        <li>We will provide service credits or pro-rated refunds</li>
        <li>Downtime must exceed 24 consecutive hours to qualify</li>
        <li>Scheduled maintenance does not count as downtime</li>
      </ul>

      <h3>YouTube API Changes</h3>
      <p>
        If changes to the YouTube API significantly impact core functionality:
      </p>
      <ul>
        <li>We will work diligently to restore functionality</li>
        <li>Pro-rated refunds available if issues cannot be resolved within 30 days</li>
        <li>We are not liable for temporary YouTube API disruptions</li>
      </ul>

      <h3>Account Issues</h3>
      <p>
        For issues with your YouTube account or OAuth permissions:
      </p>
      <ul>
        <li>We can assist with troubleshooting and support</li>
        <li>Refunds not available for user-caused OAuth revocations</li>
        <li>Refunds available if we cannot resolve authentication issues on our end</li>
      </ul>

      <h2>Cancellation vs. Refund</h2>
      <h3>Cancellation</h3>
      <p>
        You can cancel your subscription at any time:
      </p>
      <ul>
        <li>Cancellation takes effect at the end of your current billing period</li>
        <li>You retain access until the period ends</li>
        <li>No refund for the current billing period (unless within 30-day guarantee)</li>
        <li>You can reactivate anytime without losing data</li>
      </ul>

      <h3>Refund</h3>
      <p>
        A refund terminates your subscription immediately:
      </p>
      <ul>
        <li>Access is revoked upon refund processing</li>
        <li>Data may be deleted after a grace period</li>
        <li>You must repurchase to regain access</li>
      </ul>

      <h2>Exceptions and Limitations</h2>
      <h3>Usage Limits</h3>
      <p>
        Excessive usage before requesting a refund may affect eligibility:
      </p>
      <ul>
        <li>Updating hundreds of videos then requesting a refund</li>
        <li>Using premium features extensively before canceling</li>
        <li>Creating and exporting large amounts of data</li>
      </ul>
      <p>
        We review refund requests on a case-by-case basis and reserve the right to deny requests
        that show clear signs of service abuse.
      </p>

      <h3>Multiple Refunds</h3>
      <ul>
        <li>One refund per customer within a 12-month period</li>
        <li>Repeated subscription/refund patterns may result in denial</li>
        <li>We may restrict future purchases after multiple refund requests</li>
      </ul>

      <h2>Downgrades and Credits</h2>
      <p>
        Instead of a refund, you may prefer:
      </p>
      <ul>
        <li>
          <strong>Downgrade:</strong> Switch to a lower-tier plan with pro-rated credit
        </li>
        <li>
          <strong>Service Credit:</strong> Apply refund amount to future billing
        </li>
        <li>
          <strong>Extended Trial:</strong> Additional time to evaluate the service
        </li>
      </ul>
      <p>
        Contact <a href="mailto:support@vidtempla.com">support@vidtempla.com</a> to discuss alternatives.
      </p>

      <h2>Disputed Charges</h2>
      <p>
        Before filing a chargeback with your bank:
      </p>
      <ul>
        <li>
          <strong>Contact us first:</strong> Most billing issues can be resolved quickly
        </li>
        <li>
          <strong>Provide details:</strong> Help us identify and fix the problem
        </li>
        <li>
          <strong>Avoid chargebacks:</strong> They may result in account suspension
        </li>
      </ul>
      <p>
        Chargebacks incur fees and administrative costs. We're happy to resolve billing issues
        directly and will process legitimate refund requests promptly.
      </p>

      <h2>Tax and Processing Fees</h2>
      <ul>
        <li>Refunds include all taxes paid</li>
        <li>Payment processing fees are non-refundable</li>
        <li>Currency conversion fees may not be refundable</li>
      </ul>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Refund Policy from time to time. Changes will be posted on this page
        with an updated "Last Updated" date. Material changes affecting existing subscriptions
        will be communicated via email.
      </p>

      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6 mt-8">
        <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-3">
          Need Help? We're Here for You
        </h3>
        <p className="text-green-800 dark:text-green-200 mb-4">
          Before requesting a refund, let us try to help! Many issues can be resolved with quick
          support. Our team is committed to your success with VidTempla.
        </p>
        <p className="text-green-800 dark:text-green-200 mb-0">
          Contact us at{" "}
          <a
            href="mailto:support@vidtempla.com"
            className="font-semibold underline hover:no-underline"
          >
            support@vidtempla.com
          </a>
        </p>
      </div>

      <h2>Contact Information</h2>
      <p>
        For refund requests or questions about this policy:
      </p>
      <ul>
        <li>
          Email:{" "}
          <a href="mailto:support@vidtempla.com">support@vidtempla.com</a>
        </li>
      </ul>

      <h2>Related Policies</h2>
      <p>
        For more information, please review:
      </p>
      <ul>
        <li>
          <Link href="/legal/terms-of-service">Terms of Service</Link>
        </li>
        <li>
          <Link href="/legal/privacy-policy">Privacy Policy</Link>
        </li>
      </ul>
    </LegalLayout>
  );
}
