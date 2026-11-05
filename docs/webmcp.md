# WebMCP

The pages offer two tools to an AI agent working in the visitor's browser, through
WebMCP: `document.modelContext.registerTool()`, a draft of the W3C Web Machine
Learning Community Group ([spec](https://webmachinelearning.github.io/webmcp/),
[Chrome docs](https://developer.chrome.com/docs/ai/webmcp)). An agent asks the page
instead of reading and clicking through it. Where the browser has no model context,
nothing happens: each page loads a module of about 0.6 kB (gzip) that checks for
`document.modelContext`, and only then fetches the rest (`import('@lib/webmcp')`).

## Tools

| Tool                     | Where                           | What it does                                                                                                                       |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `list-events`            | every page                      | Reads `/api/public/events` and answers with the upcoming evenings: date, time, place, contribution, seats, the page to register on |
| `fill-registration-form` | an event page, while it is open | Fills first name, last name, email and an optional mobile number into the registration form                                        |

`list-events` carries `readOnlyHint: true`. It answers from the same public view the
pages render (`readPublicEvents()`, route-cached, purged with every change); never
addresses or participant data.

The registration tool only fills the form in, as if typed, then scrolls it into view
and waits at the privacy consent. **The person agrees to the privacy policy and
submits the form themselves**: no agent gives consent in someone's name or signs
anyone up, and the honeypot (`website`) is never part of the tool. It is registered
only while its form is shown (not for a past evening, gone after the registration)
and names the evening in its description; for a full evening it speaks of the
waiting list.

These two answer what a visitor comes for: when and where the next evening is, and a
seat at it. The other forms get no tool. The testimonial form is for a participant's
own words, and an agent should not write them; the notification form is one field an
agent fills as easily by typing. A tool belongs where it saves the person a real step
and leaves every decision with them.

## Rules for tools

- One file holds the plumbing: `src/lib/webmcp.ts` (`provideTool()`, `formTool()`,
  `readInput()`, `eventsText()`). A tool is registered where its subject is: the
  global one in `components/WebMcp.astro`, the registration form's in its island. Scripts import it only behind `'modelContext' in document`. `provideTool()`
  returns the function that unregisters it (an `AbortSignal`, as the spec has it).
- Names are verbs for what happens (`list-…`, `fill-…`), titles German (shown to the
  person), descriptions English for the model: what the tool does and when to use it,
  within about 500 characters.
- Answers are short German text the agent can pass on. Problems go back as text too
  ("Nichts ausgefüllt. Bitte korrigieren: …"), never as a thrown error: a browser
  reports a thrown message only as "invocation failed", and the agent needs the words
  to correct its input. Validate strictly in code, loosely in the schema.
- Nothing with a side effect runs on an agent's word. Should a tool ever act (submit,
  book, delete), it needs `consequentialHint: true` and the person's confirmation.
- The declarative form attributes (`toolname`, `tooldescription`) are not used: they
  are not part of the spec, they would turn every named control into a parameter
  (the honeypot and the consent included), and they would overlap with the tools above.

## Turning it on

- **Chrome (from 149) needs an origin-trial token** for the site's origin: register at
  the [Chrome origin trials console](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241)
  for `https://mens-circle.de` and set it as the build variable
  `PUBLIC_WEBMCP_ORIGIN_TRIAL`; `WebMcp.astro` then writes
  `<meta http-equiv="origin-trial">`. A token expires; Chrome mails a renewal link.
  Edge runs its own trial from 150.
- **Locally:** `chrome://flags/#enable-webmcp-testing`, or start Chromium with
  `--enable-features=WebMCPTesting` (Playwright too). The _Model Context Tool
  Inspector_ extension lists and runs the page's tools.
- **Checking a change:** in that browser, `await document.modelContext.getTools()`
  lists the tools; `document.modelContext.executeTool(tool, input)` runs one (Chromium
  before 155 takes the input as a JSON string). `tests/webmcp.test.ts` covers the texts
  and the input checks; `bun run test:pages` checks the list endpoint.
