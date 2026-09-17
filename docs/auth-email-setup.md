# Public email sign-in

Supabase's default email sender is for testing. It permits only project team recipients and currently allows two messages per hour across the project. A different recipient does not bypass that shared quota. See [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Configure a sender

The production website is `https://www.moodgrid.fun`. For Resend, add the sending domain **`moodgrid.fun`** and publish the DNS records Resend provides. Wait until its status is **Verified** before sending. Domain verification for email is separate from connecting the website to Vercel. [Verified sending domains](https://resend.com/docs/dashboard/domains/introduction).

In Supabase, open **Authentication → Email / Emails → SMTP Settings**, enable custom SMTP, and enter your provider's settings. For Resend:

| Setting | Value |
| --- | --- |
| Sender name | `MoodGrid` |
| Sender email | `hello@moodgrid.fun`, after verifying `moodgrid.fun` in Resend |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |

Save the API key in Supabase's SMTP password field, not in the repository or a `NEXT_PUBLIC_` variable. [Resend setup instructions](https://resend.com/docs/send-with-supabase-smtp).

A `550` rejection saying `gmail.com` is not verified means the sender address still uses Gmail. Replace that sender with `hello@moodgrid.fun` after domain verification. Recipients may still use Gmail or other email providers.

In **Authentication → Rate Limits**, review the email-sending quota after configuring SMTP. Supabase documents an initial custom-SMTP limit of 30 messages per hour; choose a limit that fits your provider's allowance and expected traffic. The per-user resend interval is separate. Keep email confirmation enabled and allow new signups. [Rate-limit configuration](https://supabase.com/docs/guides/auth/rate-limits).

## Configure login redirects

Under **Authentication → URL Configuration**, set:

```text
Site URL:
https://www.moodgrid.fun

Redirect URLs:
https://www.moodgrid.fun/auth/callback
https://www.moodgrid.fun/auth/confirm
```

In Vercel, set `NEXT_PUBLIC_SITE_URL=https://www.moodgrid.fun` as **Config** for Production, then redeploy to apply changed environment values. Keep local development's `.env.local` origin separate. If the apex `moodgrid.fun` is also attached to Vercel, redirect it to the canonical `www.moodgrid.fun` domain.

Add localhost or preview callbacks separately when needed. The app requests `/auth/callback` on the browser's current origin. The README's optional token-hash email template uses the configured Site URL and `/auth/confirm`. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Verify delivery

After saving, request one link using a non-team email you control. Check Supabase Auth logs and the email provider's delivery logs, then open the latest link and confirm that it returns to MoodGrid. Test vault creation/unlock separately; successful email delivery does not verify journal migration.

If delivery still fails, inspect the failed `/auth/v1/otp` response or Auth logs for the code:

| Error | Next check |
| --- | --- |
| `email_address_not_authorized` | Default sender is still restricting recipients; check custom SMTP in the correct project. |
| `over_email_send_rate_limit` | Check project email quota and per-address resend interval; repeated retries will not fix the quota. |
| `over_request_rate_limit` | Requests from the client's IP are limited; pause retries and investigate repeated requests. |
| SMTP or delivery failure | Check credentials, verified sender, provider quota, and delivery logs. |

The application no longer promises that every HTTP 429 will clear in one minute. Only logs and the configured limits can identify the actual wait or setup change needed. [Supabase error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).
