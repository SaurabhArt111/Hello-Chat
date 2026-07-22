export const ripplePulse = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.4],
    opacity: [1, 0],
    transition: {
      duration: 1.5,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeOut",
    },
  },
};

export const screenSlideUp = {
  initial: { y: 48, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { y: 24, opacity: 0, transition: { duration: 0.28, ease: "easeInOut" } },
};

export const buttonPressSpring = {
  whileTap: { scale: 0.92 },
  transition: { type: "spring", stiffness: 400, damping: 25 },
};

export const controlBarHide = {
  visible: { opacity: 1, y: 0, pointerEvents: "auto" },
  hidden: { opacity: 0, y: 20, pointerEvents: "none" },
};

export const cameraFlip = {
  firstHalf: { rotateY: 90, transition: { duration: 0.15, ease: "easeIn" } },
  secondHalf: { rotateY: 180, transition: { duration: 0.15, ease: "easeOut" } },
};
