import { ConvexError, v } from "convex/values";
import {
  MutationCtx,
  QueryCtx,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { HfInference, FeatureExtractionOutput } from '@huggingface/inference';
import { internal } from "./_generated/api";
import { hasOrgAccess } from "./documents";
import { Doc, Id } from "./_generated/dataModel";

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export const getNote = query({
  args: {
    noteId: v.id("notes"),
  },
  async handler(ctx, args) {
    const userId = (await ctx.auth.getUserIdentity())?.tokenIdentifier;

    if (!userId) {
      return null;
    }

    const note = await ctx.db.get(args.noteId);

    if (!note) {
      return null;
    }

    if (note.orgId) {
      const hasAccess = await hasOrgAccess(ctx, note.orgId);

      if (!hasAccess) {
        return null;
      }
    } else {
      if (note.tokenIdentifier !== userId) {
        return null;
      }
    }

    return note;
  },
});

export const getNotes = query({
  args: {
    orgId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const userId = (await ctx.auth.getUserIdentity())?.tokenIdentifier;

    if (!userId) {
      return null;
    }

    if (args.orgId) {
      const hasAccess = await hasOrgAccess(ctx, args.orgId);

      if (!hasAccess) {
        return null;
      }

      const notes = await ctx.db
        .query("notes")
        .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
        .collect();

      return notes;
    } else {
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", userId))
        .order("desc")
        .collect();

      return notes;
    }
  },
});

function ensureNumberArray(data: FeatureExtractionOutput): number[] {
  if (typeof data === 'number') {
    return [data];
  } else if (Array.isArray(data)) {
    if (data.every(item => typeof item === 'number')) {
      return data as number[];
    } else if (data.every(Array.isArray)) {
      return (data as number[][]).flat();
    }
  }
  throw new Error('Unexpected embedding format');
}

export async function embed(text: string): Promise<number[]> {
  const response = await hf.featureExtraction({
    model: "mixedbread-ai/mxbai-embed-large-v1",
    inputs: text,
  });
  
  return ensureNumberArray(response);
}

export const setNoteEmbedding = internalMutation({
  args: {
    noteId: v.id("notes"),
    embedding: v.array(v.number()),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.noteId, {
      embedding: args.embedding,
    });
  },
});

export const createNoteEmbedding = internalAction({
  args: {
    noteId: v.id("notes"),
    text: v.string(),
  },
  async handler(ctx, args) {
    const embedding = await embed(args.text);

    await ctx.runMutation(internal.notes.setNoteEmbedding, {
      noteId: args.noteId,
      embedding,
    });
  },
});

export const createNote = mutation({
  args: {
    text: v.string(),
    orgId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const userId = (await ctx.auth.getUserIdentity())?.tokenIdentifier;

    if (!userId) {
      throw new ConvexError("You must be logged in to create a note");
    }

    let noteId: Id<"notes">;

    if (args.orgId) {
      const hasAccess = await hasOrgAccess(ctx, args.orgId);

      if (!hasAccess) {
        throw new ConvexError(
          "You do not have permission to create a note in this organization"
        );
      }

      noteId = await ctx.db.insert("notes", {
        text: args.text,
        orgId: args.orgId,
      });
    } else {
      noteId = await ctx.db.insert("notes", {
        text: args.text,
        tokenIdentifier: userId,
      });
    }

    await ctx.scheduler.runAfter(0, internal.notes.createNoteEmbedding, {
      noteId,
      text: args.text,
    });
  },
});

export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  async handler(ctx, args) {
    const userId = (await ctx.auth.getUserIdentity())?.tokenIdentifier;

    if (!userId) {
      throw new ConvexError("You must be logged in to create a note");
    }

    const note = await ctx.db.get(args.noteId);

    if (!note) {
      throw new ConvexError("Note not found");
    }

    await assertAccessToNote(ctx, note);

    await ctx.db.delete(args.noteId);
  },
});

async function assertAccessToNote(
  ctx: QueryCtx | MutationCtx,
  note: Doc<"notes">
) {
  const userId = (await ctx.auth.getUserIdentity())?.tokenIdentifier;

  if (!userId) {
    throw new ConvexError("You must be logged in to create a note");
  }

  if (note.orgId) {
    const hasAccess = await hasOrgAccess(ctx, note.orgId);

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to delete this note");
    }
  } else {
    if (note.tokenIdentifier !== userId) {
      throw new ConvexError("You do not have permission to delete this note");
    }
  }
}
