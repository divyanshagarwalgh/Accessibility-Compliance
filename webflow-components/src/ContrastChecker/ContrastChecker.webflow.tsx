import { props } from "@webflow/data-types";
import { declareComponent } from "@webflow/react";
import { ContrastChecker } from "./ContrastChecker";

export default declareComponent(ContrastChecker, {
  name: "Contrast Checker",
  description:
    "WCAG 2.2 colour contrast checker. Single pair and whole-palette modes. Runs entirely in the browser — no network calls, no email gate.",
  group: "Accessibility",
  options: {
    // SSR stays ON. This component sits on /tools/color-contrast-checker, which
    // targets 12,100 searches a month, so the initial HTML has to be real content
    // and not an empty div waiting on hydration.
    ssr: true,
    // Lets the host page's tag-level typography reach inside the Shadow DOM, so
    // the widget inherits the site's base type rather than restating it.
    applyTagSelectors: true,
  },
  props: {
    foreground: props.Text({
      name: "Foreground",
      defaultValue: "#FF7A45",
    }),
    background: props.Text({
      name: "Background",
      defaultValue: "#FFFFFF",
    }),
    mode: props.Variant({
      name: "Mode",
      options: ["Single pair", "Whole palette"],
      defaultValue: "Single pair",
    }),
    neutral: props.Text({
      name: "Neutral fallback",
      defaultValue: "#1A1A1A",
    }),
    palette: props.Text({
      name: "Palette",
      defaultValue: [
        "Orange 500 #FF4D00",
        "Orange 300 #FF7A45",
        "Ink 900 #1A1A1A",
        "Grey 600 #525252",
        "Grey 500 #737373",
        "Surface #F6F6F6",
        "White #FFFFFF",
      ].join("\n"),
    }),
  },
});
