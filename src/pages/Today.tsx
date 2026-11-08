import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Flame,
  Layers3,
  Plus,
  RotateCcw,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, useData, useToday } from "../lib/hooks";
import { analytics, goalProgress } from "../lib/analytics";
import { revisionQueue } from "../lib/scheduling";
import { islamicDate, prettyDate } from "../lib/dates";
import { rangeLabel } from "../lib/quran";
import {
  Card,
  Empty,
  PageHeading,
  Progress,
  SectionLink,
} from "../components/ui";
import { SessionForm } from "../components/SessionForm";
import { ActivityList, JuzGrid } from "../components/ProgressViews";
export function Today() {
  const { role } = useAuth();
  const { data, settings } = useData();
  const today = useToday(settings.timeZone);
  const stats = analytics(data.memorizedRanges, data.revisionSessions, today);
  const due = revisionQueue(
    data.memorizedRanges,
    data.revisionSessions,
    data.revisionSchedules,
    settings.intervals,
    today,
  ).filter((q) => q.due <= today);
  const [form, setForm] = useState<"memory" | "revision" | null>(null);
  const hijri = islamicDate(new Date(), settings.timeZone);
  return (
    <>
      <PageHeading
        eyebrow={
          role === "owner"
            ? "YOUR DAILY MOMENT WITH THE QURAN"
            : "FOLLOWING A MEANINGFUL JOURNEY"
        }
        title={
          role === "owner"
            ? "Assalamu alaikum, Abdul."
            : "A window into Abdul’s journey."
        }
        description={`${prettyDate(today)}${hijri ? ` · ${hijri}` : ""}`}
        action={
          role === "owner" ? (
            <button className="button" onClick={() => setForm("memory")}>
              <Plus size={18} />
              Add memorization
            </button>
          ) : (
            <span className="pill">Invited viewer · read only</span>
          )
        }
      />
      <section className="journey-hero">
        <div className="hero-copy">
          <span className="hero-kicker">INTENTION. CONSISTENCY. GROWTH.</span>
          <h2>
            Every ayah brings
            <br />
            you a little closer.
          </h2>
          <p>
            {stats.unique
              ? "Keep returning, keep growing. Your quiet effort is adding up."
              : "Begin where you are. Your first memorized ayah is the start of something lasting."}
          </p>
          <h3 className="hero-title">Abdul Khumaini Shaik’s Hifz Tracker</h3>
        </div>
        <div className="hero-progress">
          <div
            className="progress-ring"
            style={{
              background: `conic-gradient(#dbc78e ${stats.percent}%,rgba(255,255,255,.13) 0)`,
            }}
          >
            <div>
              <span>
                {stats.percent.toFixed(1)}
                <small>%</small>
              </span>
              <p>of the Quran</p>
            </div>
          </div>
          <span>{stats.unique.toLocaleString()} of 6,236 ayahs</span>
        </div>
        <div className="hero-geometry" aria-hidden="true" />
      </section>
      <div className="stats-grid">
        {[
          {
            icon: BookOpen,
            label:
              settings.unit === "juz" ? "Juz completed" : "Ayahs memorized",
            value:
              settings.unit === "juz"
                ? `${stats.completeJuz} / 30`
                : stats.unique.toLocaleString(),
            note:
              settings.unit === "juz"
                ? "Verified full Juz coverage"
                : "Unique ayahs, every one counted",
          },
          {
            icon: Layers3,
            label:
              settings.unit === "juz" ? "Ayahs memorized" : "Juz completed",
            value:
              settings.unit === "juz"
                ? stats.unique.toLocaleString()
                : `${stats.completeJuz} / 30`,
            note:
              settings.unit === "juz"
                ? "Unique ayahs, every one counted"
                : "Verified full Juz coverage",
          },
          {
            icon: Flame,
            label: "Current streak",
            value: `${stats.streak.current} ${stats.streak.current === 1 ? "day" : "days"}`,
            note: `Personal best: ${stats.streak.longest} days`,
          },
          {
            icon: CheckCircle2,
            label: "Sessions today",
            value: stats.todaySessions,
            note: `${stats.todayRevisions} revision sessions`,
          },
        ].map((s) => (
          <Card className="stat-card" key={s.label}>
            <div>
              <span className="stat-label">{s.label}</span>
              <s.icon size={19} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </Card>
        ))}
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="section-heading">
            <h2>
              <Target size={19} /> Today’s intention
            </h2>
            <span className="pill">Keep it steady</span>
          </div>
          <div className="goal-row">
            <span className="activity-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <div className="goal-title">
                <strong>New memorization</strong>
                <span>
                  {stats.todayAyahs} <small>/ {settings.dailyGoal} ayahs</small>
                </span>
              </div>
              <Progress
                value={goalProgress(stats.todayAyahs, settings.dailyGoal)}
                label="Today's memorization goal"
              />
              <small>Newly covered ayahs today</small>
            </div>
          </div>
          <div className="goal-row">
            <span className="activity-icon gold">
              <RotateCcw size={20} />
            </span>
            <div>
              <div className="goal-title">
                <strong>Daily revision</strong>
                <span>
                  {stats.todayRevisions}{" "}
                  <small>/ {settings.revisionGoal} sessions</small>
                </span>
              </div>
              <Progress
                value={goalProgress(
                  stats.todayRevisions,
                  settings.revisionGoal,
                )}
                label="Today's revision goal"
              />
              <small>Strengthen what you’ve learned</small>
            </div>
          </div>
          {role === "owner" && (
            <div className="quick-actions">
              <button
                className="button secondary"
                onClick={() => setForm("memory")}
              >
                <Plus size={16} />
                Add memorization
              </button>
              <button
                className="button secondary"
                onClick={() => setForm("revision")}
              >
                <RotateCcw size={16} />
                Log revision
              </button>
            </div>
          )}
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Ready to revisit</h2>
            <SectionLink to="/revision">Revision</SectionLink>
          </div>
          {due.length ? (
            <>
              <p className="muted compact">
                {due.length} ranges due · {due.filter((q) => q.overdue).length}{" "}
                overdue
              </p>
              <div className="due-preview">
                {due.slice(0, 3).map((q) => (
                  <Link key={q.memory.id} to="/revision" className="due-row">
                    <span>
                      <strong>{rangeLabel(q.memory)}</strong>
                      <small>
                        {q.category} · {q.memory.end - q.memory.start + 1} ayahs
                      </small>
                    </span>
                    <span className={`pill ${q.overdue ? "warning" : ""}`}>
                      {q.overdue ? "Overdue" : "Today"}
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <Empty
              title={
                data.memorizedRanges.length
                  ? "A little breathing room"
                  : "Build a rhythm"
              }
            >
              {data.memorizedRanges.length
                ? "You’re up to date. Your next revisions will appear here when they’re due."
                : "Save your first memorized range and its revision schedule will begin automatically."}
            </Empty>
          )}
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Recent moments</h2>
            <SectionLink to="/insights">All activity</SectionLink>
          </div>
          <ActivityList
            memories={data.memorizedRanges}
            revisions={data.revisionSessions}
            limit={4}
          />
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Your Quran, at a glance</h2>
            <SectionLink to="/hifz">Explore</SectionLink>
          </div>
          <p className="muted compact">
            Thirty Juz. A journey made one ayah at a time.
          </p>
          <JuzGrid memories={data.memorizedRanges} />
          <div className="legend">
            <span>
              <i />
              Not started
            </span>
            <span>
              <i className="partial" />
              In progress
            </span>
            <span>
              <i className="complete" />
              Complete
            </span>
          </div>
        </Card>
      </div>
      {hijri && (
        <p className="date-note">
          Islamic date uses the browser’s Umm al-Qura calendar; local
          moon-sighting dates may differ.
        </p>
      )}
      {form && <SessionForm kind={form} onClose={() => setForm(null)} />}
    </>
  );
}
