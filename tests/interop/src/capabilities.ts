export type CapabilityStatus = "implemented" | "planned" | "missing";

export type RoleCapability = {
  client: CapabilityStatus;
  server: CapabilityStatus;
};

export type LanguageCapabilityMap = Record<string, RoleCapability>;

export type SchemeCapability = {
  status: CapabilityStatus;
  intentBoundary: "x402-scheme";
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

export const interopCapabilities = {
  schemes: {
    exact: {
      status: "implemented",
      intentBoundary: "x402-scheme",
      defaultCi: true,
      languages: {
        typescript: { client: "implemented", server: "implemented" },
        rust: { client: "implemented", server: "implemented" },
      },
    },
    upto: {
      status: "planned",
      intentBoundary: "x402-scheme",
      defaultCi: false,
      languages: {
        typescript: { client: "planned", server: "planned" },
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
    lines.push(`scheme:${scheme} ${capability.status} default-ci:${capability.defaultCi}`);
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
