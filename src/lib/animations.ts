import { Variants } from "framer-motion";

export const shakeVariants: Variants = {
  shake: { 
    x: [0, -10, 10, -10, 10, 0], 
    transition: { duration: 0.4 } 
  }
};

export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 }
};
