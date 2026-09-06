# Entity Relationship Diagram

Source of truth: `apps/api/prisma/schema.prisma`. Render this Mermaid diagram at https://mermaid.live (export as PNG/SVG for the submission folder).

```mermaid
erDiagram
    User ||--o{ Report : "writes"
    User ||--o{ ReviewHistory : "reviews as manager"
    User ||--o{ ProjectMember : "assigned to"
    User ||--o{ ActivityLog : "acts"
    Project ||--o{ Report : "tags"
    Project ||--o{ ProjectMember : "has"
    Report ||--o{ ReportTask : "tasks completed"
    Report ||--o{ Blocker : "blockers"
    Report ||--o{ Achievement : "achievements"
    Report ||--o{ HoursEntry : "hours by category"
    Report ||--o{ ReportVersion : "immutable snapshot per submission"
    Report ||--o{ ReviewHistory : "decisions"
    Report ||--o{ ActivityLog : "events"
    ReportVersion ||--o{ ReviewHistory : "reviewed version"

    User {
        string id PK
        string name
        string email UK
        string passwordHash
        enum role "TEAM_MEMBER | MANAGER | ADMIN"
        string jobTitle
        boolean active
        datetime createdAt
    }
    Project {
        string id PK
        string name UK
        string description
        boolean active "false = archived"
    }
    ProjectMember {
        string userId PK,FK
        string projectId PK,FK
        datetime assignedAt
    }
    Report {
        string id PK
        string userId FK
        string projectId FK
        date weekStart "Monday - unique per user"
        date weekEnd
        enum status "DRAFT | SUBMITTED | NEEDS_CORRECTION | APPROVED"
        string nextWeekPlan
        string notes
        string links
        int currentVersion
        string latestReviewComment
        datetime firstSubmittedAt
        datetime submittedAt
        datetime reviewedAt
    }
    ReportTask {
        string id PK
        string reportId FK
        int sortOrder
        string name
        enum priority "LOW | MEDIUM | HIGH | CRITICAL"
        enum status "NOT_STARTED | IN_PROGRESS | COMPLETED | BLOCKED"
        int plannedPercent
        int actualPercent
        float plannedHours
        float actualHours
        string output
    }
    Blocker {
        string id PK
        string reportId FK
        string description
        boolean isKey "key issue of the week"
    }
    Achievement {
        string id PK
        string reportId FK
        string description
        boolean isKey "key achievement"
    }
    HoursEntry {
        string id PK
        string reportId FK
        enum category "DEVELOPMENT | TESTING | MEETINGS | DOCUMENTATION | DESIGN | SUPPORT | OTHER"
        float hours
    }
    ReportVersion {
        string id PK
        string reportId FK
        int versionNumber "unique per report"
        datetime submittedAt
        json snapshot "full content at submission"
    }
    ReviewHistory {
        string id PK
        string reportId FK
        string versionId FK
        string reviewerId FK
        enum action "APPROVED | CHANGES_REQUESTED"
        string comment
        datetime createdAt
    }
    ActivityLog {
        string id PK
        enum type
        string actorId FK
        string reportId FK
        json details
        datetime createdAt
    }
```

## Design notes

- **One report per member per week** is enforced by the unique index on `(userId, weekStart)`; `weekStart` is always a Monday stored as a date-only column.
- **Fixed structure**: the sections are child tables with fixed columns (`ReportTask`, `Blocker`, `Achievement`, `HoursEntry`), not free-form JSON, so every report is comparable on the dashboard.
- **Version history**: submitting creates a `ReportVersion` row holding a JSON snapshot of the member-authored content. The live `Report` row is what the member edits; snapshots are never modified.
- **Review history**: each `ReviewHistory` row references the `ReportVersion` it was made against, which is how the UI shows "changes requested on version 1, approved on version 2". `Report.latestReviewComment` is a denormalised convenience copy.
- **Soft deletes**: users are deactivated, projects with reports are archived (`active = false`), so history is never lost. Deleting a `Report` cascades to its children.
- **Activity feed**: `ActivityLog` records submissions, review decisions and admin actions for the dashboard feed.
