"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { consumePendingInvite } from "@/app/dashboard/actions";
import { containsProfanity } from "@/lib/profanity";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!email || !password || !displayName) {
    redirect("/signup?error=Missing+fields");
  }
  if (containsProfanity(displayName)) {
    redirect("/signup?error=Please+choose+a+different+display+name");
  }

  const supabase = await createClient();

  // If a guest is upgrading (currently signed in anonymously), attach the email +
  // password to THAT account so all their existing picks carry over — don't make
  // a brand-new user.
  const {
    data: { user: current },
  } = await supabase.auth.getUser();
  if (current?.is_anonymous) {
    const { error: upErr } = await supabase.auth.updateUser({
      email,
      password,
      data: { display_name: displayName },
    });
    if (upErr) {
      redirect(`/signup?error=${encodeURIComponent(upErr.message)}`);
    }
    await supabase
      .from("profiles")
      .update({ is_guest: false, display_name: displayName })
      .eq("id", current.id);
    const invited = await consumePendingInvite();
    redirect(invited ? `/leagues/${invited}` : "/dashboard");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Profile row is created by the on_auth_user_created DB trigger.
  // If email confirmation is enabled in Supabase, no session is returned yet.
  if (!data.session) {
    redirect("/login?info=Check+your+email+to+confirm+your+account");
  }

  // Auto-join a pending invite (from a /join/<code> link) now that we have a
  // session; otherwise land on the dashboard.
  const invitedLeagueId = await consumePendingInvite();
  redirect(invitedLeagueId ? `/leagues/${invitedLeagueId}` : "/dashboard");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  // Existing user who arrived via an invite link gets auto-joined on login too.
  const invitedLeagueId = await consumePendingInvite();
  redirect(invitedLeagueId ? `/leagues/${invitedLeagueId}` : "/dashboard");
}

// Start a guest session: an anonymous account so a visitor can play immediately,
// then upgrade later (the signup form attaches an email to this same account,
// keeping every pick). Degrades gracefully — if anonymous sign-ins aren't enabled
// in Supabase yet, fall back to the signup page so the CTA always works.
export async function playAsGuest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard"); // already playing (guest or full) → resume
  const { error } = await supabase.auth.signInAnonymously();
  if (error) redirect("/signup");
  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (!data.url) {
    redirect("/login?error=Could+not+start+Google+sign-in");
  }
  // data.url points at Google's consent screen.
  redirect(data.url);
}

export async function signInWithApple() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (!data.url) {
    redirect("/login?error=Could+not+start+Apple+sign-in");
  }
  // data.url points at Apple's consent screen.
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/forgot-password?error=Enter+your+email");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }
  // Always report success — never reveal whether an email is registered.
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    redirect("/reset-password?error=Password+must+be+at+least+6+characters");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}
