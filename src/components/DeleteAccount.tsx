"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccount } from "@/app/profile/actions";

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Deleting…" : "Permanently delete my account"}
    </button>
  );
}

// Irreversible account deletion. Tucked behind a click, then a type-"DELETE"
// confirmation, so it can't be triggered by accident. Submits to the deleteAccount
// server action, which wipes the auth user + all cascaded data.
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-chalk-dim underline decoration-dotted underline-offset-2 transition hover:text-red-600"
      >
        Delete account
      </button>
    );
  }

  return (
    <form action={deleteAccount} className="space-y-3 rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-4">
      <div>
        <p className="text-sm font-semibold text-red-600">Delete your account?</p>
        <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
          This permanently deletes your account and <span className="font-semibold text-chalk">all</span> of
          your data — your predictions, awards, scores, league memberships, any leagues you created, and
          notification settings. It can&apos;t be undone.
        </p>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-chalk-dim">
          Type <span className="font-mono font-bold text-chalk">DELETE</span> to confirm
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Type DELETE to confirm"
          className="mt-1 w-full rounded-xl border border-night/15 bg-white px-3 py-2 text-sm text-chalk outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="rounded-xl glass px-4 py-2.5 text-sm font-semibold text-chalk-dim transition hover:bg-night/5"
        >
          Cancel
        </button>
        <ConfirmButton enabled={text.trim() === "DELETE"} />
      </div>
    </form>
  );
}
