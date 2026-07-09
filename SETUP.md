# Your Trash Day Team Signup - Setup Guide

This site uses a static homepage plus Netlify Functions:

- `index.html` renders the landing page and Stripe card fields.
- `/.netlify/functions/partner-config` returns the Stripe publishable key to the browser.
- `/.netlify/functions/partner-signup` stores the card with Stripe, saves the Pending Approval account record in Neon, and optionally sends a Resend notification.

## Required Environment Variables

Set these in **Netlify -> Site -> Environment variables** before launch.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Neon pooled PostgreSQL connection string. Do not commit the real value. |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Dedicated Stripe publishable key for this site. Returned by `partner-config`. |
| `STRIPE_SECRET_KEY` | Yes | Dedicated Stripe secret key used by `partner-signup`. |
| `RESEND_API_KEY` | Later | Enables signup notification emails through Resend. |
| `RESEND_FROM` | Later | Verified Resend sender, for example `Your Trash Day Team <hello@yourtrashdayteam.com>`. |
| `SIGNUP_NOTIFICATION_EMAILS` | Optional | Comma-separated recipients. Defaults to `info@trashdaymadeeasy.com,bryan@thebinboy.com`. |

`.env.example` is included with empty placeholders.

## Stripe Setup

Create a dedicated Stripe account or dedicated API keys for this offer.

1. Copy the publishable key into `STRIPE_PUBLISHABLE_KEY`.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. The current flow does not charge today and does not create a subscription automatically.
4. The form creates a Stripe Customer, stores the payment method with a SetupIntent, and marks the account Pending Approval.
5. The page language tells customers they will be auto-billed $70 on the 1st of each month after approval until they ask to pause or cancel.

## Resend Setup

After the build is live:

1. Create a Resend account.
2. Verify the sending domain or sender address.
3. Add `RESEND_API_KEY` in Netlify.
4. Add `RESEND_FROM`, for example `Your Trash Day Team <hello@yourtrashdayteam.com>`.
5. Leave `SIGNUP_NOTIFICATION_EMAILS` blank to use the default recipients, or set it to a comma-separated list.

If Resend variables are not set, signups still save to Neon and the notification status is recorded as `skipped`.

## Database

The `partner_service_signups` table is created automatically on the first successful function invocation using `DATABASE_URL`.

Primary fields include:

- Contact and account details
- `number_of_bins`
- `trash_pickup_day`
- `recycling_frequency`
- `recycling_pickup_day`
- `recycling_week`
- `$70/month` plan details
- Pending Approval status fields
- Stripe customer, payment method, and SetupIntent references
- Safe card display fields, brand and last four digits only

Raw card number, expiration, and CVC are never stored in Neon.

## Customer Billing Language

The page tells customers:

- Service is $70/month.
- Weekly bin roll-out and roll-in service is included.
- Monthly bin washing is included.
- The card is stored securely with Stripe.
- The account is pending approval at signup.
- Billing happens automatically on the 1st of each month after approval.
- There is no service contract.
- Service can be paused or canceled anytime by request.

## Notification Emails

Default notification recipients:

- `info@trashdaymadeeasy.com`
- `bryan@thebinboy.com`

Override them with `SIGNUP_NOTIFICATION_EMAILS` if needed.

## Local Testing Notes

The static page can be served with any local static server, but Stripe fields need `STRIPE_PUBLISHABLE_KEY` returned from `/.netlify/functions/partner-config`.

Use Stripe test keys and a test card such as `4242 4242 4242 4242` while testing.
