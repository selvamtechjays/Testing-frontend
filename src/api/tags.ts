import { apiFetch } from './client';
import type { Tag, TagColour } from './types';

/** What a new tag is made from; a missing colour means gray (the server default). */
export interface NewTag {
  name: string;
  colour?: TagColour;
}

/** What a rename or recolour sends: at least one of the two. */
export interface TagChanges {
  name?: string;
  colour?: TagColour;
}

/** GET /api/tags (EP-TAG-01). The signed-in user's tags with task counts, sorted by name. */
export async function listTags(signal?: AbortSignal): Promise<Tag[]> {
  const { tags } = await apiFetch<{ tags: Tag[] }>('/tags', { signal });
  return tags;
}

/** POST /api/tags (EP-TAG-02). Resolves with the stored tag; rejects with ApiError (a 400 names `name`). */
export async function createTag(input: NewTag, signal?: AbortSignal): Promise<Tag> {
  const { tag } = await apiFetch<{ tag: Tag }>('/tags', { method: 'POST', body: input, signal });
  return tag;
}

/** PATCH /api/tags/:id (EP-TAG-03). Resolves with the answered tag; a 400 names `name`, `colour` or `body`, a 404 means it is gone. */
export async function updateTag(
  id: string,
  changes: TagChanges,
  signal?: AbortSignal,
): Promise<Tag> {
  const { tag } = await apiFetch<{ tag: Tag }>(`/tags/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
    signal,
  });
  return tag;
}

/** DELETE /api/tags/:id (EP-TAG-04). 204 with no body; the server removes the tag from every task. */
export async function deleteTag(id: string, signal?: AbortSignal): Promise<void> {
  await apiFetch<null>(`/tags/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
}
