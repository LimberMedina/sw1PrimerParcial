// src/app/projectLoader.ts
import { api } from "../lib/api";

export async function projectLoader({ params, request }: any) {
  const projectId = params.projectId;
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("share");

  try {
    const res = await api.get(`/projects/${projectId}`, {
      params: shareToken ? { share: shareToken } : undefined,
    });

    return {
      project: res.data,
      readonly: Boolean(shareToken),
    };
  } catch {
    throw new Response("Not Found", { status: 404 });
  }
}
