export type CapabilityStatus = "implemented" | "experimental" | "planned" | "missing";

export type RoleCapability = {
  client: CapabilityStatus;
  server: CapabilityStatus;
};

export type LanguageCapabilityMap = Record<string, RoleCapability>;

export type SchemeCapability = {
  status: CapabilityStatus;
  intentBoundary: "x402-scheme";
  settlementSemantics: "fixed-amount" | "maximum-authorization";
  solanaSemantics: "implemented" | "requires-design";
  defaultCi: boolean;
  languages: LanguageCapabilityMap;
};

export type IntentCapability = {
  status: CapabilityStatus;
  intentBoundary: "compatibility-intent";
  nativeX402Scheme: boolean;
  defaultCi: boolean;
  languages: LanguageCapabilityMap;
};

export type CapabilityRoleEntry = {
  domain: "scheme" | "intent";
  name: string;
  language: string;
  role: "client" | "server";
  status: CapabilityStatus;
  runtimeEligible: boolean;
};

export const interopCapabilities = {
  schemes: {
    exact: {
      status: "implemented",
      intentBoundary: "x402-scheme",
      settlementSemantics: "fixed-amount",
      solanaSemantics: "implemented",
      defaultCi: true,
      languages: {
        typescript: { client: "implemented", server: "implemented" },
        rust: { client: "implemented", server: "implemented" },
      },
    },
    upto: {
      status: "planned",
      intentBoundary: "x402-scheme",
      settlementSemantics: "maximum-authorization",
      solanaSemantics: "requires-design",
      defaultCi: false,
      languages: {
        typescript: { client: "planned", server: "experimental" },
        rust: { client: "planned", server: "planned" },
        python: { client: "planned", server: "planned" },
        go: { client: "planned", server: "planned" },
        ruby: { client: "planned", server: "planned" },
        lua: { client: "missing", server: "planned" },
        php: { client: "missing", server: "planned" },
      },
    },
  },
  intents: {
    session: {
      status: "planned",
      intentBoundary: "compatibility-intent",
      nativeX402Scheme: false,
      defaultCi: false,
      languages: {
        python: { client: "planned", server: "planned" },
        go: { client: "planned", server: "planned" },
        ruby: { client: "planned", server: "planned" },
        lua: { client: "missing", server: "planned" },
        php: { client: "missing", server: "planned" },
      },
    },
    subscription: {
      status: "planned",
      intentBoundary: "compatibility-intent",
      nativeX402Scheme: false,
      defaultCi: false,
      languages: {
        python: { client: "planned", server: "planned" },
        go: { client: "planned", server: "planned" },
        ruby: { client: "planned", server: "planned" },
        lua: { client: "missing", server: "planned" },
        php: { client: "missing", server: "planned" },
      },
    },
  },
} as const satisfies {
  schemes: Record<string, SchemeCapability>;
  intents: Record<string, IntentCapability>;
};

function formatLanguageCapabilities(languages: LanguageCapabilityMap): string[] {
  return Object.entries(languages)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([language, capability]) => {
      return `${language} client:${capability.client} server:${capability.server}`;
    });
}

export function formatCapabilityReport(): string {
  const lines: string[] = [];

  for (const [scheme, capability] of Object.entries(interopCapabilities.schemes)) {
    lines.push(
      `scheme:${scheme} ${capability.status} semantics:${capability.settlementSemantics} solana:${capability.solanaSemantics} default-ci:${capability.defaultCi}`,
    );
    lines.push(...formatLanguageCapabilities(capability.languages));
  }

  for (const [intent, capability] of Object.entries(interopCapabilities.intents)) {
    lines.push(
      `intent:${intent} ${capability.status} native-x402:${capability.nativeX402Scheme}`,
    );
    lines.push(...formatLanguageCapabilities(capability.languages));
  }

  return lines.join("\n");
}

function formatLanguageList(languages: string[]): string {
  return languages.sort((left, right) => left.localeCompare(right)).join(",");
}

function collectRoleGroups(
  capabilities: typeof interopCapabilities.schemes | typeof interopCapabilities.intents,
): string[] {
  const lines: string[] = [];

  for (const [name, capability] of Object.entries(capabilities)) {
    const languages = capability.languages as LanguageCapabilityMap;
    const clientServer: string[] = [];
    const serverOnly: string[] = [];
    const missingClient: string[] = [];
    const experimentalServer: string[] = [];

    for (const [language, role] of Object.entries(languages)) {
      if (role.client === capability.status && role.server === capability.status) {
        clientServer.push(language);
      }
      if (role.server === "experimental") {
        experimentalServer.push(language);
      }
      if (role.client === "missing" && role.server === capability.status) {
        serverOnly.push(language);
        missingClient.push(language);
      }
      if (role.client === capability.status && role.server === "missing") {
        lines.push(`missing: ${name} server ${language}`);
      }
    }

    if (clientServer.length > 0) {
      lines.push(`${capability.status}: ${name} client/server ${formatLanguageList(clientServer)}`);
    }
    if (experimentalServer.length > 0) {
      lines.push(`experimental: ${name} server ${formatLanguageList(experimentalServer)}`);
    }
    if (serverOnly.length > 0) {
      lines.push(`${capability.status}: ${name} server-only ${formatLanguageList(serverOnly)}`);
    }
    if (missingClient.length > 0) {
      lines.push(`missing: ${name} client ${formatLanguageList(missingClient)}`);
    }
  }

  return lines;
}

export function formatCapabilitySummary(): string[] {
  return [
    ...collectRoleGroups(interopCapabilities.schemes),
    ...collectRoleGroups(interopCapabilities.intents),
  ];
}

function collectRoleEntries(
  domain: CapabilityRoleEntry["domain"],
  capabilities: typeof interopCapabilities.schemes | typeof interopCapabilities.intents,
): CapabilityRoleEntry[] {
  return Object.entries(capabilities).flatMap(([name, capability]) => {
    const languages = capability.languages as LanguageCapabilityMap;

    return Object.entries(languages).flatMap(([language, roles]) => {
      return (["client", "server"] as const).map(role => ({
        domain,
        name,
        language,
        role,
        status: roles[role],
        runtimeEligible: capability.defaultCi && roles[role] === "implemented",
      }));
    });
  });
}

export function formatCapabilityRoles(): CapabilityRoleEntry[] {
  return [
    ...collectRoleEntries("scheme", interopCapabilities.schemes),
    ...collectRoleEntries("intent", interopCapabilities.intents),
  ].sort((left, right) => {
    return (
      left.domain.localeCompare(right.domain) ||
      left.name.localeCompare(right.name) ||
      left.language.localeCompare(right.language) ||
      left.role.localeCompare(right.role)
    );
  });
}

export function formatCapabilityJson(): {
  version: 1;
  summary: string[];
  roles: CapabilityRoleEntry[];
  capabilities: typeof interopCapabilities;
} {
  return {
    version: 1,
    summary: formatCapabilitySummary(),
    roles: formatCapabilityRoles(),
    capabilities: interopCapabilities,
  };
}
