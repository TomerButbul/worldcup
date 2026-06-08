# Store data-disclosure cheat sheet

Copy these answers into **Google Play → Data safety** and **Apple → App Privacy**.
They match the privacy policy at `/privacy` and what the app actually does. Keep them
in sync if data practices ever change (e.g. you add analytics or ads).

Privacy policy URL: `https://<your-domain>/privacy`

## What the app actually stores
- **Name** — display/manager name (and, via Google sign-in, your Google name).
- **Email** — from Google sign-in or email/password signup. (Guest accounts have none.)
- **Profile photo URL** — only if you sign in with Google (it's the Google avatar URL).
- **User content** — your predictions, bracket, award picks, scores, leagues.
- **Push token** — only if you enable notifications; removed when you disable them.
- **Session cookie** — to keep you signed in. No tracking/ad cookies.

Not collected: location, contacts, payment info (donations go through a third-party
processor), advertising IDs, analytics, device fingerprints.

## Google Play — Data safety form
- **Does your app collect or share user data?** → **Collect: Yes. Share: No.**
  (Vercel/Supabase/Google are *service providers* processing on your behalf — that is
  not "sharing" in Play's definition.)
- **Is all data encrypted in transit?** → **Yes** (HTTPS everywhere).
- **Can users request that data be deleted?** → **Yes** — in-app: Profile → Delete
  account (immediate, wipes everything). Also provide your contact email.
- **Data types to declare** (Collected, *not* Shared; purpose = **App functionality** +
  **Account management**; *not* Advertising/Analytics):
  - Personal info → **Name**, **Email address**
  - Photos → **Photos** *(the Google avatar URL — declare it to be safe; or omit if you
    stop storing it)*
  - App activity → **Other user-generated content** (predictions/picks)
  - Device or other IDs → only if you keep push tokens; otherwise leave unchecked
- **Account creation** → Yes; **users can delete their account** → Yes (link the same
  in-app flow; the policy URL also documents it).

## Apple — App Privacy ("nutrition labels")
- **Data used to track you:** **None.**
- **Data linked to you** (purpose: **App Functionality** only — not tracking/ads):
  - **Contact Info →** Name, Email Address
  - **User Content →** your predictions/picks
  - **Identifiers →** User ID
- **Data not linked to you:** none of note.
- **Account deletion:** required and supported (Profile → Delete account). Apple checks
  this exists.

## Reminders
- These say you collect Name/Email *because Google sign-in inherently provides them* —
  declaring "we collect nothing" while using Google login gets the app **rejected** for
  a mismatch. Honest + minimal is the safe play.
- If you later add analytics, ads, or sell/share data, you **must** update `/privacy`
  AND these store forms, or you're out of compliance.
