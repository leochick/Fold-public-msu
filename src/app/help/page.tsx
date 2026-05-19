import Link from "next/link";

export const dynamic = "force-static";

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Help & FAQ</h1>
        <p className="text-sm text-black/60 mt-1">
          How Fold works, what each page does, and what to do when something looks weird.
        </p>
      </header>

      <nav className="card text-sm">
        <div className="label mb-2">On this page</div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          <li><a href="#big-picture" className="hover:underline">The big picture</a></li>
          <li><a href="#quick-start" className="hover:underline">Quick start</a></li>
          <li><a href="#dashboard" className="hover:underline">Dashboard</a></li>
          <li><a href="#events" className="hover:underline">Events & attendance</a></li>
          <li><a href="#students" className="hover:underline">Students</a></li>
          <li><a href="#intake" className="hover:underline">Smart Intake</a></li>
          <li><a href="#funnel" className="hover:underline">Engagement Funnel</a></li>
          <li><a href="#rides" className="hover:underline">Rides & carpools</a></li>
          <li><a href="#ask" className="hover:underline">Ask (NL queries)</a></li>
          <li><a href="#insights" className="hover:underline">AI Insights</a></li>
          <li><a href="#modify" className="hover:underline">Modify (bulk edits)</a></li>
          <li><a href="#account" className="hover:underline">Your account</a></li>
          <li><a href="#faq" className="hover:underline">FAQ</a></li>
        </ul>
      </nav>

      <Section id="big-picture" title="The big picture">
        <p>
          Fold tracks three things and the connections between them:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Students</strong> — the people you want to follow up with.</li>
          <li><strong>Events</strong> — anything you take attendance at (weekly meeting, social, retreat).</li>
          <li><strong>Attendance</strong> — who showed up to what, and who invited whom.</li>
        </ul>
        <p>
          Almost every feature in Fold is a different way of slicing those three things: who&apos;s
          gone cold, who&apos;s actually growing your group through invites, who should be in
          which carpool.
        </p>
      </Section>

      <Section id="quick-start" title="Quick start">
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Add a few students manually under{" "}
            <Link href="/students" className="underline">Students</Link>, or paste a roster into{" "}
            <Link href="/intake" className="underline">Smart Intake</Link> and let AI extract them.
          </li>
          <li>
            Create your first event on the{" "}
            <Link href="/events" className="underline">Events</Link> page.
          </li>
          <li>Open the event and use the quick-add form to mark people present.</li>
          <li>
            After 3+ events, the{" "}
            <Link href="/" className="underline">Dashboard</Link> charts and AI Insights start to
            be useful.
          </li>
        </ol>
      </Section>

      <Section id="dashboard" title="Dashboard">
        <p>
          The home page is a 30-day snapshot: how many events you hosted, total check-ins, unique
          attendees, and brand-new students. The charts show attendance trends, the engagement
          funnel by stage, and demographic breakdowns.
        </p>
        <p className="text-xs text-black/60">
          If a chart looks empty, you usually just need more data — most aggregates need 3+
          events to mean anything.
        </p>
      </Section>

      <Section id="events" title="Events & attendance">
        <p>
          From <Link href="/events" className="underline">Events</Link> you can create a new
          event and mark attendance. Inside an event, you&apos;ll see:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Quick-add form</strong> — type a name, pick from the roster, add new students inline.</li>
          <li><strong>First-timers vs returners</strong> — how the night skewed.</li>
          <li><strong>Invite chains</strong> — who was brought by whom, when you captured that in intake.</li>
          <li><strong>Gender split</strong> — useful for ride-coordination rules.</li>
        </ul>
        <p>
          You can also paste a long attendance list and let AI parse it — see{" "}
          <a href="#intake" className="underline">Smart Intake</a>.
        </p>
      </Section>

      <Section id="students" title="Students">
        <p>
          The <Link href="/students" className="underline">Students</Link> page is the full
          roster with health metrics per person:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>How often they attend.</li>
          <li>Who originally invited them.</li>
          <li>Who they&apos;ve brought in turn.</li>
          <li>How many contact attempts have been logged.</li>
        </ul>
        <p>
          The <strong>Gone Cold</strong> tab surfaces students who haven&apos;t shown up in
          30+ days. Click a student to see their profile, log a contact attempt, or draft an
          outreach message.
        </p>
      </Section>

      <Section id="intake" title="Smart Intake — pasting messy text">
        <p>
          <Link href="/intake" className="underline">Intake</Link> takes whatever weird format
          you collected names in — a group chat dump, a Google Form export, scribbled phone
          notes — and turns it into structured student records. Claude does the parsing.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>It matches against your existing roster first to avoid duplicates.</li>
          <li>You always get a preview screen before anything is saved.</li>
          <li>You can edit each row in the preview before clicking commit.</li>
          <li>Phrases like &quot;brought by Joe&quot; or &quot;Sarah&apos;s friend&quot; capture invite chains automatically.</li>
        </ul>
      </Section>

      <Section id="funnel" title="Engagement Funnel">
        <p>
          The <Link href="/funnel" className="underline">Funnel</Link> tracks students across
          stages from <em>new</em> → <em>contacted</em> → <em>engaged</em>. An automated nightly
          sweep moves students between stages based on activity (attendance, contact attempts,
          time since last seen).
        </p>
        <p>
          Use the filter chips to find students who are stuck — stale responses, missing contact
          attempts, no recent activity. The funnel is the most useful page for &quot;who do I
          need to text this week.&quot;
        </p>
      </Section>

      <Section id="rides" title="Rides & carpools">
        <p className="text-black/80">
          Rides is the page most people get confused on, so here&apos;s the model:
        </p>
        <div className="space-y-2">
          <p>
            <strong>An event has one or more ride sessions.</strong> A session is a single trip
            in a single direction — e.g., &quot;There&quot; (to the event), &quot;Back&quot;
            (after), &quot;Sunday morning&quot; (a different trip the next day). One Friday
            event might have 3 ride sessions.
          </p>
          <p>
            <strong>Each session has its own vehicles, riders, and assignments.</strong> You
            pick which drivers/vehicles are available for that specific trip, who needs a ride,
            and the solver suggests seat assignments respecting capacity and any rules you set.
          </p>
          <p>
            <strong>Vehicles live at the org level.</strong> Add them once on{" "}
            <Link href="/vehicles" className="underline">Vehicles</Link> (make, model, seat
            count) and reuse them across every session. The driver is whoever is sitting in seat
            1 — you assign that per session.
          </p>
        </div>

        <h3 className="text-sm font-semibold mt-3">Workflow</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Go to <Link href="/rides" className="underline">Rides</Link> or open a specific event.</li>
          <li>Create a session for the trip you&apos;re planning (&quot;There&quot;, &quot;Back&quot;, etc.).</li>
          <li>Pick which vehicles are in play, and assign a driver to each.</li>
          <li>Paste or pick the list of riders.</li>
          <li>Hit <em>preview assignments</em> and let the solver lay it out — then adjust by hand and commit.</li>
        </ol>

        <h3 className="text-sm font-semibold mt-3">The same-gender ride rule</h3>
        <p>
          Each session has an <em>enforce rule</em> toggle. When on, the solver avoids
          assignments where the driver is alone in the car with a single passenger of the
          opposite gender. Turn it off if your group doesn&apos;t care about that. The toggle
          only affects the solver&apos;s suggestions; you can always override by hand.
        </p>
        <p className="text-xs text-black/60">
          The solver also flags warnings (over-capacity, unassigned riders) on the preview
          screen — read them before you commit.
        </p>
      </Section>

      <Section id="ask" title="Ask — natural-language queries">
        <p>
          <Link href="/query" className="underline">Ask</Link> lets you type questions in plain
          English and get a table of students back. Examples:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>&quot;who came to the last 3 events but not this week&quot;</li>
          <li>&quot;all freshmen who were invited by someone&quot;</li>
          <li>&quot;female members who haven&apos;t been contacted via IG&quot;</li>
        </ul>
        <p className="text-xs text-black/60">
          Under the hood, Claude turns your question into a structured filter and the server
          runs it as safe parameterized SQL. If a result looks wrong, try rephrasing — the
          filter Claude built is shown above the table so you can see how it interpreted you.
        </p>
      </Section>

      <Section id="insights" title="AI Insights">
        <p>
          On the Dashboard and on individual event pages, the <em>Insights</em> panel asks
          Claude to look at the numbers and propose 3-5 short hypotheses for what drove
          attendance — &quot;events with food averaged 14 vs 6 without,&quot; that kind of
          thing.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Needs at least 3 events worth of data — otherwise it&apos;ll say so and skip.</li>
          <li>Cites bucket sizes so you can see when the signal is weak.</li>
          <li>Hit <em>regenerate</em> to ask again; results vary slightly each time.</li>
        </ul>
        <p className="text-xs text-black/60">
          The food / on-campus / month flags are heuristic regex inferences on event names, not
          hard data. Treat Insights as starting hypotheses, not conclusions.
        </p>
      </Section>

      <Section id="modify" title="Modify — bulk edits in plain English">
        <p>
          <Link href="/modify" className="underline">Modify</Link> lets you describe a batch of
          edits in one shot — &quot;mark Sarah Lee a member, change Joe&apos;s phone to 555…,
          delete the duplicate David entry.&quot; Claude builds a list of proposed updates and
          you approve them on a preview screen before any change is saved.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ambiguous names (multiple matches, or no match) are flagged for you to resolve.</li>
          <li><em>Delete</em> permanently removes a student and their attendance history — be careful.</li>
          <li><em>Mark inactive</em> is the gentler option: keeps the record, hides them from active views.</li>
        </ul>
      </Section>

      <Section id="account" title="Your account">
        <p>
          Fold uses per-person email and password accounts. Each advisor signs up at{" "}
          <Link href="/signup" className="underline">/signup</Link> with their own email. There
          is no shared org login.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sessions last 30 days; you&apos;ll re-sign-in after that.</li>
          <li>If signups are locked to a domain, ask whoever set up your instance to add your email.</li>
          <li>Forgot password? There&apos;s no self-serve reset yet — message your admin to reset it from the database.</li>
        </ul>
      </Section>

      <section id="faq" className="space-y-3">
        <h2 className="text-lg font-semibold">FAQ</h2>

        <Faq q="A student I just added isn't showing up in Gone Cold — why?">
          Gone Cold only includes students with at least one attendance record that&apos;s
          30+ days old. Brand-new students with no attendance yet are still in the regular
          roster.
        </Faq>

        <Faq q="The Insights panel says 'not enough events for insights'.">
          You need 3 or more events in the aggregate window. Add more events (or wait for them
          to happen) and the panel will start working.
        </Faq>

        <Faq q="Are the AI Insights on the public demo real?">
          No — on the public demo site, Insights are illustrative samples generated locally so
          random visitors can&apos;t burn API tokens on the maintainer&apos;s key. To get real
          AI-generated insights tailored to your own attendance data, fork the repo, add your
          own Anthropic API key, and self-host. See the README for setup.
        </Faq>

        <Faq q="Why did Smart Intake add someone as new when they're already in my roster?">
          The fuzzy match was too uncertain to call it the same person — usually a nickname or
          a misspelling. You can fix it on the preview screen before committing, or use{" "}
          <Link href="/modify" className="underline">Modify</Link> later to merge the duplicate.
        </Faq>

        <Faq q="Can I undo a commit?">
          No global undo — but most pages let you delete or edit individual records. For a bad
          bulk intake, the fastest fix is usually Modify with a description like &quot;delete
          all students added today named X, Y, Z.&quot;
        </Faq>

        <Faq q="What's the difference between prospect, member, and core?">
          Free-form labels with these defaults: <em>prospect</em> for someone who&apos;s shown
          up but isn&apos;t committed, <em>member</em> for someone who attends regularly,{" "}
          <em>core</em> for the advisor team and the people you lean on to bring others. Use whatever
          rubric your group prefers — Fold doesn&apos;t enforce anything on these.
        </Faq>

        <Faq q="Why did the ride solver leave someone unassigned?">
          Capacity ran out, or every remaining vehicle would have violated the same-gender
          rule. Check the warnings under the preview — they explain which constraint blocked
          it. You can always override by hand.
        </Faq>

        <Faq q="My natural-language query returned empty results.">
          Claude probably built a filter that&apos;s too narrow. The applied filter is shown
          above the results — read it and rephrase your question. &quot;who came last week&quot;
          works better than &quot;recent attenders.&quot;
        </Faq>

        <Faq q="Can two advisors be logged in at the same time on the same account?">
          Yes — sessions are per cookie, not per device, and there&apos;s no exclusive lock. But
          we recommend each advisor sign up with their own email so feedback, contact attempts,
          and edits are attributed correctly.
        </Faq>

        <Faq q="Where does my data live?">
          In a Turso (hosted SQLite) database tied to your deployment. Your Anthropic API key is
          stored as a Vercel environment variable. Nothing is shared with any other Fold
          instance.
        </Faq>
      </section>

      <section className="card text-sm">
        <p className="font-medium">Still stuck?</p>
        <p className="mt-1">
          Drop a note on the{" "}
          <Link href="/feedback" className="underline">questions & feedback</Link> page — other
          advisors can see and respond to it, and the maintainer reads everything.
        </p>
      </section>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm space-y-2">{children}</div>
    </section>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-md border border-black/10 dark:border-white/10 p-3 text-sm group">
      <summary className="font-medium cursor-pointer list-none flex items-start gap-2">
        <span className="text-black/40 group-open:rotate-90 transition-transform">›</span>
        <span>{q}</span>
      </summary>
      <div className="mt-2 pl-5 text-black/70 dark:text-white/70">{children}</div>
    </details>
  );
}
