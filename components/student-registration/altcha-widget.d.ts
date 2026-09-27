import type { HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "altcha-widget": HTMLAttributes<HTMLElement> & {
        challenge?: string;
        name?: string;
      };
    }
  }
}
