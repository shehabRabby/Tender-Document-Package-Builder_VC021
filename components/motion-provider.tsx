"use client";

import { LazyMotion, MotionConfig } from "framer-motion";

const loadFeatures = () => import("./motion-features").then((module) => module.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures} strict><MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: "easeOut" }}>{children}</MotionConfig></LazyMotion>;
}
