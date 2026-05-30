export type ButtonVariant = "primary" | "gold" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-grass text-night glow-grass hover:brightness-110 font-semibold",
  gold: "text-night font-semibold shine hover:brightness-105",
  ghost: "glass text-chalk hover:bg-white/10 border border-white/15",
};

export function btnClass(variant: ButtonVariant = "primary") {
  return `inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]}`;
}

export const GOLD_GRADIENT = "linear-gradient(90deg,#ffd970,#f6c453)";
