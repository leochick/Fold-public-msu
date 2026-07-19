import type Anthropic from "@anthropic-ai/sdk";

export const PARSE_STUDENTS_BATCH_TOOL: Anthropic.Tool = {
  name: "parse_students_batch",
  description:
    "Parse a free-text stream or roster dump containing information about multiple students, " +
    "including bulk update requests and per-person salvation decision rosters. " +
    "Extract names, profile fields, course completions, salvation decisions, and any miscellaneous notes cleanly into structured array fields.",
  input_schema: {
    type: "object",
    properties: {
      students: {
        type: "array",
        description:
          "One entry per person in the input. For bulk updates (newsletter, Groupme, course completions, etc.), " +
          "contact-info updates (phone, email), or salvation decision rows (date/type/notes), emit one entry per named student with the parsed field changes — never return an empty array when names are listed.",
        items: {
          type: "object",
          properties: {
            firstName: { type: "string", description: "Required first name." },
            lastName: { type: "string", description: "Optional last name if provided." },
            gender: { type: "string", enum: ["M", "F"], description: "Infer M for bro/guy/brother, F for girl/sister if present." },
            year: {
              type: "string",
              enum: ["freshman", "sophomore", "junior", "senior", "grad", "other"],
              description: "Class or school year tracking bucket alignment.",
            },
            phone: {
              type: "string",
              description: "Phone number if provided or updated for this student (any common format).",
            },
            email: {
              type: "string",
              description: "Email address if provided or updated for this student.",
            },
            igHandle: { type: "string", description: "Instagram account handle explicitly without the leading @ symbol." },
            memberStatus: { type: "string", enum: ["prospect", "member", "core"], description: "Membership tier if mentioned or implied by bulk instruction." },
            newsletter: { type: "boolean", description: "Whether the student is subscribed to the newsletter." },
            groupme: { type: "boolean", description: "Whether the student is in the Groupme chat." },
            contactedViaIg: { type: "boolean", description: "Whether the student has been contacted via Instagram." },
            primaryContact: { type: "string", description: "Primary contact person or method." },
            goals: { type: "string", description: "Student goals if mentioned." },
            courseMaterialAdd: {
              type: "array",
              items: { type: "string", enum: ["Course 101", "ERT", "Sixth Hour", "Connection Team", "Student Leader"] },
              description: "Course materials to mark completed or in progress. Use for bulk 'mark Course 101 completed' style requests.",
            },
            salvationDecisionAt: {
              type: "string",
              description:
                "Salvation decision date as ISO YYYY-MM-DD. Accept M/D/YY or M/D/YYYY from input and convert (e.g. 9/27/25 → 2025-09-27).",
            },
            salvationDecisionType: {
              type: "string",
              enum: ["salvation", "lordship"],
              description: "Decision type. Map 'Salvation' → salvation, 'Lordship' → lordship.",
            },
            salvationDecisionNotes: {
              type: "string",
              description:
                "Salvation decision notes / context (e.g. Fall Retreat, Course 101, Conversation). Do not put these in notes.",
            },
            notes: { type: "string", description: "Any other parsed metadata, context notes, or description lines." },
            rawText: { type: "string", description: "The verbatim snippet string from the prompt that targets this person." },
          },
          required: ["firstName", "rawText"],
        },
      },
      explanation: {
        type: "string",
        description: "A very brief one-sentence wrap-up of what was parsed, including any bulk field updates applied.",
      },
    },
    required: ["students", "explanation"],
  },
};
