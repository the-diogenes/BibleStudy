import { config } from "../lib/config";

// EDIT THIS PAGE for your group. The doctrinal framing below is intentionally a
// placeholder for you to write in your own words. Nothing here is prescribed.

export default function About() {
  return (
    <div className="prose-scripture max-w-none space-y-6">
      <h1 className="font-serif text-2xl font-semibold">{config.groupName}</h1>

      <section>
        <h2 className="font-serif text-lg font-semibold">Our purpose</h2>
        <p className="text-sm leading-7 text-stone-700">
          We gather to read the Scriptures carefully, understand them in their original context,
          and let them shape how we live. This is a space for honest discussion, prayer, and
          accountability.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold">How we study</h2>
        <p className="text-sm leading-7 text-stone-700">
          Each passage we work through follows a simple rhythm:
        </p>
        <ul className="ml-5 list-disc text-sm leading-7 text-stone-700">
          <li>
            <strong>Observation</strong> — What does the text actually say? Note the words, people,
            and flow before interpreting.
          </li>
          <li>
            <strong>Interpretation</strong> — What did the author mean? Use context, the original
            language, and trusted commentary.
          </li>
          <li>
            <strong>Application</strong> — How should this change our hearts, minds, and actions
            this week?
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold">Statement of faith</h2>
        <p className="text-sm leading-7 text-stone-700">
          (Write your group's statement of faith here. Edit
          <span className="font-mono"> src/pages/About.tsx</span>.)
        </p>
      </section>

      <section className="rounded-lg bg-stone-100 p-4 text-xs text-stone-500">
        Scripture text is provided by the public-domain Free Use Bible API. Original-language and
        Strong's data are public domain. Commentaries are public domain and reflect their authors'
        own views.
      </section>
    </div>
  );
}
