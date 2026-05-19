import type { ImplementationDefinition } from "./implementations";

export type InteropPair = {
  client: ImplementationDefinition;
  server: ImplementationDefinition;
};

export type InteropProfile = "full" | "reference-spine";

export function getInteropProfile(): InteropProfile {
  const profile = process.env.X402_INTEROP_PROFILE?.trim();
  if (profile === "full" || profile === "reference-spine") {
    return profile;
  }
  return "reference-spine";
}

export function getReferenceImplementation(): string {
  return process.env.X402_INTEROP_REFERENCE?.trim() || "rust";
}

export function selectInteropPairs(
  clients: ImplementationDefinition[],
  servers: ImplementationDefinition[],
  profile: InteropProfile = getInteropProfile(),
  referenceImplementation: string = getReferenceImplementation(),
): InteropPair[] {
  const allPairs = clients.flatMap(client => servers.map(server => ({ client, server })));

  if (profile === "full") {
    return allPairs;
  }

  const referenceIsActive =
    clients.some(client => client.id === referenceImplementation) &&
    servers.some(server => server.id === referenceImplementation);

  if (!referenceIsActive) {
    return allPairs;
  }

  return allPairs.filter(
    ({ client, server }) =>
      client.id === referenceImplementation || server.id === referenceImplementation,
  );
}
