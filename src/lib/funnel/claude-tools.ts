import type Anthropic from "@anthropic-ai/sdk";

export const PARSE_INTAKE_TOOL: Anthropic.Tool = {
  name: "record_intake",
  description:
    "Parse a free-text dump from a group organizer who just met / contacted some people. " +
    "For each person mentioned, decide whether they match an existing roster entry (use studentId) or are brand-new (extract attributes). " +
    "Also capture HOW the organizer met them (firstMetContext).",
  input_schema: {
    type: "object",
    properties: {
      contacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            match: { type: "string", enum: ["existing", "new"] },
            studentId: {
              type: "number",
              description: "Required when match='existing'. The id from the roster.",
            },
            firstName: { type: "string" },
            lastName: { type: "string" },
            gender: { type: "string", enum: ["M", "F"] },
            year: {
              type: "string",
              enum: ["freshman", "sophomore", "junior", "senior", "grad", "other"],
            },
            igHandle: { type: "string", description: "Instagram handle without @" },
            phone: { type: "string" },
            email: { type: "string" },
            firstMetContext: {
              type: "string",
              description: "Where/how the organizer met them, in their own words. e.g. 'the booth', 'BBQ at the park', 'dorm visit'.",
            },
            notes: { type: "string" },
            rawText: {
              type: "string",
              description: "The exact substring from the input that produced this contact.",
            },
          },
          required: ["match", "rawText"],
        },
      },
      explanation: {
        type: "string",
        description: "One short sentence summarizing what you understood the organizer to be saying.",
      },
      ambiguous: {
        type: "array",
        items: { type: "string" },
        description: "Names that match 0 or 2+ roster entries — leave for the organizer to resolve.",
      },
    },
    required: ["contacts"],
  },
};
