import Link from "next/link";
import { Brand } from "@/components/brand";
export default function PrivacyPage() {
  return <main className="page-shell privacy-page"><Brand /><h1>Privacy & encryption</h1>
    <h2>Journal content is end-to-end encrypted</h2><p>After you set up your vault and migration finishes, entry text, dates, emojis, scores, hashtags, sticker names, and sticker files are encrypted in your browser before storage. The app server does not receive your passphrase, recovery key, or decrypted journal. Charts and weekly reflections run on your device.</p>
    <h2>What the service can see</h2><p>Email and username are readable. Basic account and service metadata—such as account IDs, sign-in activity, IP addresses in infrastructure logs, ciphertext sizes, and storage access times—can also be visible. Encryption does not hide that an account exists or uses storage.</p>
    <h2>Your keys</h2><p>Use a strong, unique vault passphrase and store the recovery key safely. Email login alone cannot decrypt the journal. We cannot recover it if you lose both unlock methods. Unlocked keys stay in browser memory, not cookies or local storage. Reloading or locking the journal clears the app’s access to them.</p>
    <h2>Existing data</h2><p>The browser verifies encrypted copies before removing live plaintext entries and files. Accounts that have not completed migration can still have legacy plaintext. Earlier backups, exports, and data previously sent to an AI provider cannot be retroactively encrypted by this update. The operator must handle their retention separately.</p>
    <h2>Security limits</h2><p>This protects stored journal content from being read by a database administrator without your key. It cannot protect an unlocked device, a compromised browser, or malicious code served by a compromised or dishonest app operator. It does not prevent deletion or rollback by an administrator. This implementation has not had an independent security audit; no app can promise absolute security.</p>
    <Link href="/" className="text-link">Back to MoodGrid</Link>
  </main>;
}
