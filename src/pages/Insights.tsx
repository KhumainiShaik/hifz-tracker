import { BookOpen, Flame, TrendingUp, CalendarCheck } from "lucide-react";
import { useData, useToday } from "../lib/hooks";
import { analytics, goalProgress } from "../lib/analytics";
import { revisionQueue } from "../lib/scheduling";
import { rangeLabel, SURAHS } from "../lib/quran";
import { Card, PageHeading, Progress, Empty } from "../components/ui";
import { JuzGrid, ActivityList } from "../components/ProgressViews";
export function Insights() {
  const { data, settings } = useData();
  const today = useToday(settings.timeZone);
  const a = analytics(data.memorizedRanges, data.revisionSessions, today);
  const practice = revisionQueue(
    data.memorizedRanges,
    data.revisionSessions,
    data.revisionSchedules,
    settings.intervals,
    today,
  ).filter((q) => q.quality === "needs-practice");
  const recent = [...data.memorizedRanges].sort((x, y) =>
    y.date.localeCompare(x.date),
  );
  const surahs = [...new Set(recent.map((m) => m.surah))].slice(0, 5);
  const max = Math.max(1, ...a.weekly.map((d) => d.newAyahs));
  return (
    <>
      <PageHeading
        eyebrow="SEE THE SMALL STEPS ADD UP"
        title="A journey in perspective"
        description="Real progress, thoughtful reflection. Every number comes from your saved sessions."
      />
      <div className="stats-grid">
        {[
          {
            label: "Unique memorized ayahs",
            value: a.unique,
            note: `${a.percent.toFixed(1)}% of the Quran`,
            icon: BookOpen,
          },
          {
            label: "This month",
            value: `+${a.monthNew}`,
            note: `${a.monthChange >= 0 ? "+" : ""}${a.monthChange} vs. previous full month`,
            icon: TrendingUp,
          },
          {
            label: "Longest streak",
            value: `${a.streak.longest} days`,
            note: `${a.streak.current} days in your current streak`,
            icon: Flame,
          },
          {
            label: "Revision consistency",
            value: `${a.revisionConsistency} / 28`,
            note: "Days with revision in the last 28 days",
            icon: CalendarCheck,
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
            <h2>Seven days of growth</h2>
            <span className="pill">{a.weekNew} new ayahs</span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`New unique ayahs in the last seven days: ${a.weekly.map((d) => `${d.date}: ${d.newAyahs}`).join(", ")}`}
          >
            {a.weekly.map((d) => (
              <div className="bar-column" key={d.date}>
                <span>{d.newAyahs}</span>
                <div className="bar-track">
                  <div style={{ height: `${(d.newAyahs / max) * 100}%` }} />
                </div>
                <small>
                  {new Intl.DateTimeFormat("en", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${d.date}T12:00:00Z`))}
                </small>
              </div>
            ))}
          </div>
          <p className="muted compact">
            Newly covered ayahs, excluding overlap with earlier records.
          </p>
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Show up, one day at a time</h2>
            <span className="pill">12 weeks</span>
          </div>
          <div
            className="activity-calendar"
            role="img"
            aria-label={`Activity calendar, ${a.calendar.filter((d) => d.count).length} active days in the last 84 days`}
          >
            {a.calendar.map((d) => (
              <div
                key={d.date}
                className={`calendar-day level-${Math.min(d.count, 3)}`}
                tabIndex={0}
                title={`${d.date}: ${d.count} sessions`}
                aria-label={`${d.date}: ${d.count} sessions`}
              />
            ))}
          </div>
          <div className="calendar-labels">
            <small>{a.calendar[0].date}</small>
            <span className="legend">
              Less <i />
              <i className="partial" />
              <i className="complete" /> More
            </span>
            <small>{today}</small>
          </div>
          <p className="muted compact">
            Memorization and revision activity · {settings.timeZone}
          </p>
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Thirty Juz, one journey</h2>
            <span className="pill">{a.completeJuz} complete</span>
          </div>
          <JuzGrid memories={data.memorizedRanges} />
          <div className="juz-detail-list">
            {a.juz
              .filter((j) => j.memorized > 0)
              .map((j) => (
                <div key={j.number}>
                  <span>Juz {j.number}</span>
                  <Progress
                    value={j.percent}
                    label={`Juz ${j.number} coverage`}
                  />
                  <small>
                    {j.memorized}/{j.total}
                  </small>
                </div>
              ))}
          </div>
          {!a.unique && (
            <p className="muted compact">
              Your Juz coverage will grow with your saved memorization.
            </p>
          )}
        </Card>
        <Card>
          <h2>A little extra attention</h2>
          {practice.length ? (
            <div className="practice-list">
              {practice.map((q) => (
                <div key={q.memory.id}>
                  <strong>{rangeLabel(q.memory)}</strong>
                  <span className="pill warning">Needs practice</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Room to reflect">
              Ranges marked “Needs practice” will appear here to help focus your
              next revision.
            </Empty>
          )}
        </Card>
        <Card>
          <h2>Today’s goals</h2>
          <div className="insight-goal">
            <span>
              Memorization · {a.todayAyahs}/{settings.dailyGoal} new ayahs
            </span>
            <Progress
              value={goalProgress(a.todayAyahs, settings.dailyGoal)}
              label="Memorization goal completion"
            />
          </div>
          <div className="insight-goal">
            <span>
              Revision · {a.todayRevisions}/{settings.revisionGoal} sessions
            </span>
            <Progress
              value={goalProgress(a.todayRevisions, settings.revisionGoal)}
              label="Revision goal completion"
            />
          </div>
          <h3>Most recently memorized</h3>
          <p className="muted">
            {surahs.length
              ? surahs.map((s) => SURAHS[s - 1].name).join(" · ")
              : "Your recent Surahs will appear after your first session."}
          </p>
          <p className="muted compact">
            Previous month: {a.previousNew} new ayahs. Current month to date:{" "}
            {a.monthNew}.
          </p>
        </Card>
        <Card>
          <h2>Activity, remembered</h2>
          <ActivityList
            memories={data.memorizedRanges}
            revisions={data.revisionSessions}
          />
        </Card>
      </div>
      <p className="date-note">
        Activity counts saved sessions. Unique progress counts the union of
        memorized ranges. Editing or deleting a record recalculates historical
        totals.
      </p>
    </>
  );
}
