"use client";

import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { btnClass, GOLD_GRADIENT, type ButtonVariant } from "./buttonStyles";

export default function GameButton({
  variant = "primary",
  className = "",
  style,
  ...props
}: ComponentProps<typeof motion.button> & { variant?: ButtonVariant }) {
  const goldStyle =
    variant === "gold"
      ? { background: GOLD_GRADIENT, boxShadow: "var(--shadow-glow-gold)" }
      : undefined;
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      className={`${btnClass(variant)} ${className}`}
      style={{ ...goldStyle, ...style }}
      {...props}
    />
  );
}
