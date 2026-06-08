import { config } from "../lib/config";
import { HeartIcon } from "./icons";

// Small "Support" call-to-action that links to the group's Ko-fi page.
// Renders nothing when no Ko-fi URL is configured.
export default function SupportCard() {
  if (!config.kofiUrl) return null;
  return (
    <section className="card flex items-center justify-between gap-3 p-4">
      <div>
        <p className="font-serif text-base font-semibold">Support this project</p>
        <p className="mt-0.5 text-sm text-stone-500">
          Leave an optional tip to help cover hosting and development time.
        </p>
      </div>
      <a
        href={config.kofiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary shrink-0"
      >
        <HeartIcon className="h-4 w-4" />
        Tip
      </a>
    </section>
  );
}
