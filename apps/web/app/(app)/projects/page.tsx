'use client';

import { Role, type Project } from '@weekly-report/shared';
import { useState } from 'react';
import { RequireRole } from '@/components/layout/require-role';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { errorMessage } from '@/lib/api-client';
import { useProjectMutations, useProjects } from '@/lib/hooks/use-projects';
import { useUsers } from '@/lib/hooks/use-users';
import { issuesToMap, projectSchema } from '@/lib/validation';

/** Project / category management page with full CRUD and member assignment. */
export default function ProjectsPage() {
  return (
    <RequireRole roles={[Role.MANAGER, Role.ADMIN]}>
      <Projects />
    </RequireRole>
  );
}

const emptyForm = { name: '', description: '', memberIds: [] as string[] };

function Projects() {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const projects = useProjects(showArchived);
  const members = useUsers({ role: Role.TEAM_MEMBER });
  const { create, update, remove } = useProjectMutations();
  const saving = create.isPending || update.isPending;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm({ name: project.name, description: project.description ?? '', memberIds: project.members.map((m) => m.id) });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = projectSchema.safeParse({ name: form.name, description: form.description });
    if (!parsed.success) return setErrors(issuesToMap(parsed.error));
    setErrors({});
    setFormError(null);
    const input = { name: parsed.data.name, description: parsed.data.description, memberIds: form.memberIds };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
        setNotice(`Project "${input.name}" updated.`);
      } else {
        await create.mutateAsync(input);
        setNotice(`Project "${input.name}" created.`);
      }
      setFormOpen(false);
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }

  const toggleMember = (id: string) =>
    setForm((prev) => ({ ...prev, memberIds: prev.memberIds.includes(id) ? prev.memberIds.filter((m) => m !== id) : [...prev.memberIds, id] }));

  return (
    <div>
      <PageHeader
        title="Projects and categories"
        description="Every report is tagged with one project. Projects with reports are archived rather than deleted so history stays intact."
        actions={<Button onClick={openCreate}>+ New project</Button>}
      />

      {notice && <Alert tone="success" className="mb-4" actions={<Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice}</Alert>}

      {formOpen && (
        <Card title={editing ? `Edit "${editing.name}"` : 'New project'} className="mb-6">
          <form onSubmit={save} className="space-y-4" noValidate>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" htmlFor="name" error={errors.name} required>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name} placeholder="e.g. Client A - Mobile App" />
              </Field>
              <Field label="Description" htmlFor="description" error={errors.description}>
                <Textarea id="description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <Field label="Assigned team members" hint="Optional. Helps the team pick the right project when reporting.">
              {members.isLoading ? (
                <LoadingBlock />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {members.data?.map((member) => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                      <Checkbox checked={form.memberIds.includes(member.id)} onChange={() => toggleMember(member.id)} />
                      <span className="text-slate-800">{member.name}</span>
                      <span className="ml-auto truncate text-xs text-slate-400">{member.jobTitle}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
            {editing && !editing.active && <Alert tone="info">This project is archived. Saving keeps it archived; use &quot;Restore&quot; in the list to make it selectable again.</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Create project'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="All projects"
        flush
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
        }
      >
        {projects.isLoading ? (
          <LoadingBlock />
        ) : projects.isError ? (
          <div className="p-5"><ErrorBlock message={errorMessage(projects.error)} onRetry={() => projects.refetch()} /></div>
        ) : projects.data && projects.data.length === 0 ? (
          <div className="p-5"><EmptyState icon="📁" title="No projects yet" action={<Button onClick={openCreate}>Create the first project</Button>} /></div>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Project</Th>
                <Th>Members</Th>
                <Th className="text-right">Reports</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <TBody>
              {projects.data?.map((project) => (
                <Tr key={project.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{project.name}</p>
                    {project.description && <p className="mt-0.5 max-w-md text-xs text-slate-500">{project.description}</p>}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {project.members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} size="sm" />)}
                      {project.members.length === 0 && <span className="text-xs text-slate-400">Unassigned</span>}
                      {project.members.length > 5 && <span className="text-xs text-slate-500">+{project.members.length - 5}</span>}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{project.reportCount}</Td>
                  <Td>{project.active ? <Badge tone="emerald">Active</Badge> : <Badge>Archived</Badge>}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => openEdit(project)} className="text-sm font-medium text-brand-600 hover:underline">Edit</button>
                      {project.active ? (
                        <button type="button" onClick={() => setToDelete(project)} className="text-sm font-medium text-rose-600 hover:underline">{project.reportCount > 0 ? 'Archive' : 'Delete'}</button>
                      ) : (
                        <button type="button" onClick={() => update.mutate({ id: project.id, input: { active: true } })} className="text-sm font-medium text-slate-600 hover:underline">Restore</button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={toDelete && toDelete.reportCount > 0 ? `Archive "${toDelete?.name}"?` : `Delete "${toDelete?.name}"?`}
        description={
          toDelete && toDelete.reportCount > 0
            ? `${toDelete.reportCount} report(s) reference this project, so it will be archived: hidden from new reports but kept on existing ones.`
            : 'The project has no reports and will be permanently deleted.'
        }
        confirmLabel={toDelete && toDelete.reportCount > 0 ? 'Archive' : 'Delete'}
        loading={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: (result) => setNotice(result.archived ? `Project archived.` : `Project deleted.`),
            onSettled: () => setToDelete(null),
          });
        }}
      />
    </div>
  );
}
