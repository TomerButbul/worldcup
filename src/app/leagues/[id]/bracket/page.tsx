import { redirect } from "next/navigation";

// The bracket is now account-level — built once from /bracket and mirrored to
// every league the user is in. This per-league route just forwards there so old
// links and bookmarks keep working.
export default function LeagueBracketRedirect() {
  redirect("/bracket");
}
