import { redirect } from "next/navigation";

// Award picks are now account-level — made once from /awards and mirrored to
// every league the user is in. This per-league route just forwards there so old
// links and bookmarks keep working.
export default function LeagueAwardsRedirect() {
  redirect("/awards");
}
