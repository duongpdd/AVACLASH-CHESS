export function workspaceReturn(path: string | null): string {
  if (!path) return "/";
  const allowed =
    /^\/(?:game|profile|vault|tournaments\/(?:new|play))(?:[?#]|$)/;
  return allowed.test(path) ? path : "/";
}
